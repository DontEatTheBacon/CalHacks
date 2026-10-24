# International University Adviser — Preliminary Requirements

Version: 0.3 — discussion draft  
Date: October 24, 2026  
Working product name: TBD

## 1. Purpose and audience

Build a web application that helps Indonesian high school students discover, compare, and prepare applications to universities abroad. AI should turn verified university information and student preferences into understandable recommendations and actionable application plans.

Assumption to confirm: “international schools” means overseas universities and undergraduate programs, rather than overseas secondary schools.

The secondary audience is school counselors who help students manage applications. The counselor workflow enables the Atlassian Forge component.

## 2. Responsibilities

- Claude handles architecture, coding, integrations, testing, deployment preparation, and technical documentation.
- The user does not need programming knowledge. The user creates accounts, completes identity/education verification, enters secrets securely, reviews the experience, and records the browser demo.
- Claude must give exact, manageable instructions whenever a manual step is necessary. Do not assume Claude can operate every external design or note-taking tool; identify any required user actions early.
- Development evidence must reflect the actual process. Do not fabricate tool use, interviews, time spent, ratings, prototypes, or iteration history.

## 3. Scope and priorities

### Core application

1. Student profile and preference intake.
2. Verified university/program research and structured data collection.
3. Explainable matching and comparisons.
4. Saved shortlist and application workspace.
5. Agent-generated research, checklists, and progress reports.
6. Counselor workflow through an Atlassian Forge app for Jira.
7. Cartesia voice consultation after the core application works.

Start with a small, explicit set of countries, institutions, and programs. Initial destinations and data volume remain TBD. Build one complete flow before expanding coverage.

### Outside current scope

- Meta peer/mentor networking and SpacetimeDB integration.
- Guaranteed admission predictions or claims that published eligibility guarantees acceptance.
- Autonomous submission of university applications, payments, or messages without explicit approval.
- Visa applications, financial underwriting, and unrelated features added solely to chase prize tracks.

## 4. Student intake

Collect and allow editing of:

| Input | Required behavior |
| --- | --- |
| Budget | Amount, currency, annual versus total budget; distinguish tuition and living costs. |
| Countries | Preferred destinations and exclusions. |
| Major | Intended field and related acceptable programs. |
| GPA / school grades | Indonesian grades, original grading scale, curriculum, school grading policy where available, and relevant subject grades; map to each destination program’s requirements using documented equivalencies. |
| Climate | Preferred conditions; define the supported measurements and data source. |
| Population density | Preference for quieter versus denser destinations; define the geographic boundary and metric. |
| Language scores | Scores if available, or explicitly unknown/not yet taken. |
| Start date | Intended intake/year so deadlines and costs are relevant. |

Budget, country, major, climate, population density, and GPA are the original requested matching criteria. Language scores and intake date support eligibility and deadline checking.

The demo must support an Indonesian-language experience; exact bilingual scope remains TBD. Validate Indonesian speech support separately before committing to voice functionality in that language.

## 5. University data and provenance

- Prefer official university and scholarship sources for requirements, tuition, deadlines, and application links.
- Store institution, program, location, degree level, intake, tuition/currency, admission requirements, language requirements, scholarships, deadlines, and official application URL where available.
- Every extracted factual record must retain its source URL, retrieval time, relevant intake/year, and verification status.
- Clearly distinguish unknown, unavailable, stale, conflicting, and verified information.
- Living cost, climate, and population-density sources must be selected and documented. Do not silently substitute model estimates for sourced facts.
- Record whether tuition is annual or total and what fees are excluded. If converting currencies, retain the original amount and exchange-rate source/date.
- Use public information. Bright Data's supplied challenge prohibits scraping behind login/paywalls, collecting non-public personal data, or presenting mocked/hardcoded data as live demo results.
- Collection should handle failed requests, slow pages, empty results, changed layouts, retries, and duplicate records.

## 6. Matching and advising

- Separate hard constraints, published eligibility requirements, soft preferences, and missing information.
- Apply explicit calculations and rules for comparable costs and basic eligibility; use AI to interpret and explain the evidence.
- Never equate GPA scales without a documented basis or invent university conversion rules.
- Show why each program fits, where it does not fit, and what the student needs to verify.
- Avoid unsupported acceptance probabilities. Meeting stated requirements is not an admission guarantee.
- Allow comparison of shortlisted programs, estimated total costs, requirements, deadlines, and preference fit.
- Recommendations must link to supporting sources and identify uncertainty.

### Indonesian grade and GPA equivalency mapping

