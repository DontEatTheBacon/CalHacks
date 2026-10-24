# Langkah — Figma Design Plan

Date: October 24, 2026
Status: Specification of the design work and deliverables. No Figma file exists yet.

## 1. Principle

Figma is where Langkah's design is actually created. The user's HTML mock (`langkah-polished-screens.html`) and `docs/design-delta.md` are guidance for look, tone, content patterns and flows. The final design lives in Figma and may depart from the mock wherever the design work shows a better answer. Code is built from the Figma design, not from the HTML. Changes found during implementation are fed back into Figma. This plan implements `archive/figma.md` and `spec-v1.0.md` section 11.

## 2. Capability status (checked 2026-10-24)

- This Claude Code session has no Figma tools loaded. The only design tool present (`DesignSync`) works with claude.ai/design design-system projects, not Figma files.
- The MCP registry lists an official Figma connector (`https://mcp.figma.com/mcp`), not connected here. Its listed tools are `generate_diagram`, `get_design_context`, `get_screenshot`, `get_metadata`, `create_design_system_rules`, `get_variable_defs`, `get_code_connect_map`, `get_figjam` and one more not named. These are mainly for reading designs, producing code context and generating diagrams. Whether it can create frames, components or pages in a design file is UNVERIFIED and must be tested after the connector is added.
- Result: Claude's ability to create the Figma design pages directly is not established. The plan below has a primary route and two fallbacks, and the actual route used is recorded honestly in the devlog and the stage log.

## 3. How the design gets made (decision)

All routes below belong to the build phase; none is needed to complete the specification.

Route A (try first, 15 minutes of testing): the user adds the Figma connector and signs in; Claude tests whether it can create a page, frames, a component with variants, and variables in a file the user creates. If yes, Claude builds the design directly.

Route B (if A cannot write): Claude produces the design as a structured design specification (tokens, component definitions, frame layouts as data) plus a small Figma plugin that builds the pages, variables, components and frames in the user's file. The user installs it from the plugin manifest in Figma's desktop app and runs it (exact click steps will be provided). Claude then iterates by editing the specification and re-running. This is code written for design generation and is described honestly as such: Claude is the author; Figma is the editor, review and prototyping surface.

Route C (if neither works): Claude creates high-fidelity design pages as HTML/CSS pages for review, and the user imports them into Figma with an HTML-to-Figma plugin and then refines and prototypes in Figma. Figma use is then limited to import, refinement and prototyping, and the stage log says so.

In all routes the user reviews in Figma with comments, and Claude revises. The user may also use Figma Make for an optional interactive prototype of the key flows; if so, it is recorded as the user's own stage entry.

## 4. Figma files and pages

File 1 — Langkah Design (shared as "Anyone with the link can view"; edit access for the user and the Figma connector account).

| Page | Contents |
| --- | --- |
| 00 Cover and index | Name, status, link list, page map, legend of states |
| 01 Foundations | Color variables (light and dark) with semantic roles: primary, surface, text, border, success, warning, error, info, and **uncertain** (for "Needs confirmation" and "Unknown"); typography scale; spacing scale; radii; elevation; grid; breakpoints (desktop 1440, tablet 768, mobile 390); iconography rules |
| 02 Components | Reusable components with variants (section 5) |
| 03 Student — desktop | Frames for all student screens |
| 04 Student — mobile | Key screens: intake, discovery, program card list, grade check, dashboard, application checklist, counseling request and thread, voice |
| 05 Counselor | Desktop frames and key mobile frames |
| 06 States | Loading, empty, error, unavailable data, stale source, conflicting source, permission denied, offline, cached versus fresh |
| 07 Voice | All voice states, permission prompt, transcript, text fallback |
| 08 Prototype flows | Connected flows (section 7) |
| 09 Handoff | Component-to-code map, tokens, redlines for key screens, notes for developers |
| 10 Iteration log | Real review notes: what the user said, what changed (written as it happens) |

File 2 — Langkah Slides (Figma Slides): the stage log (≤ 200 words per stage), the demo video, embedded prototype links (and Make file if used), the repository link, and the product and workflow story. Shared as "Anyone".

## 5. Design system

Tokens start from the mock's palette and type (purple primary, DM Sans and Manrope) as a baseline and can change after review. Required semantic colors include a distinct, accessible "uncertain" color that is not a warning or an error.

Components (each with variants and states: default, hover, focus, selected, disabled, error where relevant):

