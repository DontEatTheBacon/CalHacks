# Additional Requirements — Program Timelines and International Application Milestones

Date: October 24, 2026  
Status: Additional required product scope; supplements preliminary-requirements.md without modifying it. Includes additional Figma screen requirements.

## 1. Core requirement

Every selected school/program must have its own actionable timeline for the student's intended intake and applicant circumstances. Make timeline information available on program details before shortlisting, and create a personalized plan when the student saves/selects a program for application.

Do not use one generic school deadline. Requirements can differ by program, degree, campus, intake, admission round, international applicant status, scholarship, and application route. Track each application separately while providing an aggregated student calendar and next-actions dashboard.

The categories below define research and UI requirements. They are not assertions of current immigration or university policy. Country-specific applicability, dates, and procedures must be checked against current official sources during implementation and refresh.

## 2. Timeline milestone coverage

| Area | Milestones to research and track when applicable |
| --- | --- |
| Application rounds | Application opening; early decision; early action; restrictive/single-choice early action; priority; regular decision; rolling admissions; additional rounds; clearing or supplemental application windows; international-specific cutoff; late application policy. Preserve official names and distinguish binding from nonbinding only when verified. |
| Application route | Direct university submission; centralized portal; faculty/school application; document-evaluation intermediary; scholarship-sponsored route; separate portal registration or nomination deadlines. |
| Academic eligibility | Qualification assessment; different-scale GPA equivalency confirmation; subject prerequisites; predicted versus final grades; graduation date; final results submission; foundation/pathway eligibility. |
| English proficiency | Accepted tests and exemptions; minimum overall/component scores; test registration; recommended test date; test result availability; retake buffer; score validity at the relevant checkpoint; self-report deadline; official score arrival deadline; institution/program recipient codes where applicable; waiver request and decision. TOEFL is one example, not a universally accepted requirement. |
| Other language proficiency | Required teaching-language evidence, such as German, Japanese, or Korean when relevant; accepted tests/exemptions; preparation, booking, results, submission, and validity checkpoints. English-taught and local-language programs may differ. |
| Other exams | Required or optional admissions tests, aptitude/subject tests, entrance examinations, interviews, auditions, portfolios, writing samples, prerequisite assessments, and test-result delivery deadlines. |
| Application materials | Passport; transcripts; grading explanation; predicted grades; graduation certificate; essays/personal statement; activities/CV; portfolio; recommendations; counselor/school reports; certified translations; required certification/legalization; document verification. |
| Third-party contributors | Request recommendations and school documents; give contributors their actual submission deadline; account for school closures and processing times; distinguish student submission from recommender submission. |
| Submission and fees | Application opening and submission deadline; fee payment cutoff; fee waiver request; document receipt cutoff; corrections/supplement window; portal confirmation and completeness checks. |
| Scholarships and aid | Separate scholarship opening/deadline; nomination; external funding; required financial-aid forms; need-based/merit funding; scholarship interview; results; funding acceptance and conditions. Never assume the admission deadline also covers scholarships. |
| Admission decisions | Expected decision date/window; interview invitations; waitlist response; supplemental evidence; appeals if applicable; deferral requests and policy. |
| Offer and enrollment | Offer acceptance; deposit; enrollment confirmation; conditional-offer requirements; final transcript and language-score conditions; withdrawal obligations; refund/cancellation deadlines where verified. |
| Housing | Housing application opening; priority/guarantee eligibility and cutoff; application/deposit; room selection; acceptance; contract/payment; cancellation/refund; move-in dates; alternatives if university housing is unavailable. Do not imply housing is guaranteed. |
| Immigration and funding evidence | Correct student visa/residence route; university-issued immigration documents; passport validity requirements; financial evidence; sponsor documents; bank/blocked-account evidence where applicable; appointments/biometrics; health checks/insurance if required; application timing; estimated processing window; travel restrictions/conditions requiring confirmation. |
| Pre-departure | Visa outcome; insurance; immunization/medical records if required; accommodation confirmation; travel booking; official latest-arrival date; orientation; transport; emergency contacts. Avoid advising nonrefundable booking based on unconfirmed assumptions. |
| Arrival and registration | Arrival window; campus check-in; original-document checks; local registration/residence formalities; course registration; tuition payment; orientation; semester start. |
| Continuing conditions | Scholarship continuation, required enrollment/attendance steps, and follow-up obligations only to the extent relevant to the selected application and verified scope. |

