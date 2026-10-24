# Apify in Langkah

Status: built and tested live on 2026-10-24.

## What it does

A custom Actor, `langkah-crawler` (Apify Actor ID `KwwWectpAY5Nnfqw4`, source in `actor/`), performs all collection of official university pages (AP-1). Convex starts it, Apify runs it, and a webhook tells Convex when it is done.

| Requirement | How |
| --- | --- |
| AP-1 custom Actor does the collection | `actor/src/main.js`; Convex never fetches university pages itself |
| AP-2 queue, de-duplication, link following, limits | Apify request queue keyed by normalized URL; same-site links filtered by keywords; `maxDepth`, `maxPages`, `maxConcurrency` inputs |
| AP-3 retries and per-page status | Up to 3 attempts per method with exponential backoff for timeouts, 429 and 5xx; no retry for 403 or policy blocks; every item has `status`, `fetchMethod`, `attempts`, the plain attempt's outcome and any error |
| AP-4 Bright Data Web Unlocker fallback | Used when the plain fetch fails; the key is an Actor secret (`@langkahBrightdataKey`), never in the input or logs |
| AP-5 asynchronous start, webhook, polling backup | `convex/ingestion.ts` `startRun` uses the async runs endpoint with an ad-hoc webhook to `/apify/webhook/<secret>`; `collect` re-reads the run from the Apify API; `poll` checks every 5 minutes for an hour |
| AP-6 source packages | One dataset item per page: URL, final URL, cleaned text (≤ 200k chars), SHA-256 hash, title, retrieval time |
| Allowlist (BD-3) | Start URLs and every followed link must be on `config/domains.json`; redirects off the list are rejected |

Convex stores each page as a `sources` row with its text in Convex storage. A page whose hash has not changed is marked unchanged instead of stored again; a changed page gets a new row linked to the previous one.

## Live evidence (2026-10-24, dev deployment `efficient-dragon-119`)

| Run | What happened |
| --- | --- |
| Smoke test (Apify run `fAEWpkOwYHtOCbEAf`) | 8 pages; Bath fees page plus 6 linked fee pages by plain fetch; Penn State Harrisburg tuition page plain HTTP 403 → Web Unlocker ok. Cost about $0.001 |
| Convex-started run (`qbDAvhYeb73EjriWI`) | Webhook reached Convex about 20 s after start; 5 pages stored, 1 JavaScript-only page recorded as `empty` |
| Replays | The same notification posted twice more by hand: accepted, counted (`webhookCount` 3), no new rows. Wrong secret → 404; unknown run → 404 |
| Repeat crawl (`AZQfwF9saLKJBvr5K`) | 5 unchanged, 0 new: content hashes matched |

Automated: `tests/actor/lib.test.ts` (allowlist, URL normalization, text cleaning, link selection, status classification) and `tests/convex/ingestion.test.ts` (async endpoint only, webhook secret, replay safety, off-allowlist items dropped, change detection, polling, failed runs).

## Limits and known gaps

- Free plan: $5 of platform usage per month. Runs are capped by `config/limits.json` (`maxPagesPerRun` 150).
- JavaScript-rendered pages come back nearly empty with both plain fetch and Web Unlocker's default; they are recorded as `empty`.
- If collection crashes after storing a page's text but before recording it, that text file is orphaned (the retry stores the page again correctly). A cleanup job is not written yet.
- Extraction of fields from the stored text (Claude) is the next step and not built yet.
