# Figma Design Requirements and Claude Handoff

Date: October 24, 2026  
Status: Preliminary design scope based on agreed product decisions

## 1. Responsibility and connection

Claude is responsible for connecting to Figma, creating/editing the design system and application designs, iterating on them, and implementing the application from those designs. Figma work is part of the build, not a task delegated entirely to the user.

Before starting, verify that the available Figma integration supports creating and editing designs, not only reading files. Design write access and Figma Slides capabilities have not yet been verified. If a capability is unavailable, identify the exact limitation and provide the smallest necessary manual steps rather than claiming the work is complete.

The user handles Figma account creation, genuine Education verification, access authorization, reviewing designs, and browser demo recording. The user does not know programming. Give clear instructions for any unavoidable manual action.

## 2. Product context and confirmed decisions

Design a web application helping Indonesian high school students discover overseas universities, evaluate fit, and prepare/track applications.

- Match on budget, countries, major, climate, destination population density, and academic results. Include language scores and intended intake where needed.
- Indonesian grades and destination GPA requirements may use different scales. Show original results, applicable mapping, required result, source, and uncertainty. Never invent an official conversion.
- Counseling is optional and can be requested at any stage, including before shortlisting or when entering grades.
- The system assigns the counselor; students do not need to choose or invite one.
- Students submit applications themselves through official external university portals.
- Student and counselor experiences are in scope. A separate administrator dashboard is not currently required.
- Counselor assignment rules, communication medium, and reassignment policies remain undecided. Do not imply agreed behavior for these in the UI.

Read the companion files for complete context:

- preliminary-requirements.md
- actors-and-workflow-decisions.md
- technology-and-award-requirements.md

## 3. Figma file organization

Use clearly named pages/sections for foundations, reusable components, student screens, counselor screens, responsive layouts, prototype flows, and iteration/handoff notes. Required submission Slides may be a separate linked Figma Slides file.

The output must include the design system and the actual application screens. Dashboards alone are insufficient.

## 4. Design system

Create reusable foundations and components before composing the screens:

- Color palette and semantic colors for success, warning, error, information, and uncertain eligibility.
- Typography, spacing, layout grid, breakpoints, radii, and elevation.
- Buttons, links, icons, navigation, tabs, and breadcrumbs where useful.
- Form inputs, selects, multi-selects, validation, helper text, and grading-scale inputs.
- Program cards, comparison tables, filters, status badges, checklist items, timelines, and source citations.
- Dialogs, notifications, loading, empty, error, unavailable-data, and permission states.
- Voice controls and listening/thinking/speaking/error variants.
- Consistent focus, hover, selected, disabled, and validation variants where applicable.

Use accessible contrast, legible text, keyboard focus indicators, and responsive layouts. Organize components so their names and behavior can map clearly to implementation. Do not put infrastructure/vendor details into student flows unless they help the student make a decision.

Visual branding and product name remain TBD. Propose a coherent direction for review without treating it as a previously approved brand.

## 5. Required application screens

| Area | Design requirements |
| --- | --- |
| Student intake | Budget and currency/period, preferred countries, intended major, climate, population density, Indonesian grades and original grading scale, language scores, intended intake. Allow unknown values where appropriate. |
| University discovery | Results, search/filters, fit explanations, costs, academic gaps, source freshness, loading/error/empty states. |
| Program details | Requirements, tuition/living-cost distinctions, deadlines, scholarships where sourced, official sources, shortlist action, official application link. |
| Comparison and shortlist | Compare fit, total estimated cost, requirements, deadlines, and uncertainties; save/remove programs. |
| Grade equivalency | Original Indonesian grade and scale, destination requirement and scale, accepted mapping or direct qualification comparison, method/source, and outcome. Explicit “Needs confirmation” state when unsupported. |
| Student dashboard | Saved programs, application progress, upcoming deadlines, missing documents, next actions, and relevant counselor status. |
| Application workspace | Program-specific checklist, timeline, document status, next actions, and application drafts for student review. Exact upload/storage scope remains TBD. |
| Counseling | Accessible request entry points throughout the journey, request/assignment status, assigned counselor information, guidance, and follow-ups. Do not require a shortlist first. |
| Counselor dashboard | Assigned students, urgent tasks, unresolved eligibility questions, upcoming deadlines, and application readiness. |
| Counselor student detail | Relevant student context, selected programs, unresolved questions, checklist/progress, supporting sources, and follow-up actions, subject to access/consent decisions. |
| Voice adviser | Microphone permission, start/stop controls, listening/thinking/speaking states, transcript, unclear speech/error handling, and text fallback. Verify Indonesian support before promising it. |

