# Langkah — Engineering Detail

Date: October 24, 2026
Status: Architect's decisions for a prototype. These fill the gaps left by `spec-v1.0.md`. Values marked DEFAULT are the architect's choice, are editable in config, and are not official facts. Nothing here has been run.

## 1. Server function surface (Convex)

Every public function first resolves the caller (Convex Auth identity → `users` row → role) and rejects otherwise. "Owner" means the student whose data it is.

| Module | Function | Caller | Notes |
| --- | --- | --- | --- |
| profiles | `getMine`, `upsertMine` | student | Writes append to `profileHistory`; originals in `qualificationRecords` are never overwritten |
| profiles | `requestDeletion` | student | Creates `deletionRequests`; a scheduled job executes it |
| catalog | `listPrograms(filters)`, `getProgram(id)` | any signed-in | Applies country and setting hard filters; returns banded fit for the caller's profile |
| matching | `rank(profileId, filters)` | server only | Pure functions from config |
| applications | `save(programId, intakeId)`, `remove(id)`, `listMine` | student | `save` creates an `agentJobs` row |
| tasks | `listMine`, `setStatus`, `setStudentDate` | student | Student-entered dates are never overwritten by agents |
| counseling | `request(context)` | student | Runs round robin in one mutation |
| counseling | `listAssigned`, `getCase(id)` | counselor | Only assigned students |
| messages | `list(conversationId)`, `send` | student or assigned counselor | Rejects others |
| files | `startUpload`, `finishUpload`, `listMine`, `share`, `unshare`, `remove` | student | Types and sizes from config |
| files | `download` (HTTP action) | owner or shared counselor | Never exposes storage URLs |
| ingestion | `startRun(institutionIds, majors)` | server/admin script | Starts the Apify Actor asynchronously |
| ingestion | `onApifyWebhook` (HTTP action) | Apify | Secret path, idempotent by run ID |
| ingestion | `extractBatch`, `validateAndStore` | scheduled/server | Runs the rule-based extractor, then the validator |
| agents | `claimJob`, `appendStep`, `proposeChecklist`, `proposeResearchNote`, `finishJob` | Factory worker (service credential) | Narrow: no student record writes |
| integrations | `sendToForge(event)`, `onForgeCallback` (HTTP action) | server / Forge | HMAC signed |
| advice | `explainMatch`, `planSummary`, `nextActions` | student | Templates over verified records (no generative AI) |
| voice | `issueToken` | student | Short-lived Cartesia token |
| metrics | `record(event)` | server | For the Microsoft measures |

## 2. Tables (key fields)

Types: `id` = Convex ID; `ts` = number (ms); `enum` = string union. Every table also has `_id` and `_creationTime`. Indexes in brackets.

