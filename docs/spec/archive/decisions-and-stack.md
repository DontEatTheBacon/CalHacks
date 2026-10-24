# University Adviser — Decisions, Stack, and Proposals

Version: 0.3
Date: October 24, 2026
Status: Resolves open items from implementation-spec.md section 18. Items marked PROPOSED need the user's yes; items marked CONFIRMED came from the user.

Superseded: this file is source history. `spec-v1.0.md` is the authority; where the two differ (for example authentication, ranking details, voice, the first institution batch, and the term "Spike 1"), follow `spec-v1.0.md`.

Companion to implementation-spec.md (which remains the authority for everything not changed here).

## 1. Confirmed decisions

| Topic | Decision |
| --- | --- |
| Sponsor technologies | All third-party technologies are used so the project can qualify for each award. They drive the stack. |
| Demo hosting | Runs on the user's MacBook or a hosted deployment. Both must work. |
| Counselor assignment | Round robin. |
| Setting classification | Rule defined in a config file (section 4). |
| Retention | Student files and records are kept for 10 years (flag in section 8). |
| Credentials | All third-party accounts and API keys are already set up by the user. |
| Exchange rates | Free service, no model estimates (section 6). |
| Equivalency sources | Collected by the agent pipeline (Bright Data + Apify + Bitdeer), with the limits in section 5. |

## 2. Stack (PROPOSED)

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (App Router) + TypeScript + Tailwind, with i18n for Indonesian and English | Fits Convex's React client; Indonesian UI from the start. |
| Backend and database | Convex (queries, mutations, actions, scheduled functions, HTTP actions) | Required sponsor; also runs the pipeline orchestration. |
| Auth | Convex Auth, with a `role` field (student, counselor) | Avoids adding another vendor. |
| File storage | Convex file storage, private, access checked in server functions | Keeps ownership and sharing rules in one place. |
| Hosting | Convex cloud for the backend; Next.js on Vercel for judge access, or `localhost` on the Mac for recording | Convex exposes public HTTPS endpoints, so Apify, Forge and the agent worker can reach the backend even when the frontend runs on a laptop. |
| Agent worker | Small Node process running the Factory Droid SDK, started on the Mac | Droid needs a process environment; it subscribes to a Convex `agentJobs` queue. Production path: the same worker in a container. |
| Claude API | `@anthropic-ai/sdk` called from Convex actions | Explanations, clarifying questions, plans, drafts. |
| Voice | Cartesia STT + TTS, browser-side, with a Convex action issuing short-lived tokens | Server key never reaches the browser. |
| Counselor app | Atlassian Forge app on a Jira demo site | Required sponsor. |

### 2.1 Division of labor in the data pipeline

The risk in the spec is that Bright Data and Apify look redundant. Proposed split so each does real work:

1. **Bright Data SERP API** discovers candidate official pages (program, tuition, Indonesia/international requirements, deadlines, scholarships).
2. **Apify Actor** (built for the event) takes the URL list and handles crawl orchestration: queueing, de-duplication, link-following to related pages, retries, page-text cleaning, and structured dataset output with run logs. For pages that block ordinary fetches, the Actor calls **Bright Data Web Unlocker**.
3. **Bitdeer Model Studio** extracts typed candidate fields from the cleaned text, each with a verbatim evidence excerpt.
4. **Validation** (deterministic code) rejects any field whose excerpt does not appear in the source text, or whose scope (institution, campus, intake, applicant type) is unclear.
5. **Convex** stores validated, versioned records with provenance.

Spike 1 (first build task) is a vertical slice for one US and one UK program to confirm this wiring works before building anything wider.

### 2.2 Triggers

- Convex scheduled function or student action → Apify Actor run → Convex HTTP action receives the completion webhook.
- Program saved → `agentJobs` row → Factory worker picks it up → proposed checklist written back through a narrow mutation.
- Counselor assigned or verified deadline change → Convex action calls a Forge web trigger → Forge creates or updates Jira work items.
- Forge calls back into Convex only through declared egress and a scoped secret.

### 2.3 Factory worker boundaries

- Read: allowlisted official source URLs and the specific program and student-application rows it was assigned.
- Write: `proposeChecklist` and `proposeResearchNote` mutations only. It cannot edit student records, send messages, or mark uncertainty resolved.
- Every run writes an `AgentRun` with steps, sources and outcome.

## 3. Ranking (PROPOSED)

Replaces the "proposed default" in DISC-004. It is lexicographic with banded outcomes, not a weighted sum. No numeric weights, so nothing is invented, and every position can be explained in a sentence. There is no match percentage.

Programs are sorted by these keys, in order. Within a key, outcomes are listed best to worst.

