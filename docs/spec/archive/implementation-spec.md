# University Adviser — Implementation Specification

Version: 0.2  
Date: October 24, 2026  
Status: Implementation draft; confirmed behavior separated from proposed defaults

## 1. Authority and implementation responsibility

This specification consolidates preliminary-requirements.md and additional-requirement.md with the user's subsequent decisions. Those source files remain unchanged. Also read actors-and-workflow-decisions.md, figma.md, and technology-and-award-requirements.md. The latest confirmed product decisions in this specification override conflicting earlier suggestions.

Claude handles design through an authorized Figma integration, coding, integrations, tests, and deployment preparation. The user handles accounts, verification, secure credential entry, design review, and browser recording. Verify Figma write capabilities early and explain any necessary manual steps. The HTML mockup is a visual reference, not a complete functional specification; fictional mockup data must not become production facts.

## 2. Confirmed scope

- Initial destinations: United States (US) and United Kingdom (GB).
- Catalog scope: all bachelor's programs in those destinations, not a curated recommendation list. Store coverage and collection status honestly; do not claim complete nationwide coverage before verification.
- Students discover and compare programs, prepare applications, and track milestones through arrival.
- Counseling is optional, requestable at any stage, and assigned by the system.
- Student/counselor communication is asynchronous messaging within the app. No live-chat connection, typing indicators, instant-delivery promises, voice calls, or appointments are required.
- Students may upload files and share them with the assigned counselor.
- Agents perform as much operational work as possible. Counselors advise; they are not required to manually coordinate research or maintain checklists.
- Students submit applications on official external portals themselves.
- Meta, Spacetime, Germany, Australia, Japan, and South Korea are outside initial destination/integration scope. Keep the model extensible without building those destination workflows now.

## 3. Roles and permissions

| Role | Permitted behavior |
| --- | --- |
| Student | Manage own profile, matches, shortlist, applications, milestones, uploads, sharing, counselor request, and messages. |
| Assigned counselor | Read the authorized student context and explicitly shared files; send advice/messages; record counseling notes or suggested next actions visible according to defined permissions. |
| Unassigned counselor | No student profile, message, or document access. |
| Agent/service identity | Execute bounded authorized internal operations; respect ownership, sharing, source trust, and action history. |

Administrative operations and counselor onboarding are necessary operational concerns but no separate administrator dashboard has been approved. Implement only the access/configuration needed for the first release and record further requirements separately.

## 4. Discovery and matching rules

### DISC-001 — Country is a hard filter

Use US and GB country codes consistently. Return only programs in selected countries. If neither is selected, show no matches and a clear request to select at least one country; do not interpret an empty selection as both countries.

### DISC-002 — Setting is a hard filter

Supported student-facing settings: city and countryside. If one or both are selected, return only programs whose campus setting matches a selected value. If neither is selected, apply no setting restriction. This empty-setting default is proposed, not explicitly confirmed.

Setting belongs to the program's teaching campus, not university headquarters. Classification must have a documented rule, evidence/source, and an unknown state. For an active setting filter, unknown classifications must not be falsely treated as a match; show how many records need classification when feasible. Formal city/countryside thresholds remain an implementation decision to resolve before coverage claims.

### DISC-003 — Other inputs do not exclude programs

Budget, intended major, climate, grades, and language scores affect ranking, explanations, and preparation needs only. A Computer Science preference does not hide other majors. A below-threshold academic result does not hide the program. Hard-filtered catalog results remain browsable; the app may not claim a ranked subset is the complete catalog.

### DISC-004 — Explainable ranking

Use a deterministic, versioned ranking method with evidence-backed component reasons, not an opaque model-only match percentage. Proposed initial ordering: intended-major relevance, academic readiness, budget fit, then climate fit; unknown values remain distinct from negative outcomes. This priority order is a proposed default requiring review. Do not implement numeric weights without documenting them and their tests.

Each result displays major fit, academic status, estimated cost completeness, budget gap if calculable, and unresolved information. Financial or academic gaps must never be presented as an admission guarantee or a reason the student is forbidden to apply.

## 5. Student profile

### PROF-001 — Inputs