- `users`: Convex Auth fields (name, email, …) plus role (enum student|counselor), locale. [email] Auth sessions and accounts live in the Convex Auth tables.
- `studentProfiles`: userId, budgetAmount, budgetCurrency, budgetPeriod (annual|total), budgetScope (tuition_only|all_in), countries (US|GB[]), settings (city|countryside[]), majors (string[]), climate (enum), intakeTerm, intakeYear, version, updatedAt. [by_user]
- `qualificationRecords`: userId, curriculum, school, year, scaleMin, scaleMax, reportedOverall, notes, createdAt. Append-only. [by_user]
- `subjectGrades`: qualificationId, subject, grade, scale.
- `languageEvidence`: userId, test, score, components (json), takenOn, status (taken|not_taken|unknown), validUntil.
- `institutions`: name, country, domains (string[]), coverageStatus. [by_country]
- `campuses`: institutionId, address, lat, lng, settingClass (enum city|countryside|unclassified), settingEvidence (json: settlement, population, datasetVersion, configVersion), [by_institution]
- `programs`: institutionId, campusId, name, degree, durationYears, taxonomyCode, officialUrl, status, version. [by_campus, by_taxonomy]
- `intakes`, `admissionRounds`: programId, term, year, roundName, bindingStatus (binding|non_binding|unknown), routeId.
- `applicationRoutes`: type (common_app|coalition|ucas|direct|foundation_pathway|other), name, url.
- `sources`: url, domain, retrievedAt, fetchMethod, status, contentHash, apifyRunId, textRef (storage), verification (enum).
- `evidence`: sourceId, excerpt, location, extractionRunId.
- `extractionRuns`: sourceId, model, schemaVersion, outputRef, validatorResult (json), createdAt.
- `requirements`: programId, type, text, threshold, scale, qualificationScope, evidenceId, verification, version, supersedes.
- `gradeRules`: institutionId, programId?, qualification, intakeYear, method (direct|equivalency|no_conversion_published), threshold, scale, evidenceId, version, supersedes.
- `assessments`: userId, programId, ruleId?, outcome (enum), inputsSnapshot, computedAt, ruleVersion. [by_user_program]
- `costItems`: programId, kind (tuition|fee|living|housing), amount, currency, period, applicantCategory, inclusions, exclusions, evidenceId, academicYear.
- `fxRates`: base, quote, rate, rateDate, source.
- `milestones`: programId, intakeId, roundId, category, officialName, dateStart, dateEnd, dateType (enum), publishedTimezone, cutoffTime?, originalWording, applicability, mandatoryState, evidenceId, verification, version, supersedes.
- `studentApplications`: userId, programId, intakeId, roundId, status, createdAt. [by_user]
- `tasks`: userId, applicationId, milestoneId?, title, owner (student|school|recommender|counselor|university|authority), dueType (official|recommended|student|none), dueAt, status (enum), dependencies (id[]), source (user|agent_proposal|rule), assumptions (string[]), proposalState (proposed|accepted|rejected).
- `changeEvents`: entityType, entityId, field, oldValue, newValue, reason, sourceId, verifiedAt, affectedUsers (count only).
- `counselors`: userId, active, rotationOrder, jiraAccountId.
- `rotation`: singleton row (key "counselors") with lastOrder, the rotationOrder of the last counselor assigned.
- `counselingRequests`: userId, status (requested|pending|assigned|closed), contextSnapshot, stage, createdAt.
- `assignments`: requestId, studentId, counselorId, assignedAt, method ("round_robin"), active.
- `conversations`, `messages`: conversationId, senderType (student|counselor|system), body, programRef?, fileRefs (id[]), state (pending|sent|failed), createdAt.
- `files`: ownerId, name (sanitized display), ext, storageId, derivativeStorageId?, mime, size, state (validating|ready|rejected), rejectReason?, scanState ("not_scanned"), previewState (ok|converting|unavailable|none), createdAt.
- `fileShares`: fileId, counselorId, sharedAt, revokedAt.
- `agentJobs`: type, userId?, payload, status, attempts, maxAttempts, idempotencyKey, leaseUntil?, workerId?, lastError, result. `agentRuns`: jobId, attempt, steps (json[]), startedAt, endedAt, outcome.
- `integrationEvents`: eventId, type, status (sent|acked|failed), attempts, payloadHash.
- `usage`: userId, day, aiCalls, aiTokens.
- `deletionRequests`: userId, requestedAt, executedAt.
- `metricsEvents`: name, userId?, value, meta, at.

## 3. Candidate-record schema (output of the rule-based extractor; Bitdeer and Claude dropped on 2026-10-24)

