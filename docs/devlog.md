# Development Log

Rule for this file: record only what actually happened, with the real date it was written. Add late entries as late entries (say when they were written and from what record). Minutes and 1–5 ratings are filled in by the user, not estimated by Claude. Do not backdate.

## Tool use to date (as of 2026-10-24)

| Tool | Used? | For what |
| --- | --- | --- |
| Claude Code (Sonnet 5.5) | Yes | Planning documents, reading the spec files, feasibility research, drafting |
| Claude subagents (3) | Yes | Read-only research of vendor documentation |
| Figma | No | Nothing created yet. Write access not verified. |
| Mana | No | Not used yet |
| Notability | No | Not used yet |
| Bright Data / Apify / Bitdeer / Convex / Factory / Forge / Cartesia | No | Documentation read only. No live calls with accounts yet. |

## Entries

### Entry template
- Date written / date of the work:
- Stage (ideation, prototyping, handoff, code generation, other):
- Tools used and why:
- What was done:
- Rework, dead ends, abandoned approaches:
- Approx. minutes (user): 
- Effectiveness 1–5 (user):
- How the output reached the project:

### 2026-10-24 — Specification and feasibility session (Claude Code)
- Stage: ideation / planning.
- Tools used and why: Claude Code to read and consolidate the project documents; web fetches and three documentation-research subagents for vendor feasibility.
- Starting point: the folder already contained the specs `preliminary-requirements.md`, `additional-requirement.md`, `actors-and-workflow-decisions.md`, `technology-and-award-requirements.md`, `figma.md`, `implementation-spec.md` and the mockup `langkah-polished-screens.html`. How those were produced before this entry is not recorded here; the user should add what actually happened.
- What was done this session:
  - Read all seven files and summarized the product goal.
  - The user decided: all sponsor technologies are required, demo runs on a MacBook or hosted, round-robin counselor assignment, config-driven setting classification, 10-year retention, and exchange rates from a free service.
  - Claude proposed a ranking method, setting-classification config, equivalency-collection approach, exchange-rate source (Frankfurter) and a stack, written to `decisions-and-stack.md`.
  - Tested two free no-key services with live read-only requests: Frankfurter returned USD→IDR and USD→GBP rates; Open-Meteo returned climate data for a US location.
  - Ran three read-only documentation-research subagents covering Bright Data and Apify; Bitdeer and Convex; Factory, Forge and Cartesia.
  - Wrote `award-evidence-plan.md` after the user pointed out that awards also need documentation, not just tool use.  
- Findings that changed the plan (from documentation only, not live tests): Convex Auth is beta; Convex file links are public to anyone with the URL; Cartesia's current speech-to-text model lacks Indonesian; the Droid SDK has no tool allowlist; Bright Data Web Unlocker may block some university domains before account verification; Bitdeer docs state nothing about Indonesian support.
- Approx. minutes (user): 
- Effectiveness 1–5 (user): 
- How the output reached the project: files in this folder: `decisions-and-stack.md`, `award-evidence-plan.md`, this log.

### 2026-10-24 (later, same session) — Requirements consolidation (Claude Code)
- Stage: ideation / planning.
- Tools used and why: Claude Code to write documents; subagent reports from earlier in the session were used as input.
- What was done:
  - The user clarified that sponsor track rules are eligibility conditions and asked for them to be treated as app requirements; Claude wrote `sponsor-technical-requirements.md` (including the decision that a custom Apify Actor is mandatory).
  - The user decided on Cartesia `ink-whisper` for Indonesian speech-to-text after discussion; recorded in `decisions-and-stack.md` section 11.
  - Claude wrote `award-evidence-plan.md` and this devlog.
  - Claude wrote the consolidated `spec-v1.0.md`, merging the earlier documents.
- Approx. minutes (user): 
- Effectiveness 1–5 (user): 
- How the output reached the project: `spec-v1.0.md`, `sponsor-technical-requirements.md`.