| Priority | Key | Outcomes (best → worst) | How computed |
| --- | --- | --- | --- |
| 1 | Major relevance | Direct → Related → Other → Unknown | Program is classified into an internal major taxonomy (Bitdeer proposes with evidence; mapping table in config, anchored to CIP for US and HECoS for UK). Direct = in the student's chosen majors; Related = same broad field. |
| 2 | Academic status | Meets published minimum → Needs confirmation → Subject gap → Below published minimum | From the grade comparison engine (section 5). Unknown is never ranked as Below. |
| 3 | Budget fit | Within budget → Within budget (costs incomplete) → Unknown → Slightly over → Over | Annual estimate = tuition + mandatory fees + institution living estimate when published. "Slightly over" is within a configurable percentage, default 15%. Currency conversion only with a sourced rate (section 6). |
| 4 | Climate fit | Match → Partial → Unknown → Mismatch | Campus climate normals compared to the student's preference bands (section 7). |
| Tie-break | Lower known annual cost, then program name | Deterministic and stable. |

Notes:

- Unknown sits between good and bad outcomes on purpose: missing data is neither rewarded nor treated as a failure. It is shown with a badge.
- A lexicographic order means a Direct-major program that the student is below the minimum for still ranks above a Related-major program they meet. That follows the confirmed priority order. The academic status is always displayed on the card, and the student can re-sort by cost or academic status.
- Nothing is hidden by ranking. Only country and setting filter (DISC-001, DISC-002).
- The key order, outcome bands and the 15% threshold live in `config/ranking.json` and are covered by unit tests.

## 4. Setting classification (PROPOSED, config-driven)

Applies to the program's teaching campus (DISC-002).

Rule:

1. Geocode the campus address (from the official source) to coordinates.
2. Find the nearest settlement in the GeoNames cities dataset (free, CC-BY, includes population) within a configured radius.
3. Classify by that settlement's population.

```jsonc
// config/setting.json
{
  "cityMinPopulation": 100000,          // at or above → "city"
  "countrysideMaxPopulation": 50000,    // at or below → "countryside"
  "settlementSearchRadiusKm": 15,
  "betweenThresholds": "unclassified",  // "unclassified" | "city" | "countryside"
  "overrides": [
    // { "campusId": "...", "setting": "countryside", "reason": "...", "sourceUrl": "..." }
  ]
}
```

- Between the two thresholds the default is `unclassified`: not matched by either filter, and the count of unclassified programs is shown ("12 programs need classification"). Setting the two thresholds equal makes the rule binary.
- Every classification stores the settlement used, its population, the dataset version, and the config version, so it is explainable and recomputable.
- Overrides require a reason and a source.
- Online-only programs have no campus setting and stay `unclassified`. Programs with multiple campuses are classified per campus.
- Thresholds are placeholders to review, not an official definition of "city".

## 5. Indonesian grade equivalency (PROPOSED handling)

Agreed: the agent pipeline collects equivalency policies. Limits that keep it honest:

1. **What the pipeline looks for:** each institution's published pages on Indonesian or international qualifications (Indonesian SMA/SMK, Kurikulum Merdeka, K13, IB, Cambridge A-Level), plus official UK and US national sources where applicable (for example UK ENIC for general comparability, labeled "general guidance, not institutional acceptance").
2. **What gets stored:** a `GradeEquivalencyRule` only when the extraction includes a verbatim excerpt, the institution and qualification it applies to, the intake or year, the source URL and the retrieval date. Bitdeer proposes; the validator checks the excerpt against the page text.
3. **What the agent may not do:** infer a conversion from a third-party calculator, from a percentage-to-4.0 formula, or from another institution's policy.
4. **Expected reality:** many US institutions state they evaluate Indonesian transcripts in context and publish no conversion. That is a valid sourced outcome and displays as "Needs confirmation" with the source shown. Many UK institutions publish Indonesia-specific entry requirements, which the comparison uses directly.
5. **Gap handling:** if the Factory worker finds no accepted rule, the uncertainty stays and the student can request counseling (TECH-003). A research run alone never resolves it.
6. **Versioning:** rules are versioned. A changed rule triggers recalculation of affected academic assessments with history preserved.

## 6. Exchange rates (PROPOSED)

- **Source:** Frankfurter (frankfurter.dev), a free API with no key that serves European Central Bank reference rates. Verify at setup that USD, GBP and IDR are all available.
- **Stored:** each rate with base, quote, the rate date and the source. Original published amounts always remain; the converted amount is labeled with the rate date.
- **Not used for rates:** Google or Gemini models. A model would produce an estimate, not a sourced rate, which conflicts with PROF-003 and DATA-003. A Google API key is fine for other uses, but not as the exchange-rate authority.
- ECB reference rates are daily indicative rates, not what a bank or card charges. The UI says so.