This is a core requirement, not an optional AI explanation. The student’s Indonesian school grades and the destination university’s required GPA may use different grading scales. The application must identify both scales, map the student’s result to the required scale using an applicable university-accepted equivalency, and then compare against the program’s academic threshold. Do not compare the two raw numeric values as if they shared a scale. Where the university publishes requirements directly for Indonesian qualifications, use that direct comparison instead of an unnecessary conversion.

- Capture the original reported grades, scale/minimum and maximum where applicable, curriculum, qualification, school/year, and subject-level results when the program requires them. Do not assume every Indonesian student uses the same grading system.
- Preserve original grades alongside any mapped result; never overwrite the student’s record with a converted GPA.
- First look for the target university’s published Indonesian qualification/grade requirements. Where available, compare directly rather than performing an unnecessary conversion.
- Otherwise use a university-approved or explicitly accepted equivalency method for the relevant qualification and intake. Record source URL, method, applicability, and retrieval date.
- Do not invent a universal Indonesian-to-4.0 GPA formula or use simple percentage scaling as an official equivalency. An external calculator is not automatically accepted by a university.
- If only an unofficial estimate is available, label it clearly as an estimate, explain assumptions, and keep official eligibility unresolved. If no defensible mapping exists, show “Needs university confirmation” rather than a fabricated conversion or definitive pass/fail.
- Evaluate subject prerequisites separately from overall grades, and distinguish minimum entry requirements from competitive admission expectations.
- Display: original Indonesian grade and source scale → equivalent result and destination scale → required GPA/grade and its scale → meets published minimum / below published minimum / needs confirmation. Include the mapping method and source. For direct Indonesian qualification requirements, show the original result and applicable requirement without inventing a converted GPA. Meeting an academic minimum does not imply admission.
- Use deterministic, versioned comparison logic for established rules; AI may retrieve candidate policies and explain results, but must not invent conversion rules.
- Allow the student/counselor to inspect the source and correct the entered grading context. Track rule changes and recalculate affected matches.

Acceptance examples:

1. A university publishes Indonesian entry requirements: the app compares against those directly and cites the applicable qualification/intake.
2. A student reports a result on a 0–100 scale while a program requires GPA on a 4.0 scale: the app identifies the scale mismatch, applies an applicable university-accepted equivalency if available, and displays original result/scale, equivalent result/scale, required threshold, and source. It must not compare the raw values or assume proportional scaling.
3. A program lists a foreign GPA threshold without an accepted mapping: the app marks academic eligibility as needing confirmation.
4. A student meets the overall requirement but lacks a required subject grade: the app identifies the separate subject gap.

## 7. Application workspace

- Save and remove programs from a shortlist.
- Generate a program-specific checklist and timeline from sourced requirements.
- Track missing documents, next actions, deadlines, and application status.
- Support draft application responses for student review without inventing student achievements or history.
- Provide links to official application portals.
- Exact document-upload/storage implementation is TBD; minimize sensitive data in the initial demo.

## 8. Architecture and sponsor responsibilities

These are intended implementation roles, not a guarantee of prize eligibility. Each integration must contribute to the working flow and be demonstrable.

| Service | Intended contribution | Acceptance evidence |
| --- | --- | --- |
| Anthropic / Claude API | Advising, matching explanations, application planning, and reviewed drafts. | Specific student need, working flow, grounded responses, and known failure modes. |
| Convex | Primary application backend for profiles, university records, shortlists, and progress. | Persistent data and functioning application operations. Full track eligibility rules still need review. |
| Bright Data | Discover official university sources and retrieve live public web information. Proposed products: SERP API and Web Unlocker. | Real live retrieval essential to the product; failures handled visibly. |
| Apify | Reusable admissions Actor for structured collection from official sources. | Working Actor, runs/results, meaningful app integration; verify Best Actor submission rules. |
| Bitdeer Model Studio | Convert collected page content into structured admissions, tuition, and deadline fields. | Actual Model Studio calls, validated output, and retained source provenance. |
| Factory Droid SDK | Triggered research and application-checklist work inside the running product. | Trigger, limited permissions, visible steps/results, and README explanation. Coding assistance alone does not qualify. |
| Atlassian Forge / Jira | Autonomous counselor task coordination. | Installed Forge app, real Jira actions, approvals where appropriate, and audit history. |
| Cartesia | Voice intake and discussion of university matches, central to the voice experience. | Complete voice consultation; verify Indonesian support and required TTS/STT access. |
| Figma | Prototype, iteration, and traceable handoff to implementation. | Accessible prototype files, honest stage log, required Figma Slides. |
| Mana | Meaningful planning, prototyping, building, or debugging during development. | Public pages/chats and a concrete example of its contribution. |
| Notability | Research notes, sketches, decisions, and idea evolution. | Actual development history and meaningful feature use. |
| Microsoft track | Production-minded AI agent with useful end-to-end behavior. | Measurable benefit, responsible design, working demo, production path. Supplied criteria do not mandate Azure. |