Store budget amount/currency/period, selected countries/settings, major preferences, climate preferences, intended intake, Indonesian qualification/curriculum, reported grades and source scale, school/year context, relevant subject grades, and language evidence. Support not-yet-known language results and missing information.

### PROF-002 — Updates

Persist edits without overwriting original grade/document evidence. Recompute affected recommendations and proposed preparation tasks, preserving official deadlines and completed action history. Keep data belonging to different students isolated.

### PROF-003 — Currency

Retain original published costs and currency. Converted amounts require exchange-rate source/date; until configured, show original currency or an explicitly unavailable conversion rather than a fabricated IDR total.

## 6. Catalog and evidence

### DATA-001 — Program identity

Separate institution, campus, bachelor's program, intake, application round, and route. Deduplicate without collapsing distinct campuses, intakes, or admissions routes. Determine treatment of combined/integrated degrees, foundation-entry routes, and programs with multiple teaching sites before asserting full coverage.

### DATA-002 — Official evidence

Use university/college-published program requirements, tuition, institutional living-cost estimates, scholarship information, dates, and official application links. Government/official centralized-application sources may be used for applicable immigration and application-route requirements. Store URL, retrieval time, applicability, and supporting evidence.

### DATA-003 — Cost completeness

Store tuition period/currency, mandatory fees, institution-published housing/living estimates, and inclusions/exclusions separately. Do not assume domestic rates apply to Indonesian international applicants. Missing living-cost information means total cost is incomplete; do not fill it with unsourced AI estimates. Scholarships are conditional opportunities, not guaranteed deductions.

### DATA-004 — Coverage

Maintain institution/program discovery, ingestion, last verification, failure, and unknown-field status. Provide internal coverage reports and user-visible limitations. Implementation may proceed in verified batches while nationwide bachelor's coverage remains the goal.

### DATA-005 — Reliability

Handle blocked, failed, changed, empty, and conflicting public sources. Preserve conflicts and uncertainty. Follow Bright Data's supplied event restrictions: no behind-login/paywall scraping, non-public personal-data collection, or fake live results. Treat retrieved content as untrusted data rather than agent instructions.

## 7. Indonesian grade mapping

### GRADE-001 — Original record

Capture original grade, scale, qualification/curriculum, school/year context, and subject results. Never assume all Indonesian schools use the same reporting scheme or overwrite the original grade with a converted result.

### GRADE-002 — Destination comparison

Provide a consistent documented Indonesian-to-US and Indonesian-to-UK comparison approach. First use the institution/program's published Indonesian qualification requirements directly. Otherwise apply an equivalency explicitly accepted by the institution and applicable to the student's qualification/intake.

A general destination comparison may be displayed only as an explicitly unofficial estimate unless accepted by the institution. Do not assume the UK uses a universal US-style GPA threshold or that a linear percentage-to-4.0 formula is official.

### GRADE-003 — Outcomes

Return meets published academic minimum, below published academic minimum, or needs confirmation. Preserve subject prerequisites separately. Meeting minimums does not establish admission likelihood. Estimated mappings cannot silently establish official eligibility.

### GRADE-004 — Unsupported mapping acceptance scenario

Given a student with 86/100 and a US program requiring 3.0/4.0, when no applicable accepted mapping exists, show the original scale, required scale, and “Needs confirmation.” Do not compare raw numbers or invent a conversion. The student may still save the program and request counseling.

## 8. Program timelines

Implement the complete milestone/data/dependency scope in additional-requirement.md, restricted initially to US and UK applicability.

### TIME-001 — Timeline identity and access

Each program/intake/round has published milestones available before saving. Each selected application gets a personalized plan. Aggregate next actions across the student's applications.

### TIME-002 — Categories

Support opening/submission, early decision/action and other applicable rounds, regular/rolling windows, language exam booking/results/retake/official receipt/validity/waivers, other tests, school documents/recommendations, scholarships/aid, decisions/conditions, acceptance/deposit, housing, immigration, final documents, enrollment/orientation, and arrival.

Use verified US/UK routes and milestones where applicable, including direct/shared/centralized submission paths and relevant institutional immigration documents. Candidate country-specific steps are not automatically mandatory for every student.

