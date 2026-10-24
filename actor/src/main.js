// Langkah crawler (Apify Actor). Collects official university pages for Convex:
// queue + de-duplication, same-site link following to a depth limit, retries with backoff,
// Bright Data Web Unlocker when a plain fetch fails, cleaned text, content hash and a
// per-page status. One dataset item per page ("source package"). Page content is data only.
import { Actor, log } from "apify";
import { backoff, classify, declaredUrl, extractLinks, isAllowed, normalizeUrl, sha256, titleOf } from "./lib.js";

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const {
  startUrls = [],
  allowedDomains = [],
  maxDepth = 1,
  maxPages = 40,
  maxConcurrency = 3,
  linkKeywords = [],
  requestTimeoutSecs = 30,
  unlockerTimeoutSecs = 180,
  maxAttempts = 3,
  label = null,
} = input;

const BRD_KEY = process.env.BRIGHTDATA_API_KEY;
const BRD_ZONE = process.env.BRIGHTDATA_UNLOCKER_ZONE;
const MAX_TEXT = 200_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

if (!allowedDomains.length) throw new Error("allowedDomains is required");
if (!BRD_KEY || !BRD_ZONE) log.warning("Bright Data is not configured; only plain fetches will be used.");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function plainFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en" },
      redirect: "follow",
      signal: AbortSignal.timeout(requestTimeoutSecs * 1000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!/html|text\/plain/i.test(type)) return { httpStatus: res.status, html: "", finalUrl: res.url, error: `not HTML (${type.split(";")[0]})` };
    return { httpStatus: res.status, html: await res.text(), finalUrl: res.url };
  } catch (e) {
    return { error: e.name === "TimeoutError" ? "timeout" : String(e.cause?.code ?? e.message).slice(0, 200) };
  }
}

async function unlockerFetch(url) {
  try {
    const res = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: { Authorization: `Bearer ${BRD_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone: BRD_ZONE, url, format: "raw" }),
      signal: AbortSignal.timeout(unlockerTimeoutSecs * 1000),
    });
    const brdError = res.headers.get("x-brd-error") ?? res.headers.get("x-luminati-error");
    return { httpStatus: res.status, html: await res.text(), finalUrl: url, brdError: brdError?.slice(0, 300) ?? undefined };
  } catch (e) {
    return { error: e.name === "TimeoutError" ? "timeout" : String(e.message).slice(0, 200) };
  }
}

/** Up to maxAttempts tries of one method; stops early when a retry cannot help. */
async function tryMethod(method, url) {
  let last;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = method === "plain" ? await plainFetch(url) : await unlockerFetch(url);
    const verdict = classify(res);
    last = { res, verdict, attempts: attempt };
    if (verdict.status === "ok" || !verdict.retryable) break;
    await sleep(backoff(attempt));
  }
  return last;
}

async function collect(url) {
  const plain = await tryMethod("plain", url);
  if (plain.verdict.status === "ok") return { method: "plain", ...plain, plainOutcome: null };
  if (!BRD_KEY || !BRD_ZONE) return { method: "failed", ...plain, plainOutcome: plain.verdict };
  const unlocked = await tryMethod("web_unlocker", url);
  if (unlocked.verdict.status === "ok") return { method: "web_unlocker", ...unlocked, plainOutcome: plain.verdict };
  return { method: "failed", ...unlocked, plainOutcome: plain.verdict };
}

const queue = await Actor.openRequestQueue();
for (const url of startUrls.map((u) => (typeof u === "string" ? u : u.url))) {
  if (!isAllowed(url, allowedDomains)) {
    await Actor.pushData({ url, status: "rejected_by_policy", fetchMethod: "failed", error: "Domain not on the allowlist", depth: 0, retrievedAt: new Date().toISOString(), label });
    continue;
  }
  await queue.addRequest({ url, uniqueKey: normalizeUrl(url), userData: { depth: 0 } });
}

let started = 0;
const counts = { ok: 0, failed: 0, webUnlocker: 0 };

async function worker() {
  while (started < maxPages) {
    const req = await queue.fetchNextRequest();
    if (!req) {
      if (await queue.isFinished()) return;
      await sleep(500);
      continue;
    }
    started++;
    const depth = req.userData.depth ?? 0;
    const out = await collect(req.url);
    const finalUrl = out.res.finalUrl ?? req.url;
    const ok = out.verdict.status === "ok";
    // A redirect off the allowlist is not collected, including one hidden behind Web Unlocker
    // (caught through the page's declared canonical address).
    const declared = ok ? declaredUrl(out.res.html, finalUrl) : null;
    const offList = ok && (!isAllowed(finalUrl, allowedDomains) || (declared !== null && !isAllowed(declared, allowedDomains)));
    const text = ok && !offList ? out.verdict.text.slice(0, MAX_TEXT) : null;
    await Actor.pushData({
      url: req.url,
      finalUrl,
      domain: new URL(finalUrl).hostname,
      depth,
      label,
      status: offList ? "rejected_by_policy" : out.verdict.status,
      fetchMethod: ok && !offList ? out.method : "failed",
      httpStatus: out.res.httpStatus ?? null,
      attempts: out.attempts,
      plainOutcome: out.plainOutcome ? { status: out.plainOutcome.status, detail: out.plainOutcome.detail ?? null } : null,
      error: offList ? `Redirected off the allowlist${declared ? ` (page declares ${new URL(declared).hostname})` : ""}` : ok ? null : (out.verdict.detail ?? out.verdict.status),
      title: ok ? titleOf(out.res.html) : null,
      text,
      textTruncated: ok ? out.verdict.text.length > MAX_TEXT : false,
      contentHash: text ? sha256(text) : null,
      retrievedAt: new Date().toISOString(),
    });
    if (text) {
      counts.ok++;
      if (out.method === "web_unlocker") counts.webUnlocker++;
      if (depth < maxDepth) {
        for (const link of extractLinks(out.res.html, finalUrl, allowedDomains, linkKeywords)) {
          await queue.addRequest({ url: link, uniqueKey: normalizeUrl(link), userData: { depth: depth + 1 } });
        }
      }
    } else {
      counts.failed++;
    }
    await queue.markRequestHandled(req);
  }
}

await Promise.all(Array.from({ length: Math.max(1, Math.min(maxConcurrency, 5)) }, worker));
log.info(`Done: ${counts.ok} pages collected (${counts.webUnlocker} via Web Unlocker), ${counts.failed} failed, ${started} attempted.`);
await Actor.setValue("SUMMARY", { ...counts, attempted: started, label });
await Actor.exit();