All properties declared, `additionalProperties:false`, nullable values carry `nullReason`. One combined schema per page chunk:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["records"],
  "properties": {
    "records": {
      "type": "array",
      "items": {
        "anyOf": [
          {"type":"object","additionalProperties":false,
           "required":["kind","institution","campus","programName","degree","durationYears","subjectArea","evidence","nullReason"],
           "properties":{"kind":{"const":"program"},"institution":{"type":"string"},"campus":{"type":["string","null"]},
             "programName":{"type":"string"},"degree":{"type":"string"},"durationYears":{"type":["number","null"]},
             "subjectArea":{"type":["string","null"]},"evidence":{"type":"string"},"nullReason":{"type":["string","null"]}}},
          {"type":"object","additionalProperties":false,
           "required":["kind","itemType","amount","currency","period","applicantCategory","academicYear","inclusions","exclusions","evidence","nullReason"],
           "properties":{"kind":{"const":"cost"},"itemType":{"enum":["tuition","mandatory_fee","living_estimate","housing_estimate"]},
             "amount":{"type":["number","null"]},"currency":{"type":["string","null"]},"period":{"enum":["annual","term","total","unknown"]},
             "applicantCategory":{"type":"string"},"academicYear":{"type":["string","null"]},
             "inclusions":{"type":["string","null"]},"exclusions":{"type":["string","null"]},
             "evidence":{"type":"string"},"nullReason":{"type":["string","null"]}}},
          {"type":"object","additionalProperties":false,
           "required":["kind","reqType","description","threshold","scale","qualificationScope","evidence","nullReason"],
           "properties":{"kind":{"const":"requirement"},"reqType":{"enum":["academic","subject","language","test","document"]},
             "description":{"type":"string"},"threshold":{"type":["string","null"]},"scale":{"type":["string","null"]},
             "qualificationScope":{"type":["string","null"]},"evidence":{"type":"string"},"nullReason":{"type":["string","null"]}}},
          {"type":"object","additionalProperties":false,
           "required":["kind","qualification","intakeYear","method","threshold","scale","evidence","nullReason"],
           "properties":{"kind":{"const":"grade_policy"},"qualification":{"type":"string"},"intakeYear":{"type":["string","null"]},
             "method":{"enum":["direct","equivalency","no_conversion_published"]},"threshold":{"type":["string","null"]},
             "scale":{"type":["string","null"]},"evidence":{"type":"string"},"nullReason":{"type":["string","null"]}}},
          {"type":"object","additionalProperties":false,
           "required":["kind","category","officialName","dateText","dateStart","dateEnd","timezone","cutoffTime","round","applicantCategory","mandatoryState","evidence","nullReason"],
           "properties":{"kind":{"const":"milestone"},"category":{"type":"string"},"officialName":{"type":"string"},
             "dateText":{"type":"string"},"dateStart":{"type":["string","null"]},"dateEnd":{"type":["string","null"]},
             "timezone":{"type":["string","null"]},"cutoffTime":{"type":["string","null"]},"round":{"type":["string","null"]},
             "applicantCategory":{"type":"string"},"mandatoryState":{"enum":["mandatory","optional","conditional","unknown"]},
             "evidence":{"type":"string"},"nullReason":{"type":["string","null"]}}}
        ]
      }
    }
  }
}
```

The extractor copies `evidence` verbatim from the stored page text and returns null with a reason when no rule matches. The rule version is stored with every run. Page text is data only.

## 4. Factory worker tools

| Tool | Input | Output | Limits |
| --- | --- | --- | --- |
| `fetchOfficialPage` | `{url}` | `{status, text (≤ 60k chars), retrievedAt}` | Domain in allowlist; 10 calls per job; 20 s timeout; no redirects off-allowlist |
| `readProgramRecords` | `{applicationId}` | program, requirements, milestones, gradeRules, with IDs | Read-only |
| `proposeChecklist` | `{applicationId, items[{title, owner, dueType, dueAt?, sourceId, assumptions[]}]}` | proposal IDs | Writes proposals only; each item must cite a source |
| `proposeResearchNote` | `{applicationId, question, finding, sourceIds[], resolved:false}` | note ID | `resolved` is always false |

Built-in shell and edit tools are disabled. Job timeout 5 minutes. Output is posted with `appendStep` so the UI streams it.

## 5. Forge events and Jira template

Convex → Forge web trigger:

```json
{
  "eventId": "uuid",
  "type": "counselor_assigned | deadline_changed | needs_confirmation | document_at_risk",
  "occurredAt": "ISO-8601",
  "studentRef": "opaque id (not a name)",
  "applicationRef": "opaque id or null",
  "counselorJiraAccountId": "string",
  "urgency": "low | normal | high | urgent",
  "summary": "short text without personal data",
  "appLink": "https://.../cases/<id>",
  "source": {"url": "string|null", "retrievedAt": "ISO|null"},
  "change": {"field": "string|null", "old": "string|null", "new": "string|null"}
}
```

Headers: `X-Langkah-Timestamp` and `X-Langkah-Signature` = HMAC-SHA256 of timestamp + body with the shared secret; Forge rejects stale (more than 5 minutes) or bad signatures, and ignores a repeated `eventId`.

Jira: project "Langkah Counseling" (key LANG), issue type Task. One issue per student application, identified by entity property `langkah.externalId`.

- Summary: `[<urgency>] <type label> — case <studentRef>`.
- Description: reason, source link, change (old → new), app link. No names, no documents, no grades.
- Priority: urgent or overdue → Highest; due within 7 days → High; within 21 days → Medium; else Low. Counselor assigned by `counselorJiraAccountId`.
- Labels: event type, `automated`.
- Audit: a comment on every create or update: "Automated by Langkah — reason, source URL, time, event ID."
- Scheduled trigger (hourly): posts a digest comment on a "Daily summary" issue per counselor and re-polls Convex for undelivered events.

## 6. Config values (DEFAULT)

`config/ranking.json`:

```json
{"keys":["major","academic","budget","climate"],
 "outcomes":{"major":["direct","related","other","unknown"],
  "academic":["meets","needs_confirmation","subject_gap","below"],
  "budget":["within","within_incomplete","unknown","slightly_over","over"],
  "climate":["match","partial","unknown","mismatch"]},
 "slightlyOverPct":15,"tieBreak":["lowest_known_annual_cost","name"]}
```

`config/taxonomy.json` (majors in scope; others are `other`):

```json
{"cs":{"label":"Computer Science","related":["software_eng","data_science","info_systems","math_stats"]},
 "econ":{"label":"Economics","related":["finance","business","math_stats"]},
 "software_eng":{"related":["cs"]},"data_science":{"related":["cs","math_stats"]},
 "info_systems":{"related":["cs","business"]},"finance":{"related":["econ","business"]},
 "business":{"related":["econ","finance","info_systems"]},"math_stats":{"related":["cs","econ","data_science"]}}
