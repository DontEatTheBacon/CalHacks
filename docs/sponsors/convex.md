# Convex in Langkah

Status: WP1 built and tested on 2026-10-24. This page is the CV-8 record of the schema and access rules; it must match the code in `convex/`.

## What Convex does here

All application state lives in Convex (CV-1). The web app reads through reactive queries (`useQuery`), so a counselor's reply or a file's validation result appears without reload.

| Area | Where | Notes |
| --- | --- | --- |
| Schema | `convex/schema.ts` | Every table in `docs/engineering-detail.md` section 2, plus Convex Auth tables |
| Authentication | `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts` | Convex Auth, password sign-in (CV-2) |
| Access rules | `convex/lib/access.ts` | Every public function calls one of these first |
| Counseling | `convex/counseling.ts` | Round robin in one mutation (CV-5) |
| Messages | `convex/messages.ts` | Student and assigned counselor only |
| Files | `convex/files.ts`, `convex/lib/fileSignature.ts`, `/files/download` in `convex/http.ts` | Private storage, authenticated download (CV-3) |
| Job table | `convex/jobs.ts`, `convex/crons.ts` | Leases, retries, idempotency (CV-4); worker credential (CV-6) |
| Admin | `convex/admin.ts` | Internal only: grant counselor role, activate/deactivate |

## Access rules (spec 3.1)

- **Roles.** Sign-up always creates a `student` (set in the `afterUserCreatedOrUpdated` callback; the sign-up form cannot choose a role). `counselor` is granted only by `admin:makeCounselor`, an internal function run from the CLI.
- **Student data.** `requireStudentReader` allows the owner, or the counselor with an *active* assignment to that student. Other students and unassigned counselors are refused.
- **Messages.** Only the conversation's student, and its counselor while still assigned.
- **Files.** Owner always. A counselor only if the student explicitly shared that file, the share is not revoked, and the counselor is still assigned. Assignment alone shares nothing.
- **Download.** `GET /files/download?id=…` with `Authorization: Bearer <Convex Auth token>`. 401 without a token; 404 for both "missing" and "not yours" so IDs cannot be probed. Served with `Content-Disposition: attachment` (images inline), `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, a sandbox CSP, and CORS limited to `SITE_URL`. Storage URLs are never returned to any client.
- **Uploads.** Extension allowlist from `config/limits.json`; 10 MB, 50 files and 100 MB per student; content signature checked server-side after upload (PDF, PNG, JPEG, OLE `.doc`, ZIP `.docx` with no VBA part, HEIF brands); mismatches are rejected and the blob deleted. Names are sanitized; blobs are stored under Convex IDs. Every file is marked `not_scanned`.
- **Agent writes.** Worker functions in `convex/jobs.ts` require `WORKER_SECRET` (at least 32 characters) and only the current lease holder's writes count.

## Job table (CV-4)

Convex scheduled actions run at most once. `agentJobs` rows carry `status`, `attempts`, `maxAttempts`, `idempotencyKey`, `leaseUntil` (5 minutes, from `config/limits.json`), `workerId` and `lastError`. `requeueExpired` runs every minute: a job whose worker stopped responding goes back to `queued` until `maxAttempts`, then `failed` with the reason. A late write from the old worker is ignored, so results are not duplicated.

## Evidence

- `npm run test:convex`: 26 tests with `convex-test` (student A vs B, unassigned counselor, round robin 4 requests over 3 counselors, simultaneous requests, pending then assigned, messages, upload rejection, `.docm`, 10 MB, copied URL, share/unshare, deletion of blobs, job lease expiry and retry, stale worker).
- `node scripts/e2e-wp1.mjs`: 18 checks against a running deployment with real Convex Auth sign-up (client asking for `counselor` still gets `student`), real upload and download over HTTP, and CORS.
- Sabotage check: making `canReadFile` always true made 2 download tests fail, so the tests do detect broken access control.

## Not yet done

- Deletion requests and the 10-year retention job (CV-7).
- The Factory worker connecting with `WORKER_SECRET` from the MacBook (CV-6 live check).
- HEIC to JPEG preview conversion in the browser (HEIC files are stored and downloadable; preview marked unavailable).