### 2026-10-24 (later, same session) — First institution batch chosen (Claude Code)
- Stage: ideation / planning.
- Tools used and why: two read-only research subagents on official university sites (US: 10 candidates; UK: 12 candidates) to compare rounds, Indonesia pages, costs and settings.
- What was done: the user accepted the proposed items in `spec-v1.0.md`; Claude proposed 6 US and 6 UK institutions from the research; the user approved all 12 and chose Computer Science and Economics as the two majors. Recorded in `spec-v1.0.md` section 4.3.
- Limits: facts come from agents' reading of official pages, some from search summaries; nothing was ingested or verified live. Economics availability per institution was not checked.
- Rework / dead ends: Edinburgh's fee and Glasgow's Indonesia requirements were not found, so both are reserves. Oregon State was left as a reserve because it has no confirmed Common App route for international applicants.
- Approx. minutes (user): 
- Effectiveness 1–5 (user): 
- How the output reached the project: `spec-v1.0.md` section 4.3.

### 2026-10-24 (later, same session) — Design plan and phase boundary (Claude Code)
- Stage: ideation / planning.
- Tools used and why: Claude Code; a tool search and an MCP registry search to see which Figma tools are available.
- What was done: wrote `docs/engineering-detail.md`, `docs/design-delta.md`, `docs/test-demo-setup.md` and `docs/figma-plan.md`. The user said the HTML mock is guidance, not the final design, and that the spec must include creating the Figma design and pages; Claude updated the spec accordingly. The user then said the current phase is specification only, so Claude marked every account, key, Figma-access and live-check item as build phase across the documents.
- Finding: this session had no Figma tools; the registry's Figma connector is not connected, and whether it can create design pages is unverified.
- Rework / dead ends: the first design-gap list repeated work already present in the user's mock, so it was replaced by a delta document. Two data-source terms lookups (Open-Meteo, Frankfurter) were interrupted by the user and are still unchecked.
- Approx. minutes (user): 
- Effectiveness 1–5 (user): 
- How the output reached the project: the four documents above and the edits to `spec-v1.0.md`.

### 2026-10-24 (later, same session) — Older files archived (Claude Code)
- What was done: at the user's request, the seven earlier specification files (`preliminary-requirements.md`, `additional-requirement.md`, `actors-and-workflow-decisions.md`, `technology-and-award-requirements.md`, `figma.md`, `implementation-spec.md`, `decisions-and-stack.md`) were moved, unchanged, into `archive/`. Their diagrams, the sponsor prize and judging table, and the reference links were first copied into `spec-v1.0.md` Appendices A to C. Earlier log entries above refer to these files by their former top-level paths.
- Approx. minutes (user): 
- Effectiveness 1–5 (user): 

### Open items for the user to add or create with Claude helpp 
- When and how the original six spec documents and the HTML mockup were created, and with which tools.
- Any real conversations with students or counselors.
- Any Notability use, Mana use, and Figma progress

### 2026-10-24 — Build start: repository, config, rules (Claude Code, cloud session)
- Stage: code generation.
- Tools used and why: Claude Code in a cloud session; Node's built-in test runner because the npm registry is blocked in this session.
- What was done:
  - Found that `DontEatTheBacon/CalHacks` already held Andrew Valentine's first prototype (FastAPI + Gemini + Vite). The user chose to rebuild on the spec stack and reuse its good parts. Moved it to `legacy/` on a new `langkah` branch; `main` untouched. Andrew pushed again at 11:15 (Claude agent restored), which was pulled into `legacy/`.
  - Copied the project documents into `docs/` (the private key file was deliberately left out). Added `.gitignore` rules for secrets.
  - Wrote `config/` (ranking, setting, climate, taxonomy, retention, limits, domains, planning). Climate rules changed from text expressions to structured fields so code reads them deterministically.
  - Wrote the deterministic rules in `convex/lib/rules/` (major relevance, setting, climate, grade comparison, cost and budget band, hard filters and ranking, deadline risk and back-planning, round robin, domain allowlist) and 27 tests mapped to acceptance scenarios 1–12 and 16. All pass.
  - Terms check: Open-Meteo free API is non-commercial only, data CC BY 4.0 (attribution in the footer); Frankfurter software is MIT and rates fall under each provider's terms (ECB disclaimer). Both acceptable for the prototype.
- Rework, dead ends: one test assumed the wrong New York date on the day US daylight saving ends; the test was fixed, not the code. Pushing from this session is refused (no GitHub write access); the branch is handed over as a git bundle for the user to push from the MacBook.
- Blockers: npm registry blocked here (Next.js, Convex and others cannot be installed until package managers are allowed in claude.ai Settings → Capabilities); GitHub push access.
- Approx. minutes (user):
- Effectiveness 1–5 (user):
- How the output reached the project: commits on the `langkah` branch.

