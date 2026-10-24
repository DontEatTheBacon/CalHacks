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
