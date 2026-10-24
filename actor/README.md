# Langkah crawler (Apify Actor)

Collects official US and UK university pages (admissions, Indonesia requirements, fees, deadlines) for the Langkah app. Started asynchronously by Convex, which learns of completion through a webhook and fetches the dataset.

- Only domains in `allowedDomains` are fetched; redirects off the list are rejected.
- Plain HTTPS first, Bright Data Web Unlocker when that fails; each item records `fetchMethod` and the plain attempt's outcome.
- Request queue with de-duplication by normalized URL; same-site link following to `maxDepth`, filtered by `linkKeywords`.
- Retries with exponential backoff for timeouts, 429 and 5xx; no retry for 403, policy or robots blocks.
- Output per page: `url`, `finalUrl`, `status` (ok | blocked | empty | timeout | rejected_by_policy), `fetchMethod`, cleaned `text`, `contentHash` (SHA-256), `title`, `retrievedAt`.
- Page content is treated as data; nothing in it is executed or followed as an instruction.

Secrets: `BRIGHTDATA_API_KEY` is an Actor secret (`apify secrets add langkahBrightdataKey …`), never part of the input.