```

Classification of a program into the taxonomy is proposed by the extraction model and checked against this table; unmapped programs are `other` or `unknown`.

`config/climate.json` (evaluated in this order on campus climate normals):

```json
{"rules":[
  {"class":"warm","when":"annualMeanC >= 15"},
  {"class":"cold","when":"annualMeanC < 8 or coldestMonthMeanC < -6"},
  {"class":"mild","when":"coldestMonthMeanC >= 2"},
  {"class":"cool","when":"otherwise"}],
 "order":["warm","mild","cool","cold"],
 "fit":{"match":"same class","partial":"adjacent class","mismatch":"two or more apart","noPreference":"counts as match"}}
```

`config/setting.json`: as in spec section 5.2.

`config/limits.json`:

```json
{"upload":{"maxBytes":10485760,"maxFiles":50,"maxTotalBytes":104857600,
  "allowed":["pdf","doc","docx","jpg","jpeg","png","heic","heif"]},
 "ai":{"callsPerStudentPerDay":60,"tokensPerStudentPerDay":200000},
 "ingestion":{"maxPagesPerRun":150,"maxDepth":2,"batchInstitutions":3},
 "agent":{"jobTimeoutSec":300,"fetchPerJob":10},
 "retention":{"years":10}}
```

`config/domains.json` (suffix match; subdomains allowed):

US: `psu.edu`, `msu.edu`, `wisc.edu`, `illinois.edu`, `northeastern.edu`, `dartmouth.edu`, `commonapp.org`, `studyinthestates.dhs.gov`, `travel.state.gov`.
GB: `exeter.ac.uk`, `sheffield.ac.uk`, `lancaster.ac.uk`, `manchester.ac.uk`, `bath.ac.uk`, `lboro.ac.uk`, `ucas.com`, `gov.uk`.
Note: Bright Data may block government domains by default (see BD-7). Government domains are only fetched for immigration and application-route milestones.

## 7. Rules

### 7.1 Comparable annual cost

1. Choose items for the program, intake year and international applicant category. Reject domestic rates.
2. `annual = tuitionAnnual + mandatoryFeesAnnual + livingAnnual`. Term amounts are scaled only by a stated number of terms per year; a total amount is divided by `durationYears` from the source.
3. Convert each item to the student's budget currency with the latest stored rate; keep the original amounts. If no rate exists, the cost is shown in original currency and budget band is `unknown`.
4. If the student's budget is `tuition_only`, compare tuition plus mandatory fees only; if `all_in`, compare the full sum.
5. Budget band: `within` if every component is known and annual ≤ budget; `within_incomplete` if some component is missing but the known sum ≤ budget; `slightly_over` if the known sum is above the budget by up to `slightlyOverPct`; `over` if above by more (a known lower bound above budget is `over` even if incomplete); `unknown` if tuition is unknown or conversion is unavailable.
6. Budget gap = known sum − budget when calculable, shown with the completeness label.

### 7.2 Planning assumptions for timelines (DEFAULT, labeled "planning assumption", editable by the student)

- English test booking lead time 42 days; results wait 14 days unless the source states otherwise; retake buffer 28 days; official score delivery 14 days; safety buffer 7 days.
- School document request lead time 30 days; translation or certification 21 days.
- Recommendation request lead time 45 days.

These shift only recommended targets. Official dates are never moved.

### 7.3 Dependency templates (examples, applied only where the program's sources make the step applicable)

- `english_test_chain`: book → test → results → (retake window) → official score delivery → receipt cutoff.
- `school_docs_chain`: request → school processing → (translation/certification) → submission → receipt.
- `recommendation_chain`: request → preparation → recommender deadline.
- `offer_to_arrival_chain`: offer → acceptance/deposit → institution immigration document → visa steps (if applicable) → arrival window.

### 7.4 Deadline risk

For each task: `needed = sum of remaining chain lead times + safety buffer`; `available = official deadline − today`.
- `on_track`: available ≥ needed × 1.25. `tight`: needed ≤ available < needed × 1.25. `at_risk`: available < needed. `closed`: official deadline passed (offer verified alternative rounds or intakes). `unknown`: no verified deadline.
- Date-only deadlines are treated as end of the published date in the published timezone only for risk arithmetic and are never displayed as a time.

### 7.5 Metrics (real demo runs only)

- `time_to_shortlist` = time from profile completion to first saved program (seconds).
- `verified_fact_share` = displayed facts with `verification = verified` and a source ÷ all displayed facts on the match and program pages.
- `counselor_items_automated` = Jira items created or updated by the Forge app ÷ all items for those cases.
- `needs_confirmation_cases` = assessments with outcome `needs_confirmation`.
No figures are reported unless they come from recorded events.

## 8. Decisions made by the architect in this document

Jira project and priority mapping, climate classes, taxonomy relations, planning-assumption values, risk thresholds, AI caps, ingestion limits, domain list, and the extraction schema shape. All are changeable in config, and none is presented as an official or sourced fact.
