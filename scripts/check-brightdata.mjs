// Early live check (BD-7, spec section 16 step 1): for each first-batch institution, discover
// official pages with the Bright Data SERP zone, then fetch each page with a plain request and
// with Web Unlocker and record what worked. Reads the key from the environment; never prints it.
// Usage: BRIGHTDATA_API_KEY="$(npx convex env get BRIGHTDATA_API_KEY)" \
//        BRIGHTDATA_SERP_ZONE=... BRIGHTDATA_UNLOCKER_ZONE=... node scripts/check-brightdata.mjs [out.json]
import { writeFileSync } from "node:fs";
import domains from "../config/domains.json" with { type: "json" };

const KEY = process.env.BRIGHTDATA_API_KEY;
const SERP_ZONE = process.env.BRIGHTDATA_SERP_ZONE;
const UNLOCKER_ZONE = process.env.BRIGHTDATA_UNLOCKER_ZONE;
if (!KEY || !SERP_ZONE || !UNLOCKER_ZONE) throw new Error("BRIGHTDATA_API_KEY, BRIGHTDATA_SERP_ZONE and BRIGHTDATA_UNLOCKER_ZONE are required");

const INSTITUTIONS = {
  US: ["psu.edu", "msu.edu", "wisc.edu", "illinois.edu", "northeastern.edu", "dartmouth.edu"],
  GB: ["exeter.ac.uk", "sheffield.ac.uk", "lancaster.ac.uk", "manchester.ac.uk", "bath.ac.uk", "lboro.ac.uk"],
};
const TOPICS = [
  { topic: "requirements", q: (d, c) => `site:${d} ${c === "GB" ? "Indonesia entry requirements undergraduate" : "international first-year applicants Indonesia requirements"}` },
  { topic: "costs", q: (d, c) => `site:${d} ${c === "GB" ? "international undergraduate tuition fees" : "international undergraduate tuition cost of attendance"}` },
];
const allowed = [...domains.US, ...domains.GB];
const onAllowlist = (url) => { try { const h = new URL(url).hostname; return allowed.some((d) => h === d || h.endsWith("." + d)); } catch { return false; } };

async function brightData(zone, url, timeoutMs) {
  const started = Date.now();
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ zone, url, format: "raw" }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  return { status: res.status, body, ms: Date.now() - started, error: res.headers.get("x-brd-error") ?? res.headers.get("x-luminati-error") ?? null };
}

const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
const BLOCK = /captcha|access denied|request blocked|are you a robot|attention required|cf-browser-verification|just a moment\.\.\./i;

function judge(status, body) {
  const t = text(body ?? "");
  if (status !== 200) return { ok: false, reason: `HTTP ${status}`, chars: t.length };
  if (BLOCK.test(body.slice(0, 20000)) && t.length < 5000) return { ok: false, reason: "block page", chars: t.length };
  if (t.length < 800) return { ok: false, reason: "almost empty", chars: t.length };
  return { ok: true, reason: "ok", chars: t.length };
}

async function plain(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", Accept: "text/html" },
      redirect: "follow", signal: AbortSignal.timeout(20000),
    });
    const body = await res.text();
    return { ...judge(res.status, body), ms: Date.now() - started, finalUrl: res.url };
  } catch (e) {
    return { ok: false, reason: e.name === "TimeoutError" ? "timeout" : String(e.cause?.code ?? e.message), chars: 0, ms: Date.now() - started };
  }
}

async function unlocker(url) {
  try {
    const r = await brightData(UNLOCKER_ZONE, url, 180000);
    return { ...judge(r.status, r.body), ms: r.ms, ...(r.error ? { brdError: r.error.slice(0, 200) } : {}) };
  } catch (e) {
    return { ok: false, reason: e.name === "TimeoutError" ? "timeout" : String(e.message), chars: 0 };
  }
}

// Live finding (2026-10-24): the SERP zone sometimes returns an empty body, times out, or returns
// results that ignore the site: operator. Each of those is retried, up to 3 attempts.
async function discover(country, domain, t) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    last = { ...(await discoverOnce(country, domain, t)), attempts: attempt };
    if (last.ok) return last;
  }
  return last;
}

async function discoverOnce(country, domain, t) {
  const q = t.q(domain, country);
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en&gl=${country === "GB" ? "gb" : "us"}&brd_json=1`;
  try {
    const r = await brightData(SERP_ZONE, url, 120000);
    if (r.status !== 200) return { q, ok: false, reason: `HTTP ${r.status}${r.error ? " " + r.error.slice(0, 120) : ""}`, ms: r.ms };
    const data = JSON.parse(r.body);
    const organic = (data.organic ?? []).map((o) => o.link ?? o.url).filter(Boolean);
    const official = organic.filter(onAllowlist);
    return { q, ok: official.length > 0, ms: r.ms, results: organic.length, url: official[0] ?? null, reason: official.length ? "ok" : "no official result" };
  } catch (e) {
    return { q, ok: false, reason: String(e.message).slice(0, 160) };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const jobs = Object.entries(INSTITUTIONS).flatMap(([country, list]) => list.flatMap((domain) => TOPICS.map((t) => ({ country, domain, t }))));
const rows = await pool(jobs, 4, async ({ country, domain, t }) => {
  const serp = await discover(country, domain, t);
  const row = { country, domain, topic: t.topic, serp };
  if (serp.url) {
    row.plain = await plain(serp.url);
    row.unlocker = await unlocker(serp.url);
  }
  const p = row.plain ? (row.plain.ok ? "plain ok" : `plain ${row.plain.reason}`) : "-";
  const u = row.unlocker ? (row.unlocker.ok ? "unlocker ok" : `unlocker ${row.unlocker.reason}`) : "-";
  console.log(`${country} ${domain.padEnd(17)} ${t.topic.padEnd(12)} serp:${serp.ok ? "ok" : serp.reason}(x${serp.attempts})  ${p}  ${u}  ${serp.url ?? ""}`);
  return row;
});

const fetched = rows.filter((r) => r.serp.url);
const summary = {
  at: new Date().toISOString(),
  serp: { queries: rows.length, withOfficialResult: fetched.length, attempts: rows.reduce((n, r) => n + (r.serp.attempts ?? 1), 0) },
  pages: fetched.length,
  plainOk: fetched.filter((r) => r.plain.ok).length,
  unlockerOk: fetched.filter((r) => r.unlocker.ok).length,
  needUnlocker: fetched.filter((r) => !r.plain.ok && r.unlocker.ok).map((r) => r.serp.url),
  failedBoth: fetched.filter((r) => !r.plain.ok && !r.unlocker.ok).map((r) => ({ url: r.serp.url, plain: r.plain.reason, unlocker: r.unlocker.reason, brdError: r.unlocker.brdError })),
};
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ summary, rows }, null, 2));
