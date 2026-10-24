# Langkah — Design Delta: Mock vs Specification

Date: October 24, 2026
Basis: the user's mock `langkah-polished-screens.html` (read in full), the use-case and flow diagrams (now in `spec-v1.0.md` Appendix A; original in `archive/actors-and-workflow-decisions.md`), and `spec-v1.0.md`. The mock is guidance for look, tone, content and flows, not the final design. The final design is created in Figma (see `docs/figma-plan.md`) and may depart from the mock. This file lists what the Figma design should take from the mock, what must change, and which screens must be added.

## 1. What the mock already gives us (keep)

- Brand and tone: "langkah — Your next step, worldwide." Purple primary (`#6552cc` light, `#c3b9ff` dark), paper `#f3f4f8`, surface `#ffffff`, ink `#242840`, secondary text `#6e7489`, line `#e7e8f0`, soft `#eeebff`, warning `#fff5e5`. Fonts DM Sans (body) and Manrope (logo). Light and dark themes. Cards with 13px radius.
- Shell: header (logo, language and currency indicator "English · IDR", "Talk to your adviser"), top stepper, left workspace nav, support footer ("Counseling is optional, at every step") with a persistent "Request a counselor" button and a "Counseling requested" confirmation that preserves context.
- Student screens: Your profile, Discover, Grade check, My timeline (application).
- Counselor screen: assigned case with context, suggested next action, follow-up work and action history.
- Content patterns to keep exactly: "No invented match percentage. Unknown information stays visible"; "Your original school result stays unchanged"; the grade path (Original record → University policy → Eligibility decision); "Needs university confirmation"; "You can keep exploring"; official-versus-recommended milestone tags; "Submission happens on the university site"; "A counselor cannot certify an unsupported conversion".
- Mock data is fictional and stays labeled fictional ("Visual concept · Fictional universities and student").

## 2. Changes to the mock (mock → spec)

| # | Mock | Change |
| --- | --- | --- |
| 1 | Destinations "Australia and Malaysia"; programs at "University A/B" | US and GB only; real institutions from the verified batch. Destination becomes a multi-select (US, GB). With none selected, results show the prompt "Choose at least one country". |
| 2 | Setting dropdown "Smaller city · less crowded / Large city · lively" | Multi-select "City" and "Countryside" plus "No preference". Active filter shows "N programs need classification". |
| 3 | Budget "IDR 300,000,000" annual incl. living | Keep IDR as the default currency. Add currency and period (annual or total) and "tuition only / including living costs". Converted amounts show the rate date and source ("indicative reference rate"). |
| 4 | Climate "Mild weather / No preference" | Four options: warm, mild, cool, cold, plus no preference. |
| 5 | Program card shows one budget tag, cost, a warning, and "Why it fits" | Add the four band chips (major, academic, budget, climate), cost-completeness label ("living estimate not published"), source freshness with a cached or fresh badge, and the intake. Unknown values use a distinct "Unknown" style. |
| 6 | Grade page: one example (86/100 vs 3.0/4.0, no mapping) | Keep it as the "Needs confirmation" variant. Add variants: direct comparison with a published Indonesian requirement; UK qualification-based requirement (foundation or A-level terms, no GPA); subject gap block. Add method, source URL, applicability and retrieval date, and a "correct my grading context" control. |
| 7 | Timeline: static example dates, "Official deadline · example" | Real per-round milestones. Add status, owner, dependencies, a separate English-score receipt deadline, date type labels (official, recommended, estimated window, student-entered), "Not yet published", and agent-proposed items marked "Proposed" with sources. The checklist has more than five items and is generated. |
| 8 | Counselor case: "Allocation policy is still to be defined" | Show "Assigned automatically (round robin)" with assignment time. |
| 9 | Counselor screen has no messages or files | Add the message thread, shared files list and timeline review (section 3). |
| 10 | Voice button shows a text note | Full voice panel (section 3). |
| 11 | Language toggle is a static label | Working English and Indonesian toggle; Indonesian default for new students. |
| 12 | Footer "Counseling requested" is a single state | Add states: requested, pending (no counselor active), assigned (name and first message prompt). |

## 3. Screens to add (not in the mock)

Same visual language as the mock; wireframe-level only.

| Screen | Components and states |
| --- | --- |
| Program details | Header with institution, campus, setting chip; intake and round selector; tabs Overview, Requirements, Costs, Dates, Sources. Costs table by component with period and inclusions. Dates list with date-type tags. Language requirements card. Scholarships (conditional). Primary actions: Save program, Open official page. States: loading, partial data, source stale, source conflict (both values shown). |
| Compare and shortlist | Up to 4 saved programs side by side: bands, estimated annual cost, requirements, key dates, uncertainties. Remove and reorder. Mobile: stacked cards with a "compare" sheet that scrolls horizontally per row group. |
| Student dashboard | Saved programs with progress, "Next actions" across applications sorted by official deadline then recommended date, risk badges (on track, tight, at risk, closed), counseling status. Calendar toggle (list or month). |
| Language test planner | Accepted tests for the program, student's status (score, not yet taken, unknown), requirement per component, validity, recommended chain: book → test → results → retake window → official score delivery → receipt cutoff, each date type-labeled. Waiver note when published. |
| Housing and immigration checklist | Conditional steps with source links and "Needs confirmation" items; dependency on offer shown; no guarantee language. |
| Counseling thread | Asynchronous messages (pending, sent, failed), attach shared files, reference programs, system updates labeled "Langkah update". Explicit file sharing control per file. |
| Files | Upload with type and size hints (PDF, Word, JPEG, PNG, HEIC; 10 MB), state chips (uploaded, converting, preview unavailable), share toggle, download, delete. |
| Counselor student detail | Context summary, shortlisted programs, unresolved questions, grade evidence panel, timeline review with conflicts and change history, shared files, thread, follow-up list. |
| Voice panel | Start and stop, mic permission prompt, states (listening, thinking, speaking, error), live transcript, "Switch to text" always visible, interruption control, notice about where audio goes. |
| Privacy and settings | Retention notice (10 years by default), delete my data request, language, currency, voice default off. |
| Sign-in | In-app email and password form (Convex Auth); role shown after sign-in. |

## 4. Flow reference

- Student main flow and optional counseling flow: as in `spec-v1.0.md` Appendix A (diagrams A.2 and A.3).
- Prototype paths to build in Figma: (1) Profile → Discover → Program details → Grade check → Save → Timeline → Open official application. (2) Early counseling branch from Grade check: Request counselor → pending or assigned → thread → return to journey with context intact. (3) Counselor: Assigned list → Student detail → Message → Follow-up.
- Responsive rules: sidebar collapses into a bottom bar on small screens (the mock hides the sidebar below 700px; keep that and add the bottom nav); two-column "split" layouts stack; comparison tables become stacked cards.
- Accessibility: keep the mock's `aria-live` status regions and `aria-pressed` toggles; add visible focus rings, labels for all inputs, and text alternatives for the decorative campus artwork (decorative, `aria-hidden`).

## 5. Figma approach

Follow `docs/figma-plan.md`: use the mock's foundations and patterns (section 1) as a starting point, design the real components and screens in Figma, add the screens in section 3, and prototype the flows. If Claude's Figma write access is not available, the fallback routes in the Figma plan apply and are recorded in the devlog.