### 2026-10-24 — Auth change and interview record (Claude Code)
- The user created the Convex project. The user could not create a Clerk account, so authentication moves to Convex Auth (beta; acceptable for a prototype; one less account; more of the product on Convex). Spec section 6.1 updated.
- The user reported interviewing about 20 Indonesian transfer students at UC Berkeley about what would make finding universities abroad easier. Recorded in `docs/research/interviews.md`; details (when, how, what they said, what changed) still to be supplied.
- Approx. minutes (user):
- Effectiveness 1–5 (user):

### 2026-10-24 — WP1: Next.js, Convex, Convex Auth, access control, files, job table (Claude Code, MacBook)
- Stage: code generation.
- Tools used and why: Claude Code on the MacBook (npm works here); `create-next-app` for `apps/web`; Convex CLI with a temporary local anonymous deployment because the Convex CLI is not yet logged in on this Mac; `convex-test` + Vitest for backend tests.
- What was done:
  - Docs switched from Clerk to Convex Auth everywhere it still appeared (CV-2, test-demo-setup 3.1, engineering detail, design delta, readme-first).
  - npm workspaces: root holds `convex/`, `apps/web` is Next.js 16.4 (App Router, Tailwind 4, `proxy.ts` instead of the deprecated `middleware.ts`).
  - `convex/schema.ts` with all tables from the engineering detail; Convex Auth (password); roles (sign-up is always student, counselor only via internal admin function); access helpers; profiles with history and append-only qualification records; round-robin counseling; messages; private files with server-side signature checks and an authenticated download HTTP action; job table with leases, retries, idempotency and a one-minute sweeper.
  - Minimal working web shell (sign-in, student: counseling, messages, files; counselor: assigned students, case, shared files). Indonesian default with an English toggle. Not the final design.
  - `scripts/setup-auth-keys.mjs` sets the Convex Auth signing keys on the deployment without printing them.
- Verified: 31 rule tests and 26 Convex tests pass; type checks pass for root, `convex/` and `apps/web`; `next build` succeeds; `scripts/e2e-wp1.mjs` passed 18/18 against the local backend (real sign-up, role cannot be self-assigned, round robin, unassigned counselor and other student denied, upload, download 200/401/404, share/unshare, CORS); Next `/api/auth` sign-up sets session cookies and `/` loads signed in. Sabotaging the file access check made 2 tests fail, so the tests detect it.
- Not verified: clicking through the web shell in a real browser; anything on the real "langkah" Convex project (needs `npx convex login` by the user).
- Rework, dead ends: `@auth/core` 0.37 conflicted with Convex Auth 0.0.96 (needs 0.41); Convex mutations cannot read blobs, so signature checks moved to scheduled actions; throwing after deleting a blob would roll the delete back, so upload rejections return an error instead; `@next/env` ignored the root `.env.local`, replaced by `process.loadEnvFile`.
- Approx. minutes (user):
- Effectiveness 1–5 (user):
- How the output reached the project: commit on the `langkah` branch.

### 2026-10-24 — Student intake (screen 1, PROF-001) (Claude Code, MacBook)
- Stage: code generation.
- Prompted by the user asking about "the initial survey the user needs to fill out".
- What was done: a four-step intake at `/intake` following the mock's journey (study preferences, Indonesian school results, English tests, review). Saved per step to Convex so students can leave and resume; every answer except destination country can be "don't know yet"; a counselor can be requested from any step without leaving the form. New students are sent to the intake after sign-up; the dashboard links back to it. Indonesian default, English toggle. Backend: new fields (related fields, climate choice, intake term, school type, class, completion time), language evidence per test, server-side validation of majors, budget, currency, intake year, grade scale and test scores.
- Verified: 5 new Convex tests (31 total); a headless Chrome click-through on the real dev deployment passed 13/13 (sign-up → intake, out-of-scale grade refused with an Indonesian message, counseling from the intake, review shows saved answers, answers survive reload, English toggle, finish → dashboard, no horizontal scroll at 375 px, no console errors).
- Rework: the first browser run showed server error messages in English inside the Indonesian form; grade checks now run in the browser first with localized messages, and the server still checks.
- Not done: the visual design (comes from Figma); the dashboard does not yet show discovery results (needs ingestion and ranking).
- Approx. minutes (user):
- Effectiveness 1–5 (user):

