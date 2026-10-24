# University Adviser — Sponsor Track Requirements as App Requirements

Version: 0.1
Date: October 24, 2026
Status: Draft for review. Turns the sponsor track criteria (supplied by the user; recorded in spec-v1.0.md Appendix B and `archive/technology-and-award-requirements.md`) and the vendor feasibility findings into testable technical requirements for the app. The track criteria are treated as binding design inputs; the event's own rules page was not seen.

Each requirement has an ID and a verification test. "Must" is a requirement. Items marked RISK come from vendor documentation research and need an early live test once accounts are ready.

Process-evidence requirements (Figma, Mana, Notability documentation) are in award-evidence-plan.md and are not repeated here, except where they affect the app.

## 1. Apify — a custom Actor is mandatory

| ID | Requirement | Verification |
| --- | --- | --- |
| AP-1 | A custom Apify Actor built for this project lives in the repository with an input schema, dataset schema, README and usage instructions. | Actor runs from `apify run` and on the Apify platform. |
| AP-2 | All catalog and timeline collection goes through the Actor. No second scraping path may feed the catalog. | Code search finds no other fetcher writing to the catalog; every `SourceRecord` carries an Apify run ID. |
| AP-3 | The Actor must do real orchestration: request queue, de-duplication, same-domain link following with a depth limit, retries with backoff, text cleaning, content hash, and per-page status (ok, blocked, empty, timeout, changed). Output is a source package per page with URL, retrieval time, status, and cleaned text. | Run on a test URL set that includes a dead link, a duplicate and a redirect; dataset shows each status. |
| AP-4 | The Actor retrieves pages through Bright Data Web Unlocker when a plain fetch fails (see BD-2). Bright Data credentials are passed to the Actor as secrets, never in input logs. | Run log shows which path each page used; no secret in logs. |
| AP-5 | Convex starts Actor runs asynchronously and learns of completion through a webhook, with polling as backup. It never uses the synchronous run endpoint (5-minute limit). | A run longer than 5 minutes completes and is ingested. |
| AP-6 | The webhook endpoint is an HTTP action on an unguessable path with a shared secret, returns 2xx quickly, and is idempotent (Apify retries up to 11 times and can duplicate). | Replaying the same webhook twice creates one ingestion. |
| AP-7 | Every run is recorded (run ID, input, status, page counts, errors, cost if available) and visible in the app's evidence view. | `ExtractionRun` rows exist for each run. |
| AP-8 | The Actor is publish-ready for the Apify Store (README, schemas, logo, description, sample output). Publication and any separate Best Actor entry are decided at submission after checking conditions. | Store-readiness checklist passes. |
| AP-9 | Usage stays within the free plan or sponsor credits ($5/month on the free plan per Apify pricing). | Cost log per run; collection batch sized to budget. |

## 2. Bright Data — live data is essential

| ID | Requirement | Verification |
| --- | --- | --- |
| BD-1 | Discovering official pages for a program or institution at runtime uses the Bright Data SERP API. Without a working Bright Data key, researching a new program must fail visibly rather than silently use stale or invented data. | Disable the key: research for a new program shows a clear error. |
| BD-2 | Pages that fail a plain fetch are retrieved through Web Unlocker. Each source record notes which method succeeded. | Log shows both paths used on the test set. |
| BD-3 | Public pages only: no login or paywall content, no non-public personal data. Collection is limited to an allowlist of official domains (university, application portals, government sources used for immigration and application routes). | Domain allowlist enforced in the Actor; test with a login-gated URL is rejected. |
| BD-4 | Handle blocks, slow responses and empty results: client timeout of at least 180 seconds, retries with backoff for retryable codes, no retry for robots or policy blocks, and a visible per-source state. | Fault-injected test URLs produce the expected states. |
| BD-5 | Product consequence is visible: for a refreshed source, the UI shows source URL, retrieval time, extracted values, and what changed in the student's advice or timeline. | Demo script step: refresh a source and show the change. |
| BD-6 | Cached data and newly retrieved data are labeled differently. No mocked or hardcoded results appear as live. | UI badge test; code review for hardcoded university data. |
| BD-7 | RISK: Web Unlocker may return policy blocks for some public university domains before account verification, and obeys robots.txt. Run a 10-URL live test per country as the first technical check. If a domain is blocked, record it in coverage status and use plain fetch in the Actor for it, never an unofficial source. | Test result recorded in the devlog. |

## 3. Structured extraction (rule-based; Bitdeer and Claude dropped)

Bitdeer was dropped on 2026-10-24 (user decision), then the Claude API as well. On 2026-10-24 the user decided not to use the Claude API (cost): extraction is rule-based code and explanations are templates built from verified records. The Anthropic track is not entered. The IDs are kept so references stay valid; these are engineering requirements now, not a sponsor track.