### TIME-003 — Date semantics

Distinguish verified official deadline/opening, expected official window, processing estimate, recommended target, student-entered appointment, and unknown/unpublished. Store date-only values without invented time; preserve official timezone and original wording. Display student-local time when meaningful and known.

### TIME-004 — Dependencies

Reverse-plan test and document preparation using explicit dependencies, lead times, and labeled assumptions. Example: exam → results → possible retake → official score delivery → receipt cutoff. Immigration/housing steps can run in parallel or depend on offer acceptance according to actual policy.

### TIME-005 — Task lifecycle

Statuses: not started, in progress, waiting on someone, submitted, confirmed complete, overdue, not applicable. Distinguish dispatch, receipt, and approval. Expired deadlines and impossible schedules produce visible risks, not optimistic fabricated targets.

### TIME-006 — Changes

Verified source changes update affected proposed tasks and expose prior/new values and reasons. Do not overwrite completed history or manually supplied appointment facts. Notify through the defined in-app experience; external delivery and reminder schedules are not yet approved.

### TIME-007 — Score deadline acceptance scenario

Given an application deadline and a distinct official English-score receipt deadline, store/show both. Recommended exam/retake dates remain clearly separate planning targets. The test being taken does not automatically mean the university received the score.

## 9. Counseling and asynchronous messages

### COUNSEL-001 — Request anywhere

Expose counseling during intake, discovery, grade checks, timeline planning, preparation, and tracking. Preserve current context. Independent progress must not require counselor review or availability.

### COUNSEL-002 — System assignment

Students request help; the system assigns a counselor. Proposed initial allocation: eligible active counselors with capacity, prioritize suitable language/destination expertise, then lowest current workload with a deterministic tie-break. If nobody is available, mark request pending and let the student continue. This algorithm/capacity definition requires approval; do not represent it as a confirmed user decision.

### CHAT-001 — In-app asynchronous conversation

Provide a message window/thread for the assigned relationship, timestamped messages, attachments/references to shared files, message history, and clear pending/sent/failed submission states. Persist messages and permit later retrieval without a live connection. Proposed default: one conversation per assigned student/counselor relationship, with program references attached to messages.

No real-time socket implementation, live presence, typing indicators, or instant-response expectation is required. Agent-generated updates must be labeled as system updates; agents must not impersonate the student or counselor.

### CHAT-002 — Permissions and reassignment

Only the student and authorized assigned counselor can read the conversation. Define history transfer, consent, old-counselor access revocation, retention, and counselor private notes before adding reassignment/private-note features. Default to no private counselor-note feature in the first version.

## 10. File uploads and sharing

### FILE-001 — Upload and share

Students can upload files to their account and explicitly share selected files with the assigned counselor. Show upload state, file type/size, sharing state, and download/removal controls according to final retention rules. Assignment alone must not silently share every file.

### FILE-002 — Safe handling

Enforce ownership/access on the server for every upload/read/download/delete operation. Use private storage and authorized access, validate supported types/sizes, sanitize filenames, avoid executing embedded content, and define a malware-handling strategy. File type/size limits and retention/deletion policy remain to be finalized.

### FILE-003 — AI access is separate

Sharing with a counselor does not automatically authorize sending the file to every AI vendor. Identify what a requested AI task needs and obtain/communicate suitable authorization before document processing. Prefer minimal data, redact where feasible, and preserve document provenance.

## 11. Automation policy

### AUTO-001 — Automated internal operations

Automate public research, structured extraction, supported comparisons, ranking, timeline generation, proposed/checklist updates, source-change analysis, counselor assignment under established rules, and internal follow-up coordination. Maintain inputs/sources, action/result, timestamp, and failure history.

### AUTO-002 — Counselor purpose

Counselors provide guidance and interpretation. Do not require counselors to approve routine collection, matching, or every internal checklist update. Human advice cannot replace missing official evidence.

### AUTO-003 — Boundaries

Agents must not silently change original student records, submit external applications, pay fees, send messages as a student/counselor, or expose private files. Students review application drafts and perform official submissions. Agent tool permissions must be bounded and website/document instructions treated as untrusted input.