## 3. Country-aware research templates

Use these as candidate research branches, not automatic mandatory tasks. The student's nationality/residence, qualification, program, funding, and route determine applicability. Do not transfer a process for another nationality to an Indonesian applicant without verification.

| Destination | Additional branches to check against official sources |
| --- | --- |
| United States (US) | Institution-specific early/regular/rolling rounds; binding commitments; direct versus shared application portal; counselor/recommendation deadlines; test policy; international financial-aid eligibility and forms; enrollment deposit; housing; appropriate university immigration documentation, visa/fee/appointment steps, and arrival conditions. |
| United Kingdom (UK) | UCAS versus direct application; course-specific or earlier deadlines; equal-consideration/other applicable windows; admissions tests/interviews; conditional offer and final results; firm/insurance choices where relevant; clearing; CAS and visa pathway if applicable; accommodation guarantees and their separate conditions. |
| Germany (DE) | Direct, uni-assist, or another prescribed route; qualification recognition; VPD if required; Studienkolleg/foundation and entrance exams if applicable; language requirements; semester-specific windows; certified documents/translations; Indonesian-applicant-specific verification if any; funding evidence/blocked account if required; visa/residence and local registration. Never assume APS or another country-specific verification applies to Indonesian students. |
| Australia (AU/AUS) | Institution/intake-specific applications; direct/agent/centralized route where prescribed; conditional offers; acceptance/deposit; CoE if applicable; current student visa evidence and health-insurance requirements; accommodation; orientation and latest arrival. |
| Japan (JP) | English-taught versus Japanese-taught routes; university-specific rounds; EJU/JLPT or other tests only if required; entrance exams/interviews; scholarship nomination/application calendars; Certificate of Eligibility and visa route if applicable; dormitory rounds; semester-specific arrival/enrollment. |
| South Korea (KR) | International admission rounds and semester; English/Korean teaching-language requirements; TOPIK or other evidence only if required; document authentication and financial evidence; scholarship calendars; dormitory application; university immigration documents and appropriate visa/residence steps. |
| Other destinations | Configurable template for local application portals, language tests, qualification evaluation, scholarship/housing windows, immigration milestones, and enrollment/arrival formalities. Research local official sources rather than assuming US/UK conventions. |

Immigration steps require current official government/consular sources as well as university guidance. Present planning assistance, source links, and uncertainty; do not represent the app as a visa authority or guarantee processing/admission outcomes.

## 4. Deadline data model

Each milestone must support:

- Institution, campus, program, degree, intake/year, round, application route, and applicant-category applicability.
- Category and official milestone name; plain-language explanation and responsible party (student, school, recommender, counselor, university, or authority).
- Date or date range, original published timezone, local cutoff time, and displayed timezone. Show the official timezone alongside the student's local time when known. Never guess a cutoff time when only a date is published.
- Date type: verified hard deadline; official opening; official expected window; processing estimate; internally recommended target; student-entered date; or unpublished/unknown.
- Mandatory/optional/conditional/not-applicable state, with the reason and trigger condition.
- Dependencies, prerequisite documents, estimated lead time, and available buffer. Lead times must have a source or be explicitly identified as planning assumptions.
- Status: not started, in progress, waiting on someone, submitted, confirmed complete, overdue, or not applicable. Submission is not the same as receipt or approval.
- Official source URL, supporting excerpt or evidence reference, published/effective date when available, retrieval/last verification time, and verification status.
- Change history, prior value, affected student tasks, and manual corrections with provenance.
- Reminder preferences and completion evidence or notes, subject to privacy/storage decisions.

Store dates and their semantics so date-only cutoffs, rolling windows, and unknown dates are not silently converted into fabricated precise timestamps. Support multiple milestones in the same category.

## 5. Dependency and reverse planning

Generate a personalized preparation schedule backward from verified deadlines:

- Test booking → test date → results → possible retake → official score delivery → university receipt cutoff.
- Request school documents → school processing → translation/certification if required → document submission/receipt.
- Request recommendation → contributor preparation → separate recommendation deadline.
- Admission offer → acceptance/deposit → university immigration document → visa application/appointment/outcome → permitted travel/arrival → enrollment.
- Housing application may open before admission or depend on acceptance; follow the actual institution's policy rather than a fixed global order.
- Scholarships may close before admission applications. Highlight the earliest applicable hard cutoff.

