# University Adviser — Award Documentation and Evidence Plan

Version: 0.1
Date: October 24, 2026
Status: Planning. Built from the sponsor text supplied by the user (spec-v1.0.md Appendix B; original in `archive/technology-and-award-requirements.md`). Nothing here has been checked against the organizers' official rules yet (event name and rules page were not supplied).

## 1. Principle

Using a technology is not enough to qualify. Most tracks also judge the written and recorded evidence: stage logs, READMEs, process notes, public links, videos. This plan lists, for each sponsor, the artifacts we must produce, who produces them, and when. Evidence is captured while building, not reconstructed at the end. Nothing may be invented: no fabricated interviews, minutes, ratings, tool use, or iteration history.

## 2. Evidence the whole project keeps

| Artifact | What it contains | Owner | When |
| --- | --- | --- | --- |
| `docs/devlog.md` | Dated entries: what was done, tools used and why, rework, dead ends, abandoned approaches. | Claude appends each work session; user adds approximate minutes and 1–5 effectiveness ratings. | Continuously |
| `README.md` | Product summary, setup, architecture, limitations, and one section per sponsor explaining the running-product role separately from "used to write code". | Claude | Grows with each integration |
| `docs/sponsors/<name>.md` | Per-sponsor evidence page: configuration, trigger, input/output contract, errors, cost controls, how to reproduce, screenshots or run links. | Claude | When each integration works |
| `docs/failure-modes.md` | Known failure cases of Claude and extraction (wrong dates, unsupported equivalencies, blocked pages) and how the product handles them. | Claude | Ongoing |
| `docs/video-scripts.md` | Exact clicks, sample fictional profile, narration, and reset steps for each video variant. | Claude drafts, user rehearses | Before recording |
| Public-safe export | Everything above with secrets and personal data removed. | Claude | Before submission |

Secrets never appear in the repo, logs, screenshots or recordings.

## 3. Per-sponsor documentation requirements

"Source" is the supplied sponsor text. UNVERIFIED means the supplied text did not say, and the official rules must be checked.

### Figma — Idea To Demo
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Education verification | Must be genuine; resolve with the sponsor if not eligible. | User |
| Demo video | Maximum 3 minutes. | User records |
| Stage log | Stages: ideation, prototyping, handoff, code generation. Maximum 200 words per stage. Per stage: tools and why (naming the Figma product), approximate minutes, effectiveness 1–5, how output reached the product, actual rework and dead ends. | Claude drafts from devlog; user supplies minutes and ratings |
| Figma Slides | Must include the stage log, demo video, embedded Make and/or prototype files, and the working repository link. | Claude if write access allows, otherwise user with exact steps |
| Sharing | Every submitted Figma file accessible to "Anyone". | User, checked before submission |
| Prototype | Real iteration, with the review notes and what changed. | Claude, user reviews |
Risk: Claude's Figma write access is unverified. If unavailable, name the limitation and list the smallest manual steps.

### Mana
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Genuine use | A real planning, prototype, build or debugging task whose output affected the project. | User runs it in Mana, Claude identifies suitable tasks |
| Public pages | One or two public Mana pages or chats. | User shares |
| Demo moment | One moment in the demo showing where Mana changed the build or saved time. | User and Claude script it |
| Write-up | Where it helped, in README and submission. | Claude |
| Optional bonus | App hosted in Mana (up to +10). Not planned; do not duplicate the app just to claim it. | |
Judging: meaningful use 30%, usefulness 25%, originality 25%, execution 20%.

### Notability
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Chronological notes | Early sketch to final build, clear enough for someone else to follow. Made during development. | User |
| Feature use | Thoughtful use of relevant features (handwriting, audio, diagrams, PDFs, Smart Notes). Not all are mandatory. | User |
| Submission format | UNVERIFIED (sharing or export format not supplied). | User checks with sponsor |
Claude's part: give the user a short list of what is worth capturing at each phase, such as research findings, flow sketches, decision points. Claude cannot create Notability notes directly. A Markdown export imported only at the end is not valid evidence.

### Anthropic
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Named community | Indonesian high school students applying to US/UK undergraduate programs (not "students" alone). | Claude |
| Real problem evidence | Evidence from people actually affected, such as real conversations with students, parents or counselors. The user reports that interviews were done and the workflow is based on them (2026-10-24). | **User supplies the real details; Claude must not invent them.** Needed for the write-up: how many people, their roles (student, parent, counselor), when, how, and what they actually said or changed. No names or identifying details in public documents without their consent. |
| Working product | End-to-end flow with meaningful Claude API calls. | Claude |
| Claude's role | README explains Claude's runtime role, separate from Claude writing the code. | Claude |
| Harms and failure modes | `docs/failure-modes.md`. | Claude |