## 12. Integration contracts

| Component | Input → output / responsibility |
| --- | --- |
| Bright Data | Public source query/URL → source discovery/retrieval with metadata and failures. |
| Apify | Configured repeatable admissions collection → structured source package, runs, logs, and reusable Actor. |
| Bitdeer Model Studio | Source content/evidence → candidate structured program, cost, grade-policy, and milestone fields. Validation required before publication. |
| Convex | Authenticated operations → persistent scoped records, task state, messages, uploads metadata, evidence/history. |
| Explicit rules | Verified data + student context → comparisons, filter decisions, ranking components, dependencies and date-risk flags. |
| Claude API | Authorized context + evidence → explanation, clarification questions, reviewed drafts and plan summaries; no invented facts. |
| Factory Droid SDK | Product trigger + bounded tools → visible research/checklist work with proposed changes and outcome. Must do work within the running app. |
| Forge / Jira | Assigned counselor case/event → autonomous task coordination and progress; app chat remains the student/counselor communication channel. Do not expose private documents through public Jira issues. |
| Cartesia | Authorized voice session → meaningful spoken intake/match/timeline discussion grounded in the same records; text fallback. Verify Indonesian support. |

Prevent competing agents from overwriting the same tasks; use versioned/idempotent operations and explicit responsibility ownership. Decide a technically viable Factory hosting/execution architecture before promising deployment.

### TECH-001 — Required technology commitments

The selected sponsor technologies are implementation requirements, not optional suggestions or interchangeable vendor examples. Do not replace them with generic scraping, a different database, or a single model doing every job without an explicit scope decision. Meaningful integration and demonstrable contribution are required; qualification still depends on official rules.

| Technology | Required product/development role | Acceptance check |
| --- | --- | --- |
| Bright Data | Discover/retrieve current public official university/college and applicable application/immigration sources. | Live request produces source evidence consumed by the app; missing/failed results handled. |
| Apify | Build a reusable admissions collection Actor that orchestrates repeatable collection with inputs, run status, output, and errors. | Actor executes for the event and output enters the university data pipeline; check Best Actor entry conditions. |
| Bitdeer AI Model Studio | Extract candidate program, cost, academic, language, and timeline records from collected source material. | Actual inference output is validated, linked to evidence, and persisted; not merely an unused API call. |
| Convex | Primary persistent application backend, including student/catalog/application/task/message/file metadata and provenance. | Real authenticated app operations persist and retrieve data with ownership/access controls. |
| Anthropic / Claude API | In-app reasoning/explanations, clarification, planning, and reviewed drafts based on verified evidence. | Actual app API interaction supports the student journey; Claude writing the code alone is insufficient. |
| Factory Droid SDK | Triggered agent work inside the running product: bounded research, gap resolution attempts, checklist generation, and proposed updates. | Show trigger, permitted tools, execution steps, result, failure handling, and resulting task/data changes. |
| Atlassian Forge / Jira | Actual installed Forge app automates counselor workload coordination and follow-up tasks. | Real Jira work items/actions demonstrate reduced operational work; in-app chat remains communication channel. |
| Cartesia | Central voice intake and grounded discussion of matches/timelines after core flow works. | Complete meaningful speech flow with transcript/text fallback; verify Indonesian language capability. |
| Figma | Claude creates/iterates design system and screens, then implements from the designs; prepares required Slides. | Actual write capability verified; prototype, design-to-code traceability, stage log, Slides, and public judge access. |
| Mana | Meaningful planning, prototype, build, or debugging work during development. | Public page/chat evidence and concrete contribution to the resulting project. |
| Notability | Genuine research notes, sketches, decisions, and evolution during development. | Inspectable actual process and meaningful relevant feature use, not a retroactively fabricated log. |

Microsoft is an award evaluation target for the end-to-end useful agent, not an additional mandatory Azure integration. GitHub hosts the source/submission repository. Meta and Spacetime are not selected.

### TECH-002 — Required ingestion workflow