### 2026-10-24 — Decision: Bitdeer dropped, extraction moves to Claude
- The user asked to skip Bitdeer. Claude explained the cost (the Bitdeer prize track is no longer entered) and the user confirmed.
- Structured extraction now uses the Claude API with the same strict JSON schema and deterministic validator. Updated: spec (stack, diagram, ingestion steps, data model, sponsor summary, checks, risks; Appendix B row marked "not entered"), sponsor requirements (BT-* kept as engineering requirements), engineering detail, test/demo setup (no Bitdeer key), readme-first, award evidence plan.
- Keys still needed for the data pipeline: Bright Data (key and two zone names), Apify token, Anthropic key.

### 2026-10-24 — Bright Data early live check (BD-7) (Claude Code)
- Stage: integration test.
- The user created the Bright Data key and zones and set the key with `npx convex env set … "$(pbpaste)"`. Two extra copies of the key had been stored (one pasted twice, which would have broken requests); Claude checked their shape without printing values and removed them, since one key serves both zones.
- Ran `scripts/check-brightdata.mjs` on all 12 institutions: 21/24 searches found an official page (after adding retries); 19/21 pages fetched plainly, 20/21 through Web Unlocker; one page (Penn State Harrisburg tuition) needed Web Unlocker; no Web Unlocker policy blocks. Details and pipeline consequences: `docs/research/brightdata-check-2026-10-24.md`.
- Rework: the first run found only 14/24 because the SERP zone intermittently returns empty bodies, timeouts, unrelated results or redirect links; retries fixed it.
- Approx. minutes (user):
- Effectiveness 1–5 (user):

### 2026-10-24 — Apify Actor and Convex collection (WP3, first half of WP4) (Claude Code)
- Stage: code generation and integration test.
- The user set `APIFY_TOKEN` (free plan, $5/month). Claude logged the Apify CLI in with it from the Convex environment, stored the Bright Data key as an Actor secret, and pushed `langkah-crawler`.
- Built: the Actor (queue, de-duplication, same-site link following, retries with backoff, Web Unlocker fallback, cleaned text, SHA-256, per-page status) and Convex collection (async start with webhook, secret webhook path, run confirmed through the Apify API, idempotent storage, unchanged/changed detection, polling backup). Convex variables set by Claude: `APIFY_ACTOR_ID`, `APIFY_WEBHOOK_SECRET` (generated, never displayed).
- Verified live: smoke run used both fetch paths; a Convex-started run was announced by webhook in about 20 s and stored; hand replays added nothing; wrong secret 404; a repeat crawl found all 5 pages unchanged. Tests: 37 rule/crawler, 36 Convex. Evidence: `docs/sponsors/apify.md`.
- Rework, dead ends: Apify rejected the first build (input fields need descriptions); unit tests caught a URL de-duplication bug and text-cleaning bugs; `convex-test` cannot run two file-writing actions at once, so the replay test delivers notifications one after another.
- Approx. minutes (user):
- Effectiveness 1–5 (user):

### 2026-10-24 — Decision: no Claude API; rule-based extraction and template explanations
- The user decided not to pay for the Claude API. Claude laid out the consequences (extraction, explanations and voice replies lose their AI step; the Anthropic track is not entered) and proposed deterministic extraction rules plus template explanations built from verified records; the user agreed.
- Docs updated: spec (stack, diagram, ingestion steps, triggers, explanation contract, voice, checks, Appendix B row), sponsor requirements (BT-* and AN-* rewritten; AN-1/3/4 no longer apply), engineering detail, test/demo setup, readme-first, award evidence plan (Anthropic not entered; named community and interviews kept for Microsoft).
- Possible later: Factory's own model could add AI extraction if a Factory account with credits becomes available.