Avoid redundant integrations. Proposed division: Bright Data discovers/retrieves sources, Apify orchestrates repeatable admissions collection, Bitdeer structures content, Claude advises, and Factory performs bounded triggered tasks. Claude must validate that this division is technically practical before implementing it.

## 9. Atlassian counselor workflow

Target Track 1: Agents that do the work.

- Build an actual Forge app installed in a Jira demo site; an external Jira API integration alone is insufficient for this challenge.
- Represent student applications as linked work items with counselor ownership, status, deadlines, and missing requirements.
- On a verified change or application event, identify affected applications, create/update follow-up tasks, assign work, and summarize urgent actions.
- Retain the source, action history, and reason for each automated update.
- Require review before consequential external communication or application submission.
- Confluence is optional; do not add it unless it improves the working flow.

Suggested demonstration: a sourced deadline change affects a student's application; the agent updates related work and creates an urgent counselor follow-up. Any controlled test event must be labeled honestly.

## 10. Figma and development-process deliverables

The supplied Figma challenge requires Education verification and three deliverables:

1. Demo video, maximum 3 minutes.
2. Workflow artifact/stage log, maximum 200 words per stage.
3. Figma Slides demonstrating the product and workflow, embedding Make/prototype files and including the working repository link and demo.

Track ideation, prototyping, handoff, and code generation. For each stage record tools used and why, approximate minutes, effectiveness from 1–5, and how output reached the final product. Explain stages where tools other than Figma did the work. Record actual rework and friction. Submitted Figma files must be accessible to “Anyone.”

Figma does not need to generate all code or be used at every stage. Proposed meaningful use: prototype intake, comparison, and checklist flows; review and revise before handoff to Claude.

Maintain Mana and Notability evidence during development, not retrospectively as invented history. Browser recording alone does not satisfy these process requirements.

## 11. Accounts and credentials

Claim sponsor hackathon credits before purchasing. Start Figma Education verification early; eligibility must be genuine.

| Account | Required access / credential |
| --- | --- |
| Anthropic Console | Project workspace and regular workspace API key; no Admin API key required. App API billing/access is separate from a Claude coding subscription. |
| Convex | Project and development deployment; CLI authentication. Claude configures a deployment-scoped key if needed, including deployment permission for automated deployment. |
| Bright Data | Configured product zones and runtime API key with User permission; save zone names. Product configuration is performed by the account owner. |
| Apify | Actor development/run access. Separate runtime permissions for running the selected Actor and reading output from development access needed to create/modify Actors. Exact token configuration follows implementation. |
| Factory | Droid SDK access and Factory API key. |
| Bitdeer | Model Studio inference access and API key; GPU rental is not part of the proposed architecture. |
| Cartesia | TTS/STT developer access and server API key; browser credentials configured by Claude. |
| Atlassian | Forge-scoped login token using recommended scopes, plus Jira demo site. Claude sets app scopes in its manifest, based on actual endpoints; likely Jira work read/write access. |
| Figma | Account, eligible Education verification, prototype/Design and Slides access. No personal token needed until a specific integration requires it. |
| Mana | Workspace access and ability to share selected development pages/chats publicly. |
| Notability | Account and necessary note-taking features. Paid Pro is not established as an eligibility requirement. |
| GitHub | Existing account and project repository; no duplicate account needed. |

No separate Microsoft service account is required by the supplied track criteria. Hosting, frontend framework, authentication approach, and any additional accounts remain implementation decisions.

Keep secrets in environment/secret settings, never in chat, browser code, logs, or the repository. Credentials and permissions must be confirmed against current service interfaces during setup.

## 12. Reliability and responsible behavior

- External failures must not erase student input or silently produce fabricated results.
- Validate model output against a structured schema and source evidence before using extracted facts.
- Treat collected website content as untrusted data, not agent instructions.
- Keep student data separated by account; counselors access only authorized students.
- Bound agent tools and permissions; make actions and failures inspectable.
- Set usage limits and monitor API spending; clarify sponsor credit availability.
- Use fictional student profiles for demos. Test-data labeling must not obscure requirements for live public university data.
- Support usable desktop and mobile browser layouts and basic keyboard accessibility.

## 13. Implementation sequence