| ID | Requirement | Verification |
| --- | --- | --- |
| BT-1 | Extraction of program, cost, grade-policy and milestone fields from page text uses deterministic rules in code, producing the candidate-record schema. | Every `ExtractionRun` records the extractor rule version. |
| BT-2 | Each extracted field carries a verbatim evidence excerpt. A deterministic validator rejects any field whose excerpt is not found in the source text, or whose institution, campus, intake, or applicant-type scope is unclear. | Test pages with planted wrong values are rejected. |
| BT-3 | Extraction runs in bounded batches so a large crawl cannot exceed Convex action limits. | 150-page run completes without dropped records. |
| BT-4 | Results from several pages about the same program are merged with conflicts preserved. | Test on a long requirements page. |
| BT-5 | Unknown values stay unknown; the model must be able to return null with a reason. | Schema allows null and tests confirm no filled-in guesses. |
| BT-6 | UI and docs show source text → extracted fields → saved record. | Evidence view for one record. |
| BT-7 | Rule precision is measured on real stored pages before ingestion runs at scale; rules that produce wrong values are fixed or removed. | Precision check on the first-batch pages, recorded in the devlog. |

## 4. Convex — backend, data and access control

| ID | Requirement | Verification |
| --- | --- | --- |
| CV-1 | All persistent application state lives in Convex, and the UI reads through reactive queries. | No other database in the repository. |
| CV-2 | Authentication through Convex Auth (password sign-in; beta, accepted for the prototype after Clerk was dropped on 2026-10-24). The `users` table holds role (student, counselor); sign-up always creates a student, and the counselor role is granted only by a server-side admin function. Every public function checks identity and role first. | Automated tests: student A cannot read student B; unassigned counselor cannot read any student. |
| CV-3 | Student files are stored in Convex storage but are never served through public storage URLs. Downloads go through an authenticated HTTP action that checks owner or an explicit share. | Test: a copied file URL does not work for another user. |
| CV-4 | Scheduled functions and actions are at-most-once with no automatic retry. A job table with status, attempts, idempotency key and last error provides retry and recovery. | Kill an action mid-run; the job is retried once and not duplicated. |
| CV-5 | Round-robin assignment: one mutation reads and advances the rotation pointer. | Two simultaneous requests get different counselors. |
| CV-6 | The Node worker (Factory) subscribes to the job queue through the Convex client using a service credential with narrow permissions. | RISK: prototype first; the service-credential pattern is the least documented piece. |
| CV-7 | Deletion: student-requested deletion removes records, messages and stored files, and a retention job enforces the configured period (default 10 years). | Delete test leaves no orphan files. |
| CV-8 | Schema and access rules are documented in `docs/sponsors/convex.md`. | Doc exists and matches code. |

## 5. Grounded explanations (templates; Anthropic track not entered)

On 2026-10-24 the user decided not to use the Claude API (cost): extraction is rule-based code and explanations are templates built from verified records. The Anthropic track is not entered. AN-1, AN-3 and AN-4 no longer apply.

| ID | Requirement | Verification |
| --- | --- | --- |
| AN-2 | Explanations are built only from verified records with IDs and cite them. A missing record renders "needs confirmation"; no date, amount or conversion appears that is not in a cited record. | Test: unsupported deadline or GPA conversion shows "needs confirmation". |
| AN-5 | The named community (Indonesian high school students applying to US/UK undergraduate programs) appears in the README and product copy. Failure modes are documented in `docs/failure-modes.md`. | Docs exist. |
| AN-6 | Retrieved web content is untrusted data, never instructions. | Prompt-injection test page. |

## 6. Factory Droid SDK — bounded agent work

| ID | Requirement | Verification |
| --- | --- | --- |
| FD-1 | Trigger: a student saving a program or requesting updated research creates an `agentJobs` row. A worker process picks it up with the Droid SDK. | Job moves from queued to done. |
| FD-2 | Bounded tools: Droid gets only in-process custom tools: `fetchOfficialPage` (domain allowlist enforced in our code), `readProgramRecords`, `proposeChecklist`, `proposeResearchNote`. Built-in shell and file-editing tools are disabled; autonomy is read-only or low. The SDK has no allowlist feature, so the disabled-tool list is verified with `listTools`. | Test: the agent cannot run a shell command or fetch a non-allowlisted URL. |
| FD-3 | Droid writes only proposals. It cannot change student records, send messages, or mark uncertainty resolved. | Permission test. |
| FD-4 | Plan, steps, tool calls and results stream into an `AgentRun` record, shown in the UI with the resulting checklist and unresolved questions. | Demo shows execution history. |
| FD-5 | Failures (timeout, tool error, partial result) leave the job in a visible state and never overwrite prior data. | Fault test. |
| FD-6 | Demo runs the worker on the MacBook. A Linux-container (glibc, not Alpine) path is documented. A paid Factory key is required. | README section. |

## 7. Atlassian Forge — counselor automation

