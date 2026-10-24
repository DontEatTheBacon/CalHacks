// Bright Data SERP discovery (BD-1). Live finding 2026-10-24: the SERP zone sometimes returns an
// empty body, a timeout, a plain-text error, results that ignore `site:`, or Google redirect links,
// so each query is tried up to 3 times and only allowlisted links are kept.
import { isAllowedUrl } from "./rules/domains.ts";

export type SerpResult = { ok: boolean; query: string; links: string[]; attempts: number; error?: string };

function linkOf(o: { link?: string; url?: string; display_link?: string }): string | null {
  const l = o.link ?? o.url ?? null;
  if (l && !/google\.[a-z.]+\/(goto|url)\?/.test(l)) return l;
  // Redirect link: fall back to the displayed URL when it is a full address.
  const d = o.display_link;
  return d && /^https?:\/\//.test(d) ? d.split(" ")[0]! : null;
}

export async function serp(query: string, country: "US" | "GB"): Promise<SerpResult> {
  const key = process.env.BRIGHTDATA_API_KEY;
  const zone = process.env.BRIGHTDATA_SERP_ZONE;
  if (!key || !zone) return { ok: false, query, links: [], attempts: 0, error: "Bright Data is not configured (BRIGHTDATA_API_KEY, BRIGHTDATA_SERP_ZONE)" };
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=${country === "GB" ? "gb" : "us"}&brd_json=1`;
  let error = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.brightdata.com/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ zone, url, format: "raw" }),
        signal: AbortSignal.timeout(120_000),
      });
      const body = await res.text();
      if (res.status !== 200) { error = `HTTP ${res.status}`; continue; }
      const data = JSON.parse(body) as { organic?: { link?: string; url?: string; display_link?: string }[] };
      const links = [...new Set((data.organic ?? []).map(linkOf).filter((l): l is string => !!l && isAllowedUrl(l)))];
      if (links.length) return { ok: true, query, links, attempts: attempt };
      error = "no official result";
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 120) : String(e);
    }
  }
  return { ok: false, query, links: [], attempts: 3, error };
}