### Bright Data
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Live use | Real retrieval essential to the product. | Claude |
| Demo evidence | Show source URL, retrieval time, extracted result and the product consequence. | Claude and user |
| Failure handling | Blocks, slow pages and empty results shown and handled. | Claude |
| Disqualifiers to avoid | Login or paywall scraping, non-public personal data, mocked or hardcoded demo data, README-only mention. | All |
| Story | Clear two-minute story. No formal video limit stated. | User records |

### Apify — Best Use and Best Actor
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Working Actor | Built for the event, with source, input schema, and usage instructions. | Claude |
| Integration | Runs and outputs consumed by the app. | Claude |
| Best Actor entry | Publication and submission conditions UNVERIFIED. | User checks rules |
| README | Explains Apify's role versus Bright Data's. | Claude |

### Convex
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Official track rules | Not supplied; must be fetched and reviewed. | User supplies link; Claude reviews |
| Evidence | Schema documentation, access-control documentation, persistent data and meaningful backend operations shown in the demo. | Claude |

### Bitdeer AI Model Studio — not entered
Bitdeer was dropped on 2026-10-24 (user decision): extraction uses Claude, and the project does not enter the Bitdeer track. No Bitdeer deliverables.

### Factory Droid SDK
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Running-product use | Droid does real work inside the app; coding help alone does not count. | Claude |
| README | Where and how it is used. | Claude |
| Design evidence | Trigger, tool permissions, safety boundaries, failure handling, approval boundaries. | Claude |
| Visible results | Inspectable plans, steps, outcomes (agent run history). | Claude |

### Cartesia
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Working voice demo | Voice is core to a complete flow, with text fallback. | Claude |
| Presentation | Two-minute, demo-first. Separate from the three-minute videos. | User records |
| README | Short: setup, features, limitations. | Claude |
| Source access | Per event rules (details UNVERIFIED). No keys in the repository. | Claude |
| Tests | Interruption, mic permission, unclear speech, errors, text fallback, Indonesian quality. | Claude and user |

### Atlassian — Track 1: Agents that do the work
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Installed Forge app | In a Jira demo site, doing real actions. | Claude (code), user (accounts) |
| Demo video | Maximum 3 minutes. | User records |
| Repository link | Submitted with the video. | Claude |
| Evidence | Agent decisions, action history with source and reason, review boundaries, counselor workload reduction. | Claude |
| Track choice | Track 1 only. Do not claim both tracks without checking rules. | |
Judging: creativity and quality, usefulness and impact, technical implementation and operational robustness.

### Microsoft — Grand Prize and Customer Impact
| Deliverable | Detail | Owner |
| --- | --- | --- |
| Customer understanding | Clear problem, validated with real people where feasible. | User (conversations), Claude (write-up) |
| Measured benefit | Measure, do not invent: time to build a sourced shortlist, completeness of verified information, counselor actions saved. | Claude measures from real runs |
| Responsible design and production path | Documented. | Claude |
| Entry mechanics | Whether both categories need separate selection. UNVERIFIED. | User checks |
No Azure or separate Microsoft account is required by the supplied criteria.

## 4. Videos to prepare

| Variant | Length | Used for |
| --- | --- | --- |
| Main demo | 3 minutes maximum | Figma, Atlassian; reuse for other tracks only if their rules allow |
| Cartesia | 2 minutes, demo-first, voice-led | Cartesia |
| Other sponsors | Limits UNVERIFIED | Check each sponsor's rules before reusing |

## 5. Cross-sponsor checks still open

- Official hackathon name and rules page (not yet identified).
- Participant and team eligibility.
- Whether one project may enter several tracks and win more than one prize.
- Deadlines and submission fields per sponsor.
- Convex track rules, Apify Best Actor conditions, Notability and Mana submission formats, Microsoft entry mechanics.
- Sponsor credit availability.
- Whether one recording may be reused across tracks.

## 6. When evidence must be captured

| Build phase | Evidence to capture then |
| --- | --- |
| Setup | Figma Education verification started, credit claims, Notability and Mana accounts live, `devlog.md` begun |
| Design | Notability sketches and decisions; Figma stage entries (ideation, prototyping) with real minutes |
| Data pipeline | Bright Data call logs and screenshots; Apify Actor and run links; Claude source-to-record examples |
| Core app | Convex schema and access docs; Claude interactions; failure cases |
| Agents | Factory run history; Forge/Jira action history |
| Voice | Cartesia test results including Indonesian quality |
| Handoff | Figma handoff and code-generation stage entries; Mana public pages and demo moment |
| Submission | Stage log, Slides, README, public-safe export, videos, sharing checks, final rules check |

## 7. Actions only the user can do

1. Complete Figma Education verification and set files to "Anyone".
2. Talk to real students, parents or counselors and record what they say (Anthropic, Microsoft).
3. Use Notability during development and Mana for real tasks, and share public Mana pages.
4. Provide approximate minutes and 1–5 ratings for the stage log.
5. Supply the hackathon rules link and check the UNVERIFIED items with the organizers.
6. Record the videos.