| ID | Requirement | Verification |
| --- | --- | --- |
| AT-1 | A Forge app (Node 22 or 24) is deployed and installed on a Jira developer site. | `forge install` succeeds and the app appears in Jira. |
| AT-2 | Convex notifies a Forge web trigger on: counselor assigned, verified deadline change affecting an assigned student, Needs-confirmation grade case, and at-risk required document. The handler checks a shared secret, uses app permissions, returns well within 55 seconds, and is idempotent. | Replayed event creates one Jira item. |
| AT-3 | Forge creates or updates a Jira work item per student application, with counselor assignee, priority from deadline risk, and a link back to the app. Issues carry opaque IDs only, no documents or sensitive student data. | Review of created issues. |
| AT-4 | Each automated action records source, reason and time. | Audit view in Jira and app. |
| AT-5 | A scheduled trigger produces a summary of urgent actions per counselor, and doubles as a polling fallback if inbound triggers fail. | Digest appears in Jira. |
| AT-6 | Counselor workload reduction is measured, for example items created automatically versus manually. | Metric in the demo. |
| AT-7 | RISK: the Atlassian track page was not found. If the official track requires Rovo agents, add a Rovo agent module to the same Forge app. Note that external egress and dynamic triggers forfeit the Runs on Atlassian badge. | Decision recorded after the rules are read. |

## 8. Cartesia — voice is core

| ID | Requirement | Verification |
| --- | --- | --- |
| CA-1 | Speech-to-text uses `ink-whisper` set to Indonesian. Text-to-speech uses `sonic-3.6` with Indonesian voices. RISK: test `ink-whisper` with recorded Indonesian speech (school, subject and program names) and confirm streaming before building around it. Fallback: browser speech recognition, recorded honestly. | Test result in the devlog. |
| CA-2 | The browser uses short-lived access tokens issued by the server; the API key never reaches the client. The Cartesia API version is pinned. | Network inspection. |
| CA-3 | Voice completes a real task, not just reading text aloud: voice intake fills profile fields with spoken confirmation, and the student can ask for the next deadline or program comparison from the same records as text. | Demo flow. |
| CA-4 | States and handling: microphone permission, listening, thinking, speaking, unclear speech, error, interruption (cancel the current speech), and a text fallback with visible transcript. | Manual test list. |
| CA-5 | Voice is off by default, with a notice that audio is processed by the speech provider. | UI check. |
| CA-6 | Free tier allows one concurrent request; the demo avoids parallel sessions. No keys in the repository. Short README with setup, features and limitations. | README review. |

## 9. Microsoft — production-minded agent

| ID | Requirement | Verification |
| --- | --- | --- |
| MS-1 | The app records measurable events: time from intake to a sourced shortlist, share of displayed facts with verified sources, counselor items created automatically, and cases left at Needs confirmation. | Metrics table filled from real demo runs only. |
| MS-2 | Responsible design is visible: uncertainty labels, no admission guarantees, per-user access control, student-triggered deletion, bounded agents, and human review of application submissions. | Documented in README. |
| MS-3 | A production-path document covers hosting, scaling, costs, monitoring and what changes beyond the demo. | `docs/production-path.md`. |

## 10. Figma, Mana, Notability (affect the app only here)

| ID | Requirement | Verification |
| --- | --- | --- |
| FG-1 | The design system and screens are created before the matching code. Component names map to code components. Material changes found in implementation are reflected back in Figma. | Mapping table in `docs/design-handoff.md`. |
| FG-2 | Claude's Figma write access is checked first. If missing, the smallest manual steps are listed and the limitation is recorded. | Result in the devlog. |
| MN-1 | At least one real Mana task whose output is used, with a demo moment (see award-evidence-plan.md). | Public page link. |
| NB-1 | Real notes made during development (see award-evidence-plan.md). | Dated notes. |

## 11. Cross-cutting

| ID | Requirement | Verification |
| --- | --- | --- |
| X-1 | Every integration must be used in the running product or in the required development process. A mention in the README alone does not count. | Each sponsor has a `docs/sponsors/<name>.md` with trigger, contract, run example and limits. |
| X-2 | No secrets in the repository, client code, logs, screenshots or recordings. | Secret scan before submission. |
| X-3 | An evidence view in the app lets a reviewer see, for any shown fact: source URL, retrieval time, Apify run, extractor rule, validator result. | Used in the demo. |
| X-4 | Demo uses fictional students with real public university data, labeled. A reset script restores the demo state. | Reset test. |
| X-5 | Failures in any external service keep the student's input and show an actionable message. | Fault tests per service. |

## 12. Early technical checks (build phase, once accounts are ready)

1. 10 real US and 10 real UK university URLs through Bright Data Web Unlocker (BD-7).
2. A small Actor run on the same URLs, reaching Convex through a webhook (AP-3 to AP-6).
3. Rule-based extraction precision on the stored first-batch pages (BT-1, BT-7).
4. `ink-whisper` with recorded Indonesian speech (CA-1).
5. Node worker connecting to Convex with a scoped credential (CV-6).
6. Droid SDK custom-tool-only run, confirming built-in tools are disabled (FD-2).
7. Forge web trigger invoked from Convex, creating a Jira item (AT-2).
8. Figma write access check (FG-2).