Never treat these example chains as universal. Model actual dependencies and allow parallel work. Distinguish official deadlines from recommended “do this by” dates visually and in notifications.

## 6. Missing, changing, or impossible dates

- Show “Not yet published,” “Needs confirmation,” “Not applicable,” or “Estimated window” as appropriate; do not invent dates to fill a timeline.
- If the official deadline has passed, mark the round closed and offer verified alternative rounds/intakes where available.
- If a required task cannot plausibly finish in time, flag the dependency risk and explain assumptions. Do not promise a test appointment, visa appointment, or processing time.
- Preserve conflicting source details and route for review. Never silently choose an easier deadline.
- On a verified change, identify affected students, recompute recommended targets, preserve history, and create relevant counselor follow-up work for assigned cases.
- Reminder channels, refresh cadence, and notification delivery remain to be decided. This requirement does not create a scheduled automation by itself.

## 7. Student experience and Figma screens

Add these designs to the existing Figma scope:

1. **Program details — Dates and requirements:** intake/round selector, upcoming official dates, language requirements, separate scholarship/housing dates, and source/last-checked details. Show before the student commits to a program.
2. **Personalized program timeline:** grouped milestones from research through arrival; toggle/list/calendar treatment as appropriate; status, owner, dependencies, and official-versus-recommended date labels.
3. **Language test planner:** current score or not-yet-tested state, accepted test/exemption, component requirements, validity, retake and score-delivery planning. Avoid a universal TOEFL-only flow.
4. **All applications calendar / next actions:** aggregate milestones across selected programs, with program/intake/round labels and meaningful deadline-risk visibility.
5. **Housing and immigration checklist:** conditional country/program-specific steps with authoritative sources, unknowns, and dependencies.
6. **Counselor timeline review:** assigned student's conflicting/unknown dates, bottlenecks, third-party dependencies, and sourced change history.

Counseling can be requested from any timeline or eligibility state, including before shortlisting. System assignment remains the agreed behavior. Students continue independently if they do not request counseling.

## 8. Technology responsibilities

- Bright Data + Apify: retrieve and refresh applicable official admissions, scholarship, housing, and government source material through permitted public access.
- Bitdeer: extract candidate structured milestone records with evidence.
- Deterministic validation/rules: resolve date semantics, compare requirements, calculate dependencies and recommended targets; flag ambiguity rather than accepting model guesses.
- Convex: persist versioned milestones, source provenance, per-student plans, task status, and access controls.
- Claude API: explain dates/gaps, ask for missing context, and summarize personalized next actions from verified records.
- Factory: bounded triggered research/checklist updates with visible steps and proposed changes.
- Forge/Jira: follow-up tasks and counselor coordination when appropriate for assigned students.
- Cartesia: allow students to ask about their next deadline and explain timeline risks through the same grounded records.

## 9. Acceptance criteria

- [ ] Every selected application has an intake/round-specific timeline, not just a generic university deadline.
- [ ] Language testing distinguishes taking the exam, results availability, official score delivery/receipt, validity, and waivers.
- [ ] Early/priority/regular/rolling variants are supported only where published and relevant.
- [ ] Scholarship, housing, visa, acceptance, deposit, final-document, enrollment, and arrival milestones are represented when applicable.
- [ ] Different deadlines for international applicants/programs are correctly scoped.
- [ ] Official cutoffs, recommended preparation dates, and estimated processing windows are visibly distinct.
- [ ] Date-only/timezone-unknown milestones are not assigned invented cutoff times.
- [ ] Student view aggregates dates across programs while preserving each program's requirements and sources.
- [ ] Missing/conflicting/outdated dates remain visible and trigger appropriate review.
- [ ] A verified deadline change updates dependent tasks and exposes the change history.
- [ ] Country templates do not imply every student must complete every candidate requirement.
- [ ] Students can request counseling at any stage and still submit applications themselves through official portals.

## 10. Open decisions

- Initial supported universities, countries, intakes, and qualification routes.
- Exact government/university source registry and refresh/verification policy.
- Reminder channels, timing preferences, and calendar export/sync scope.
- Whether students enter external test/visa appointment dates manually in the first version.
- Document storage, access consent, and retention.
- Which planning buffers can be justified and how users can adjust recommended dates without altering official deadlines.