- Navigation: app header, language/currency switch, stepper, side nav, bottom nav (mobile), breadcrumbs, tabs.
- Inputs: text, number with currency, select, multi-select chips (country, setting), segmented control, grade input with scale (min–max), subject grade row, language score row, date input, toggle, checkbox, radio, file upload zone.
- Display: program card (default, compact, comparing), band chip (major, academic, budget, climate with outcome variants), cost breakdown row, source citation chip (with cached or fresh), freshness badge, status badge (task statuses), date-type tag (official, recommended, estimated, student-entered, unpublished), progress bar, risk badge (on track, tight, at risk, closed), checklist item, timeline milestone, comparison table (desktop) and comparison card (mobile), grade path (original → policy → decision), evidence panel.
- Feedback: dialog, toast, inline alert (info, warning, error, uncertain), skeleton loaders, empty states.
- Counseling: request banner (requested, pending, assigned), message bubble (student, counselor, system update; pending, sent, failed), file attachment row, case card, follow-up item.
- Voice: mic button, state indicator (idle, listening, thinking, speaking, error), transcript line, text-fallback switch.

Naming: `Category/Component/Variant=value` so names map to code components.

## 6. Screen inventory (frame names `Sxx-Name/Desktop` and `/Mobile`)

S01 Sign-in and role; S02 Profile and intake (preferences, school results, language and qualifications); S03 Discovery; S04 Program details (tabs); S05 Grade equivalency (needs-confirmation, direct, UK qualification, subject-gap variants); S06 Compare and shortlist; S07 Student dashboard and calendar; S08 Application workspace (checklist and timeline); S09 Language test planner; S10 Housing and immigration checklist; S11 Counseling request and status; S12 Message thread with files; S13 Files manager; S14 Voice adviser; S15 Privacy and settings; C01 Counselor case list; C02 Counselor student detail; C03 Counselor timeline review; C04 Counselor messages and shared files.

Each frame uses the real states listed in `spec-v1.0.md` (unknown, conflicting, cached versus fresh) and the labeled fictional student and institutions from the verified batch. No invented match percentage, date or cost is presented as real; mock values are marked "Sample".

## 7. Prototype flows

1. **Main journey:** S02 → S03 → S04 → S05 → save → S08 → open official application (external link screen).
2. **Early counseling branch:** from S05 (grade uncertainty) → S11 requested → pending or assigned → S12 thread → return to S05 with context intact.
3. **Counselor:** C01 → C02 → C04 reply → follow-up item → C03.
4. **Voice:** S14 from any screen: permission → listening → transcript → confirmation → fields updated; text fallback.
Interactions: hover and press states, form validation examples, tab and dialog transitions, loading examples for ingestion and agent runs. Desktop and mobile versions of flows 1 and 2.

## 8. Review and iteration

- The user reviews in Figma using comments. Claude responds by revising and recording each round in page 10: date, feedback, change.
- At least one meaningful review round before implementation; further rounds when implementation reveals problems.
- If the user declines changes or something is abandoned, that is recorded too.

## 9. Handoff to code

- Tokens exported to a design token file consumed by the frontend theme (Tailwind configuration), kept in sync with Figma variables.
- Component map in page 09: Figma component → React component name → props/variants → data source (Convex query).
- The Figma connector's design-context tools (if available) are used to read frames while implementing; otherwise the handoff page and exported specs are used.
- After implementation each screen is compared to its frame; deviations are fixed in code or the frame is updated in Figma and the reason is logged.
- Code Connect mappings are added if the connector supports it and time allows.

## 10. Slides and evidence

Stage log stages (ideation, prototyping, handoff, code generation): tools used and why (naming the Figma product), approximate minutes (supplied by the user), effectiveness 1–5 (supplied by the user), how output reached the project, rework and dead ends. Claude drafts text from `docs/devlog.md`. If Route B or C is used, the stage log says Claude produced the specification or HTML and Figma was used for the stated purposes only. Slides must include the stage log, the demo video, embedded prototype/Make files and the repository link. Sharing set to "Anyone" and checked from a signed-out browser. Figma Education verification is the user's task.

## 11. Responsibilities (build phase)

| Task | Who |
| --- | --- |
| Create the Figma account and complete Education verification | User |
| Add the Figma connector and sign in; create the empty file and share link | User |
| Capability test (Route A) and choice of route | Claude |
| Design system, pages, frames, prototype | Claude (route-dependent), user reviews |
| Review comments, minutes and ratings | User |
| Plugin install and run (Route B only) | User, with Claude's click-by-click steps |
| Stage log text, Slides structure | Claude drafts, user finalizes |
| Public-access check | User |

## 12. Order of work

1. Capability test and route choice.
2. Foundations and components.
3. Student desktop screens, then mobile.
4. States, counselor screens, voice.
5. Prototype flows.
6. User review and revision.
7. Handoff page.
8. Update after implementation; Slides and stage log at the end.