1. Verify event eligibility, multiple-track entry/winning rules, sponsor offers, and full rules still missing.
2. Create accounts, begin Figma verification, claim credits, and configure secrets.
3. Choose demo scenario, initial coverage, frontend/hosting/authentication, and data schema.
4. Begin honest Figma, Mana, and Notability process records; prototype core flows.
5. Establish Convex backend and student intake.
6. Implement Bright Data + Apify collection, Bitdeer extraction, provenance, and validation.
7. Implement matching, Claude advising, comparison, shortlist, and application workspace.
8. Add bounded Factory research/checklist actions with visible execution evidence.
9. Build and install Atlassian Forge counselor workflow.
10. Add Cartesia voice consultation after the core flow is reliable.
11. Test complete flows, service failures, source accuracy, costs, GPA handling, permissions, and mobile usability.
12. Deploy, prepare documentation and submissions, and rehearse browser recording.

## 14. Demo and acceptance checklist

Primary flow: one Indonesian student's profile → three sourced program matches → comparison and shortlist → complete application plan → counselor follow-up. Voice demonstrates intake or a discussion of those matches.

- [ ] Profile persists and can be edited.
- [ ] All six original matching factors influence results or are explicitly marked unavailable.
- [ ] Current official source data is collected live for the research demo.
- [ ] Costs show currency, period, inclusions, assumptions, and sources.
- [ ] Indonesian grades are mapped or directly compared against each program’s requirements using applicable documented rules.
- [ ] Original grades, mapped results, sources, and assumptions remain visible; unsupported equivalencies produce “Needs university confirmation.”
- [ ] Eligibility checks distinguish overall grades, subject requirements, missing information, and admission uncertainty.
- [ ] Shortlist, checklist, timeline, and progress work end to end.
- [ ] Factory SDK performs visible product work.
- [ ] Forge app performs real counselor-workflow actions in Jira.
- [ ] Cartesia consultation completes without breaking the text flow.
- [ ] Each claimed sponsor has demonstrable use and a README explanation.
- [ ] Failed services produce actionable messages and retain user input.
- [ ] User can perform the recording from a prepared browser flow without coding.

## 15. Submission package

- Working application and judge access instructions.
- Code repository, setup instructions, architecture summary, and limitations.
- Sponsor-by-sponsor integration explanation and evidence.
- Demo video: Atlassian and Figma each require maximum 3 minutes; Cartesia supplied instructions request a 2-minute demo-first presentation. Prepare appropriate variants rather than assuming one video satisfies all tracks.
- Figma Slides, accessible embedded prototypes, and stage log.
- Public Mana evidence and Notability development notes where required.
- Apify Actor link and any separate Best Actor submission.
- Browser recording script with exact clicks, sample input, narration, and reset instructions.

Target categories: Anthropic; Bright Data; Apify Best Use and Best Actor; Microsoft Grand Prize and Customer Impact where applicable; Factory; Mana; Notability; Atlassian; Figma; Convex; Bitdeer; Cartesia.

Prize eligibility is not yet guaranteed. Full Convex rules, multi-track rules, sponsor credits, participant eligibility, final submission details, and any additional API restrictions require confirmation.

## 16. Open decisions before implementation

1. Confirm undergraduate universities versus international secondary schools.
2. Product name, initial countries/programs, and demo coverage.
3. Indonesian-only versus bilingual interface and verified voice-language support.
4. Actual student/counselor needs, based on interviews if feasible; never invent validation.
5. Hosting, authentication, document storage, and privacy/retention decisions.
6. Credible sources for living costs, climate, population density, exchange rates, and university-specific Indonesian grade equivalencies.
7. Hackathon rules allowing multiple tracks and prizes; remaining sponsor eligibility details.
8. Whether Figma Education verification and required tool access can be completed in time.
9. Confirm a feasible division of work among collection and agent services before building integrations.

## 17. Reference links

- Anthropic API: https://platform.claude.com/docs/en/get-api-key
- Convex: https://docs.convex.dev/
- Bright Data authentication: https://docs.brightdata.com/api-reference/authentication
- Apify API integration: https://docs.apify.com/integrations/api
- Factory SDK: https://docs.factory.com/sdk/typescript
- Bitdeer AI: https://www.bitdeer.ai/
- Cartesia: https://docs.cartesia.ai/get-started/overview
- Forge setup: https://developer.atlassian.com/platform/forge/getting-started/
- Atlassian starter: https://github.com/atlassian-labs/forge-inspired
- Figma Education: https://www.figma.com/education/
- Mana: https://www.mana.space/
- Notability: https://notability.com/

Basis: conversation decisions, user-supplied sponsor challenge descriptions, and account/setup documentation reviewed during planning. This draft is a handoff for implementation, not a claim that integrations or eligibility checks are already complete.