## 7. Climate and other sources (PROPOSED)

The preliminary requirements say climate and its data source must be defined. Proposal:

- **Source:** Open-Meteo climate/historical API (free, no key, based on reanalysis data) queried by campus coordinates to compute normals: mean annual temperature, coldest-month mean, warmest-month mean, annual precipitation. Verify its terms for this use, since the free tier is for non-commercial use.
- **Student preference:** warm, mild, cool, cold, or no preference.
- **Mapping:** bands on the normals live in `config/climate.json`. Match, Partial and Mismatch are computed from those bands.
- **Population density:** replaced by the setting filter per the confirmed spec; it is not computed separately.

## 8. Counselor assignment and retention

### Round robin (CONFIRMED rule, details PROPOSED)

- A Convex table holds the ordered list of active counselors and a rotation pointer. Convex mutations are serializable, so two simultaneous requests cannot take the same turn.
- Each new request goes to the next active counselor; the pointer advances.
- A student with an existing assignment keeps the same counselor for later requests.
- If no counselor is active, the request is `pending` and the student continues independently. Pending requests are assigned when a counselor becomes active.
- Capacity limits, expertise matching, reassignment and unassignment are out of scope for the first release.
- Demo counselors are fictional accounts; each maps to a Jira user for work-item assignment.

### 10-year retention (CONFIRMED, flags)

- Implement as a configurable retention period, default 10 years, applied to student records, files and messages.
- Flag 1: users are high school students, many under 18, and files may include passports and transcripts. A fixed 10-year period without a student-initiated deletion path is likely to cause privacy problems. Recommended: allow the student (or a guardian) to request deletion at any time, which overrides the retention period; confirm what Indonesian personal-data law and the target countries' rules require before real students use this. This is not legal advice.
- Flag 2: for the hackathon demo, only fictional students and fictional files are used, so no real retention happens.
- Sharing with a counselor and sending to an AI vendor remain separate permissions (FILE-001, FILE-003).

## 9. Updated unresolved list

Resolved by this document (once the PROPOSED items are accepted): ranking, setting classification, exchange rates, counselor allocation, retention, frontend, auth, hosting, climate source.

Still open:

- Whether Convex, Bright Data, Apify, Bitdeer and Factory behave as assumed in section 2.1 and 2.3 (answered by Spike 1).
- Cartesia Indonesian speech quality.
- Full Convex award rules and multi-track entry rules.
- Figma write access and Education verification.
- Which US and GB institutions the first verified batch covers, and the catalog boundary for "all bachelor's programs".
- File type and size limits, malware handling, AI-processing consent text.
- Reminder channels, calendar export.
- Message notifications.

## 10. Build order (PROPOSED)

0. Smoke-test each service key and record which capabilities each account actually has.
1. Feasibility check (build phase, not now): one US program and one UK program through Bright Data → Apify Actor → Bitdeer → validator → Convex.
2. Convex schema, auth, roles, and access rules.
3. Figma foundations and core screens (confirm write access first); begin real Mana and Notability records.
4. Catalog ingestion, coverage tracking, setting and climate classification.
5. Intake, filters, ranking, cost and grade comparison.
6. Program details, shortlist, timelines, application workspace.
7. Round-robin assignment, async messages, file sharing, counselor views.
8. Factory worker and Forge/Jira app.
9. Cartesia voice.
10. Acceptance scenarios, sponsor evidence, demo script.

## 11. Voice design (CONFIRMED by user, details PROPOSED)

Added 2026-10-24 after checking Cartesia's docs.

- **Speech-to-text:** Cartesia `ink-whisper` (user decision). The current flagship `ink-2` does not list Indonesian; `ink-whisper` is the older model that does, per a Cartesia docs page found during feasibility research. Not yet verified: that it works for Indonesian in practice, and that it streams over the STT websocket.
- **Text-to-speech:** Cartesia `sonic-3.6`, which lists Indonesian (`id`). Confirmed in the model docs.
- **Reasoning:** Claude receives the Indonesian transcript directly and replies in Indonesian. No translation step.
- **Browser auth:** the server issues a short-lived Cartesia access token; the server API key never reaches the browser. Pin the Cartesia API version.
- **Fallbacks:** text input and output at all times. If `ink-whisper` fails the Indonesian test, use the browser's built-in speech recognition (Chrome or Safari, audio goes to the browser vendor) and keep Cartesia for spoken replies; record that honestly in the Cartesia write-up.
- **Defaults:** voice is off until the student turns it on, with a notice about where audio goes (many users are minors).
- **First test once the key exists:** a recorded Indonesian sample with school, subject and program names through `ink-whisper`, checking accuracy and streaming.