1. A student search, scheduled refresh once defined, or explicit update request identifies a US/GB program/intake data need.
2. Bright Data retrieves/discovers applicable official public sources; the Apify Actor coordinates collection, run records, source packages, and repeatability. Validate exact integration feasibility before choosing the API wiring; neither vendor may be a redundant decoration.
3. Bitdeer extracts typed candidate fields with evidence pointers, unknowns, and applicability.
4. Validation checks program identity, international-applicant applicability, currencies/periods, dates/timezones, grade-rule scope, and source consistency. Reject/flag invalid or unsupported fields rather than silently publishing guesses.
5. Convex stores versioned validated records and unresolved issues with provenance and collection/extraction history.
6. Explicit rules apply country/setting filters, supported grade comparisons, cost comparisons, ranking components, and timeline dependencies.
7. Claude explains results and asks for missing student context from those records. Sources and uncertain results remain visible.

Caching is allowed for product reliability, but sponsor demonstrations requiring live data must perform real retrieval and label cached versus newly retrieved information honestly. Do not imply that automated public research includes private student document access.

### TECH-003 — Required automation workflow

| Trigger | Automated behavior | Visible outcome |
| --- | --- | --- |
| Student selects/saves a program for application | Factory performs bounded research/checklist work using applicable sources and supported internal tools. | Sourced plan, unresolved questions, execution history, and persisted application tasks. |
| Verified university requirement/deadline changes | Reassess affected applications and regenerate dependent proposed actions under versioned rules. | Before/after change, affected deadline risks, updated tasks; Forge coordinates relevant assigned-counselor follow-up. |
| Student requests counseling at any stage | Assign under finalized allocation policy, preserve context, and prepare relevant case/follow-up work. | Pending/assigned state, authorized in-app message thread, and counselor context. |
| Student asks what to do next | Claude summarizes actual tasks, constraints, and evidence; Cartesia supports a spoken interaction where used. | Actionable grounded answer, no invented deadlines or admissions guarantee. |
| Research lacks accepted grade equivalency or a required date | Attempt bounded official-source research; retain uncertainty when unsupported. | Needs-confirmation state and optional counseling, without blocking browsing or fabricating a result. |

An agent is not allowed to close uncertainty merely because it completed a research run. Source evidence determines whether the issue is resolved. All writes use authorization, idempotency/version checks, and action history. Counselors provide advice rather than manually operating this pipeline.

### TECH-004 — Technical and award evidence gates

For every runtime integration, document configuration, trigger, input/output contract, actual contribution, errors, limits/cost controls, and a reproducible demonstration. Keep server secrets out of client code, logs, public workflow artifacts, and recordings.

The integration is incomplete if only installed, mentioned in a README, mocked in the final demo, or used only to generate code when the track requires running-product use. Figma, Mana, and Notability instead require genuine development-process evidence. See technology-and-award-requirements.md for exact supplied rules, submission limits, and unresolved eligibility checks.

## 13. Minimum data entities

- StudentProfile, QualificationRecord, SubjectGrade, LanguageEvidence.
- Institution, Campus, Program, Intake, AdmissionRound, ApplicationRoute.
- SourceRecord, EvidenceReference, ExtractionRun, CoverageRecord.
- PublishedRequirement, GradeEquivalencyRule, AcademicAssessment, CostItem, CurrencyRate, MatchExplanation.
- PublishedMilestone, StudentApplication, PersonalizedTask, Dependency, ChangeEvent.
- CounselorProfile, CounselingRequest, Assignment, Conversation, Message.
- FileRecord, FileShare, AgentRun, ActionHistory.

Fields must include ownership, stable identifiers, applicable source/verification metadata, and timestamps where relevant. Store country identifiers as US/GB. Admission requirements and timelines must be versioned by applicability, not a single institution-wide text blob.

## 14. Screens and design handoff

Claude creates Figma foundations/components and these screens, referring to the polished HTML visual direction:

