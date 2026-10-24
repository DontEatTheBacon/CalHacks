// Pure helpers for the Langkah crawler. No network, no Apify SDK: unit-tested in tests/actor.
import { createHash } from "node:crypto";

/** Suffix match: "www.sheffield.ac.uk" is allowed by "sheffield.ac.uk". */
export function isAllowed(url, allowedDomains) {
  let host;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedDomains.some((d) => host === d || host.endsWith("." + d));
}

/** Key for de-duplication: lower-case host, no fragment, no trailing slash, no tracking parameters, https. */
export function normalizeUrl(url) {
  const u = new URL(url);
  u.hash = "";
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const p of [...u.searchParams.keys()]) if (/^(utm_|gclid|fbclid|mc_)/i.test(p)) u.searchParams.delete(p);
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", pound: "£", euro: "€", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * Readable page text. The same text is stored and given to extraction, so evidence excerpts
 * can be checked against it verbatim. Block elements become line breaks; page chrome is dropped.
 */
export function htmlToText(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head\b[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|section|article|main|aside|h[1-6]|li|ul|ol|tr|table|thead|tbody|dl|dt|dd|blockquote|figure|figcaption)\b[^>]*>/gi, "\n")
    .replace(/<\/?(td|th)\b[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").replace(/( \|)+ /g, " | ").replace(/^[ |]+|[ |]+$/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

export function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim().slice(0, 300) : null;
}

export const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

const SKIP_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|svg|webp|mp4|mp3|ics|css|js)$/i;

/**
 * Same-site links worth following: on the allowlist, HTML-like, and whose URL or anchor text
 * mentions one of the keywords (admissions, Indonesia, fees, the majors, …).
 */
export function extractLinks(html, baseUrl, allowedDomains, keywords) {
  const out = new Map();
  const re = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  const kw = keywords.map((k) => k.toLowerCase());
  for (const m of html.matchAll(re)) {
    const href = decodeEntities(m[2].trim());
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    let abs;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (!isAllowed(abs, allowedDomains)) continue;
    const path = new URL(abs).pathname;
    if (SKIP_EXT.test(path)) continue;
    const anchor = decodeEntities(m[3].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().toLowerCase();
    const hay = (path + " " + anchor).toLowerCase();
    if (kw.length && !kw.some((k) => hay.includes(k))) continue;
    const key = normalizeUrl(abs);
    if (!out.has(key)) out.set(key, abs);
  }
  return [...out.values()];
}

const BLOCK = /captcha|access denied|request blocked|are you a robot|attention required|cf-browser-verification|just a moment\.\.\./i;

/**
 * Classifies a fetched response into the source status used by Convex
 * (ok | blocked | empty | timeout | rejected_by_policy) and whether trying again could help.
 */
export function classify({ httpStatus, html, error, brdError }) {
  if (error === "timeout") return { status: "timeout", retryable: true };
  if (error) return { status: "blocked", retryable: true, detail: error };
  if (brdError && /policy|robots|forbidden by|not allowed/i.test(brdError)) return { status: "rejected_by_policy", retryable: false, detail: brdError };
  if (httpStatus === 429 || httpStatus >= 500) return { status: "blocked", retryable: true, detail: `HTTP ${httpStatus}` };
  if (httpStatus === 401 || httpStatus === 403) return { status: "blocked", retryable: false, detail: `HTTP ${httpStatus}` };
  if (httpStatus !== 200) return { status: "blocked", retryable: false, detail: `HTTP ${httpStatus}` };
  const text = htmlToText(html ?? "");
  if (BLOCK.test((html ?? "").slice(0, 20000)) && text.length < 5000) return { status: "blocked", retryable: false, detail: "block page" };
  if (text.length < 300) return { status: "empty", retryable: false, detail: "almost no text (JavaScript page?)" };
  return { status: "ok", retryable: false, text };
}

/** Exponential backoff with jitter, in ms. */
export const backoff = (attempt, baseMs = 1000) => Math.round(baseMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