### 2026-10-24 — Rule-based extraction (WP4, second part) (Claude Code)
- Stage: code generation and live data test.
- Full first-batch crawl (Apify run `RbrzvoWlrVg6pNPPg`, started from Convex): 144 new pages, 3 unchanged, 3 failed; announced by webhook.
- Built `convex/lib/extract/rules.ts` (costs with table-column and section awareness, English test minimums, Indonesian grade statements, deadlines with rounds, times and timezones) and `convex/extraction.ts` (runs automatically after each crawl, records an ExtractionRun with the rule version and validator counts, stores `candidates`). Every candidate's excerpt is verbatim in the stored page; a deterministic validator rejects anything else. Tests use three real pages saved as test-only fixtures.
- Precision check (BT-7) on all 149 stored pages with rules version 3: 389 candidates; 18 "ready", 371 "needs confirmation", 0 rejected. Of the 18 ready: 7 MSU international costs, 2 IELTS minimums (Sheffield 6.0, Loughborough 6.5) and 9 Manchester/UCAS dates are correct; one of the dates is a university decision date rather than an applicant deadline. Most "needs confirmation" reasons: page does not say the cost applies to international students (183), period not stated (171), totals/savings rows (82).
- Rework found by reviewing real output, each fixed and covered by a test: Bath placement-year fees were first marked as tuition; Penn State totals were labeled housing; "IELTS 6.0" was missed because sentence splitting broke on the decimal point; a footnote ("per semester") bled into the next table's period; US out-of-state rates were wrongly treated as international (now their own category); master's scholarship deadlines passed because of a curly apostrophe.
- Limits: coverage is low (most pages state costs without saying who pays them); program-level matching (which candidate belongs to which program) is the next step.
- Approx. minutes (user):
- Effectiveness 1–5 (user):

### 2026-10-24 — Catalog: institutions, programs, published facts (Claude Code)
- Stage: code generation and live data.
- `config/institutions.json` (12 institutions, main campus town; setting stays unclassified until GeoNames evidence). Program discovery at runtime: 24 Bright Data SERP queries from Convex (`catalog:discoverPrograms`), 22 found official pages (Exeter CS hit repeated empty responses; Manchester CS had no result on its own domain); 66 URLs collected by the Actor (run `Ef5SoHm1BUewwwdvr`).
- Programs are identified from page titles by rule (`convex/lib/catalog/programs.ts`): bachelor's degree + major required; listing pages, foundation/transfer variants and other Penn State campuses excluded; pages about the same program merged by subject and degree family. Result: 28 programs (19 single-subject, 9 joint) across all 12 institutions.
- Facts are published from ready candidates (`catalog:publishFacts`): program scope when the fact is on the program's page or its row names the program; institution scope otherwise; institution-wide tuition withheld when several amounts exist; conflicting English minimums withheld; course-specific rows never become institution-wide; duplicates published once; facts removed when their candidate disappears. Runs automatically after each crawl's extraction. Program view (`catalog:listPrograms`) lists unknowns explicitly.
- Live result: 11 cost items, 18 requirements, 7 deadlines. Programs with international tuition 4/28, English minimum 15/28, application deadline 3/28; grade requirement for Indonesian students unknown for all (no ready rule yet).
- Rework found in review, each fixed with a test: Bath listing pages repeated English requirements hundreds of times (now de-duplicated); Lancaster's vertical fee table gave the Home fee the "International" label (positional matching added); duplicate programs from catalog and department pages; "CS Major" marked joint; a fee row for an uncatalogued course became institution-wide tuition; a `go.wisc.edu` short link redirected to US News through Web Unlocker and was stored as official (Actor now checks the page's declared canonical address; source rejected).
- Approx. minutes (user):
- Effectiveness 1–5 (user):

### 2026-10-24 — Ranking and discovery on real data (Claude Code)
- Stage: code generation and browser test.
- Exchange rates: `convex/fx.ts` fetches Frankfurter (ECB reference rates) daily; first rates dated 2026-10-23. Conversions show the rate date and source; missing rate → "conversion unavailable".
- Campus setting and climate: `scripts/enrich-campuses.mjs` uses GeoNames cities1000 (CC BY 4.0) for the configured campus town's population and coordinates, and Open-Meteo historical weather 2015–2024 (CC BY 4.0) for annual and coldest-month mean temperature; Convex classifies with the config thresholds. Result: 6 city, 5 countryside, Loughborough unclassified (64,884, between thresholds); 6 mild, 4 cool, 2 cold. Assumption recorded: the configured campus town stands in for geocoding the campus address.
- `discovery:forMe` applies the country and setting hard filters and the lexicographic ranking from `config/ranking.json` to the 28 catalog programs, with the student's budget converted from IDR. Grades are "needs confirmation" for every program because no validated Indonesian grade rule exists yet.
- Screens: `/discover` (ranked list with the four band chips, converted costs, missing cost parts, rate date/source, unclassified count) and `/programs/[id]` (campus evidence, every fact with its excerpt, source, retrieval date and fetch method, explicit unknowns). The intake now ends on `/discover`.
- Verified: headless Chrome on the dev deployment 11/11 (fictional Nadia: CS programs first, economics listed as "other major", MSU "slightly over budget" from its full published international costs, Lancaster "within budget (costs incomplete)", countryside filter shows 7 programs and "4 hidden"); 3 new Convex tests (44 total), 52 rule tests.
- Approx. minutes (user):
- Effectiveness 1–5 (user):