Design desktop layouts and the key mobile versions of intake, discovery, grade mapping, dashboard, application checklist, counseling request, and voice interaction. Specify how comparison tables and counselor task lists adapt to small screens.

## 6. Prototype flows

Create a clickable prototype showing:

1. Student enters preferences and Indonesian grades with the original scale.
2. Student sees sourced program matches and academic-equivalency explanations.
3. Student compares and shortlists programs.
4. System presents a program-specific application checklist and timeline.
5. Student prepares the application and follows a link to submit through the official external portal.
6. Student tracks application progress.

Also prototype an optional counseling branch from an early stage, such as grade-equivalency uncertainty before shortlisting:

1. Student requests counseling without restarting intake.
2. System assigns a counselor; allocation policy is still to be determined.
3. Counselor sees the assigned case and relevant context.
4. Counselor reviews gaps and follow-up work.
5. Student continues the original journey independently or with guidance.

Include a meaningful voice interaction and its text fallback. The prototype may illustrate intended behavior; it does not replace the working application required for submission.

## 7. Design-to-code workflow

1. Confirm Figma write capabilities and access.
2. Create foundations and reusable components.
3. Design core screens and responsive behavior using those components.
4. Connect the main flow and early counseling branch.
5. Review with the user and test the flow where feasible.
6. Revise designs and record the real decisions/friction.
7. Implement components/screens from the Figma designs.
8. Update Figma for meaningful changes discovered during implementation.
9. Verify the built app against the approved flow and prepare submission materials.

The process can loop between design and code. Preserve the actual history; do not fabricate iteration, tests, timing, or tool contributions.

## 8. Figma award deliverables

Based on the supplied “Idea To Demo” challenge:

- Genuine Figma Education verification is required. Resolve any eligibility issue with the sponsor before assuming qualification.
- Submitted Figma files must be accessible to “Anyone.”
- Demo video: maximum 3 minutes.
- Workflow artifact/stage log: maximum 200 words per stage.
- Figma Slides: required, demonstrating the product and workflow.
- Include stage log/tool rationale, demo video, embedded Figma Make and/or prototype files, and working code/repository link in the submission Slides.

The stage log covers ideation, prototyping, handoff, and code generation. For each stage record:

- Which tools were used, including the specific Figma product where applicable, and why.
- Approximate minutes spent.
- Effectiveness rating from 1 to 5.
- How the output reached the final product.
- Actual rework, dead ends, and abandoned approaches where relevant.

Figma need not do every stage or generate all code. Show a meaningful, traceable contribution and honestly attribute Claude/other tools. Maintain this evidence during development; browser recording alone is insufficient.

## 9. Completion checklist

- [ ] Figma design write access verified; any limitations clearly reported.
- [ ] Design system and reusable component variants created.
- [ ] Student screens and counselor dashboard/detail designed.
- [ ] Grade mapping clearly distinguishes different scales and uncertainty.
- [ ] Counseling available at any stage; system assignment shown.
- [ ] Official external submission boundary is clear.
- [ ] Desktop and key mobile layouts created.
- [ ] Clickable main flow and early counseling branch work.
- [ ] Voice interaction and fallback designed.
- [ ] Meaningful review/iteration recorded honestly.
- [ ] Implementation follows designs; material changes reflected in Figma.
- [ ] Stage log, required Slides, prototype embeds, video, and repository links prepared.
- [ ] Education verification and judge-accessible sharing checked.

## 10. Reference links

- Figma Education: https://www.figma.com/education/
- Stage-log example supplied by challenge: https://www.figma.com/slides/hViyGFvaHxTBqzYKkaYPho

This document defines intended work, not proof that Figma integration access, designs, or award eligibility have already been completed.