1. Student profile/intake.
2. Discovery with country/setting filters and preference explanations.
3. Program details, intake/round selection, costs, eligibility, sources and dates.
4. Comparison and shortlist.
5. Grade equivalency detail and uncertainty handling.
6. Student dashboard and cross-application next actions/calendar.
7. Application workspace with dependency-aware timeline.
8. Language-test planner.
9. Housing/immigration checklist.
10. Counseling request, pending/assigned state, asynchronous messages and shared files.
11. Counselor assigned-student dashboard, student context, messages, and follow-up view.
12. Voice adviser with permission/listening/thinking/speaking/error/text fallback.

Design desktop and key mobile flows, loading/empty/error/unknown states, and keyboard focus. Do not show an invented match percentage or unsupported dates/costs as real. Counseling entry is available before shortlisting. No separate administrator dashboard approved.

## 15. Acceptance scenarios

- [ ] Selecting US only returns no GB programs; selecting neither country returns no results with a prompt.
- [ ] City-only selection excludes countryside programs; unknown settings are not fabricated matches.
- [ ] A nonpreferred major, high-cost program, or below-minimum academic result remains available after country/setting filters, with clear explanation.
- [ ] Costs use the international-applicant institutional source and disclose missing living estimates.
- [ ] Unsupported 86/100-to-3.0/4.0 mapping stays unresolved; UK comparisons use applicable qualification requirements rather than assuming US-style GPA.
- [ ] Separate English-test/score-receipt deadlines and recommended preparation targets are visible.
- [ ] Each selected program has its own intake/round timeline and shared dashboard next actions.
- [ ] Counseling can be requested during initial intake; assignment preserves context and does not block progress.
- [ ] A student sends a message, leaves, and later retrieves the conversation without a live chat connection.
- [ ] An assigned counselor can access explicitly shared files; another student/unassigned counselor cannot.
- [ ] Agents generate/update operational work with history without requiring counselor operation of the workflow.
- [ ] Original records are not overwritten by AI, and external submissions/payments are not performed automatically.
- [ ] Research/extraction failures retain profile/task data and show actionable uncertainty.
- [ ] Complete browser demo works with fictional student data and real university sources where sponsor rules require live data.

## 16. Delivery sequence

1. Resolve the remaining policy defaults below; verify event rules and service capabilities.
2. Set up accounts/credits/secrets; start actual Figma/Mana/Notability development evidence.
3. Establish catalog identifiers, source provenance, Convex schema/auth, and Figma components.
4. Build public data collection/extraction, US/GB coverage tracking, and validation.
5. Build intake, hard filters, explainable ranking, costs, and grade comparison.
6. Build program details, shortlist, timelines, and application workspace.
7. Build assignment, asynchronous chat, file sharing, and counselor context views.
8. Add bounded Factory work and real Forge/Jira coordination.
9. Add Cartesia after the core experience is stable.
10. Verify acceptance scenarios, deploy, and prepare sponsor-specific demos/evidence.

## 17. Awards and evidence

Use technology-and-award-requirements.md as the per-sponsor checklist. Actual implementation use is required; coding with a service alone does not satisfy product-integrated tracks. Preserve honest Figma/Mana/Notability workflow evidence during development. Figma/Atlassian videos are at most three minutes; Cartesia requests a two-minute presentation. Verify remaining rules, especially Convex and multi-track eligibility, before claiming qualification.

## 18. Unresolved implementation decisions

Do not mistake these for missing confirmed product intent; propose defaults for review while progressing on independent work.

- Formal city/countryside classification and handling of multi-campus/online programs.
- Exact bachelor's catalog boundaries, data acquisition feasibility, and coverage verification.
- Empty setting selection behavior and ranking priority/weights (proposed above).
- Accepted documented US/UK Indonesian equivalency sources; estimates cannot establish official eligibility.
- Counselor eligibility/capacity, allocation algorithm, pending requests, reassignment/history rules.
- Message notifications, retrieval cadence, retention/deletion, and moderation/reporting scope.
- File limits/storage, malware handling, AI processing consent, and deletion policy.
- Frontend, authentication, hosting, initial intake/year coverage, and exchange-rate source.
- Reminder channels/cadence, calendar export, and external account connections.

These decisions must be explicit before relying on them in acceptance tests. No unsupported country procedures, conversion formulas, or exact admission/visa deadlines are established by this document.