### 2026-10-24 — Coverage pass (Claude Code)
- Stage: live data and rule fixes.
- `catalog:discoverTopics` runs topic searches through Bright Data (international costs, application deadlines, and retries for missing programs) and starts one Actor run per batch. Three runs: costs/deadlines (24 searches, 23 found, 31 new pages), US economics (5 searches, 4 found, 6 pages), Exeter/Manchester CS (2 found, 3 pages). Penn State costs failed with the SERP zone's plain-text "This query…" error after 3 attempts; Illinois economics had no official result.
- Result: 35 programs (was 28; added Penn State Economics BS/BA, Wisconsin Economics, Dartmouth Economics, Exeter and Manchester CS, Exeter CS & Mathematics). Programs with an upcoming application deadline 13 (was 3), English minimum 16 (was 15), international tuition 4 (unchanged after a false Exeter value was removed), living costs 1 (MSU).
- Review of every newly published value found wrong ones; each fixed with a test: Exeter's "£25,000" was the student-loan repayment threshold; Bath's "1 August 2021" came from "due to"; Manchester/Lancaster/Sheffield dates were from the previous cycle or a range start (extraction now uses the retrieval date and flags past dates and "between X and" starts); Wisconsin's date was for a spring start; Northeastern's living-cost alternatives (on/off campus, per term vs per year) would have been added together (institution-wide living costs now require a published tuition figure from the same page); Exeter's £25,700–£49,300 "fee" amounts are course tuition (large amounts labelled only "fee" need confirmation); Bath's £100 printing estimate counted as living costs (course extras excluded).
- Remaining gap: US tuition. US pages give in-state/out-of-state rates without saying international students pay the out-of-state rate, so it stays "needs confirmation" by design.
- Approx. minutes (user):
- Effectiveness 1–5 (user):

### 2026-10-24 — Saved programs, plans, dashboard and workspace (Claude Code)
- Stage: code generation and browser test.
- `convex/lib/plan.ts` builds a personal plan from verified facts only: the main official deadline (earliest upcoming standard round; scholarship, reply and past dates skipped), the English test chain back-planned from it with the config lead times (book → test or retake → results → send scores; every recommended date labeled as a planning assumption, and that no separate score deadline is published), a grade-confirmation task, and "find the deadline" when none is verified. Steps without a source (e.g. recommendations) are not added.
- `convex/applications.ts`: save (idempotent; queues an `application_research` job for the agent worker), remove, list with aggregated next actions and deadline risk (engineering-detail 7.4), forward-only task status with explicit student correction, student-entered dates, overdue computed from official dates only. Owner and assigned counselor can read; others cannot.
- Screens: "Save program" on results and program pages; dashboard "Next steps" and "Saved programs" with risk; workspace `/applications/[id]` with the timeline (official dates solid, recommended dashed, "recommended date has passed" flag), statuses, own dates, assumptions and the program's official dates with sources. Task titles render in Indonesian or English from the plan step.
- Bugs found in the browser test and fixed: published timezone wording ("UK time") crashed the risk calculation (now mapped to IANA names; unknown wording uses the conservative earliest timezone); task titles and an error message appeared in English on Indonesian pages.
- Data finding: Lancaster's page says "For courses starting in 2026 … the deadline is 13 January 2027", which contradicts itself. Dates later than the entry year a sentence names are now flagged, so Lancaster programs show "deadline not verified" instead of a doubtful date.
- Verified: 60 rule tests, 48 Convex tests; headless Chrome 10/10 (save from results, dashboard next steps in Indonesian, Manchester's verified 13 Jan 2027 UCAS deadline with "tight" risk, Lancaster without a verified deadline, workspace statuses and forward-only refusal).
- Approx. minutes (user):
- Effectiveness 1–5 (user):
