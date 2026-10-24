# Bright Data early live check (BD-7) — 2026-10-24

Script: `scripts/check-brightdata.mjs` (rerunnable). Zones: SERP `serp_api1_langkah`, Web Unlocker `web_unlocker1_langkah`. Key held in the Convex environment only.

## Method

For each of the 12 first-batch institutions, two Google searches through the SERP zone (international entry requirements / Indonesia, and international undergraduate tuition), restricted with `site:` to the institution's domain. The first allowlisted result was fetched twice: a plain HTTPS request, and through Web Unlocker. A page counts as "ok" when it returns HTTP 200 with more than 800 characters of text and no block page.

## Results (second run, with SERP retries)

| Measure | Result |
| --- | --- |
| SERP queries | 24 (42 attempts with up to 3 retries) |
| Official page found | 21 of 24 |
| Plain fetch ok | 19 of 21 |
| Web Unlocker ok | 20 of 21 |
| Needed Web Unlocker | 1: `harrisburg.psu.edu` tuition page (plain fetch HTTP 403) |
| Failed both | 1: a JavaScript-rendered Lancaster portal page (almost no text either way; also the wrong page) |
| Policy blocks from Web Unlocker | None seen on any of the 12 universities' domains |

First run (no retries): 14 of 24 queries found an official page; 12 of 14 pages ok both ways; Manchester's student-support fees page timed out on plain fetch and returned almost no text through Web Unlocker ("Navigation failed: Timeout error in network").

## Findings that change the pipeline

1. **The SERP zone is unreliable per request.** Observed: HTTP 200 with an empty body; client timeouts; a plain-text error body starting "This query…"; results that ignore `site:` and return unrelated sites; results whose links are Google redirect URLs (`google.com/goto?url=…`). The same query succeeded on retry each time it was repeated. The pipeline must retry SERP calls (3 attempts), reject off-allowlist results, and read the displayed URL when links are redirects.
2. **Web Unlocker is needed only occasionally** for these universities (1 page of 21) but it is needed, so both paths stay (BD-2), and each source records which one worked.
3. **Search results are not always the right page.** Examples: Penn State's top tuition result was the Harrisburg campus, not University Park; Lancaster's top Indonesia result was news about its Indonesia campus. Program identity and campus checks in the validator, plus link-following from official landing pages in the Actor, are required — the first search hit cannot be trusted as "the" page.
4. **Some pages need JavaScript** (Lancaster portal). Web Unlocker's default response did not render it; such pages are recorded as `empty` and other official pages are used.

No university data from this check is stored or shown in the app; it only tests retrieval.
