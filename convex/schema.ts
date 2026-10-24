// Langkah data model (spec section 7, docs/engineering-detail.md section 2).
// Access rules live in convex/lib/access.ts; every public function goes through them.
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const role = v.union(v.literal("student"), v.literal("counselor"));
export const country = v.union(v.literal("US"), v.literal("GB"));
export const settingClass = v.union(v.literal("city"), v.literal("countryside"), v.literal("unclassified"));
export const verification = v.union(
  v.literal("verified"), v.literal("unverified"), v.literal("stale"),
  v.literal("conflicting"), v.literal("unavailable"), v.literal("unknown"),
);
export const dateType = v.union(
  v.literal("verified_hard_deadline"), v.literal("official_opening"), v.literal("official_expected_window"),
  v.literal("processing_estimate"), v.literal("recommended_target"), v.literal("student_entered"), v.literal("unpublished"),
);
export const taskStatus = v.union(
  v.literal("not_started"), v.literal("in_progress"), v.literal("waiting_on_someone"), v.literal("submitted"),
  v.literal("confirmed_complete"), v.literal("overdue"), v.literal("not_applicable"),
);
export const academicOutcome = v.union(
  v.literal("meets_published_minimum"), v.literal("below_published_minimum"),
  v.literal("needs_confirmation"), v.literal("subject_gap"),
);
export const jobStatus = v.union(
  v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed"), v.literal("cancelled"),
);
export const climatePref = v.union(
  v.literal("warm"), v.literal("mild"), v.literal("cool"), v.literal("cold"), v.literal("no_preference"), v.literal("unknown"),
);
export const fileState = v.union(v.literal("validating"), v.literal("ready"), v.literal("rejected"));

export default defineSchema({
  ...authTables,

  // Convex Auth's users table plus our role. Sign-up always sets "student" (convex/auth.ts);
  // "counselor" is granted only by internal admin functions.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(role),
    locale: v.optional(v.union(v.literal("id"), v.literal("en"))),
    demo: v.optional(v.boolean()),
  }).index("email", ["email"]),

  // ---- Student ----
  studentProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    budgetAmount: v.optional(v.number()),
    budgetCurrency: v.optional(v.string()),
    budgetPeriod: v.optional(v.union(v.literal("annual"), v.literal("total"))),
    budgetScope: v.optional(v.union(v.literal("tuition_only"), v.literal("all_in"))),
    countries: v.array(country),
    settings: v.array(v.union(v.literal("city"), v.literal("countryside"))),
    majors: v.array(v.string()),
    // Whether related fields (config/taxonomy.json) are acceptable alternatives.
    relatedOk: v.optional(v.boolean()),
    climate: v.optional(climatePref),
    intakeTerm: v.optional(v.union(v.literal("fall"), v.literal("spring"), v.literal("unknown"))),
    intakeYear: v.optional(v.number()),
    intakeCompletedAt: v.optional(v.number()),
    version: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  profileHistory: defineTable({
    userId: v.id("users"),
    version: v.number(),
    snapshot: v.any(),
    changedBy: v.union(v.literal("student"), v.literal("system")),
    at: v.number(),
  }).index("by_user", ["userId"]),
  // Append-only: originals are never overwritten (scenario 19).
  qualificationRecords: defineTable({
    userId: v.id("users"),
    qualificationType: v.optional(v.string()), // SMA, SMK, MA, IB, Cambridge, other
    curriculum: v.string(),
    school: v.optional(v.string()),
    gradeLevel: v.optional(v.number()), // current class: 10, 11 or 12
    year: v.optional(v.number()), // expected graduation year
    scaleMin: v.number(),
    scaleMax: v.number(),
    reportedOverall: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  subjectGrades: defineTable({
    qualificationId: v.id("qualificationRecords"),
    subject: v.string(),
    grade: v.number(),
    scale: v.optional(v.string()),
  }).index("by_qualification", ["qualificationId"]),
  languageEvidence: defineTable({
    userId: v.id("users"),
    test: v.string(),
    score: v.optional(v.number()),
    components: v.optional(v.any()),
    takenOn: v.optional(v.string()),
    status: v.union(v.literal("taken"), v.literal("not_taken"), v.literal("unknown")),
    validUntil: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // ---- Catalog (written only by ingestion) ----
  institutions: defineTable({
    slug: v.optional(v.string()),
    name: v.string(),
    country,
    domains: v.array(v.string()),
    coverageStatus: v.string(),
  }).index("by_country", ["country"]).index("by_slug", ["slug"]),
  campuses: defineTable({
    institutionId: v.id("institutions"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    settingClass,
    settingEvidence: v.optional(v.any()),
  }).index("by_institution", ["institutionId"]),
  programs: defineTable({
    institutionId: v.id("institutions"),
    campusId: v.optional(v.id("campuses")),
    name: v.string(),
    degree: v.string(),
    durationYears: v.optional(v.number()),
    taxonomyCode: v.optional(v.string()),
    officialUrl: v.optional(v.string()),
    joint: v.optional(v.boolean()),
    entryYear: v.optional(v.number()),
    sourceId: v.optional(v.id("sources")),
    evidenceId: v.optional(v.id("evidence")),
    status: verification,
    version: v.number(),
  }).index("by_institution", ["institutionId"]).index("by_url", ["officialUrl"]).index("by_campus", ["campusId"]).index("by_taxonomy", ["taxonomyCode"]),
  applicationRoutes: defineTable({
    type: v.union(
      v.literal("common_app"), v.literal("coalition"), v.literal("ucas"),
      v.literal("direct"), v.literal("foundation_pathway"), v.literal("other"),
    ),
    name: v.string(),
    url: v.optional(v.string()),
  }),
  intakes: defineTable({
    programId: v.id("programs"),
    term: v.string(),
    year: v.number(),
  }).index("by_program", ["programId"]),
  admissionRounds: defineTable({
    programId: v.id("programs"),
    intakeId: v.id("intakes"),
    roundName: v.string(),
    bindingStatus: v.union(v.literal("binding"), v.literal("non_binding"), v.literal("unknown")),
    routeId: v.optional(v.id("applicationRoutes")),
  }).index("by_intake", ["intakeId"]),
  coverage: defineTable({
    institutionId: v.id("institutions"),
    major: v.string(),
    status: v.string(),
    note: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_institution", ["institutionId"]),

  // ---- Evidence ----
  // One row per Apify run started by Convex (AP-5). Webhook and polling both end in `collect`,
  // which claims the run with a lease so a duplicate notification cannot store anything twice.
  ingestionRuns: defineTable({
    apifyRunId: v.string(),
    datasetId: v.optional(v.string()),
    label: v.optional(v.string()),
    status: v.union(v.literal("running"), v.literal("collecting"), v.literal("stored"), v.literal("failed")),
    apifyStatus: v.optional(v.string()),
    startUrls: v.array(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    collectingSince: v.optional(v.number()),
    notifiedBy: v.optional(v.union(v.literal("webhook"), v.literal("poll"))),
    webhookCount: v.number(),
    counts: v.optional(v.object({ new: v.number(), changed: v.number(), unchanged: v.number(), failed: v.number() })),
    error: v.optional(v.string()),
  }).index("by_apify_run", ["apifyRunId"]),

  sources: defineTable({
    url: v.string(),
    finalUrl: v.optional(v.string()),
    domain: v.string(),
    title: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    error: v.optional(v.string()),
    depth: v.optional(v.number()),
    previousId: v.optional(v.id("sources")), // set when the content changed since the last retrieval
    retrievedAt: v.number(),
    fetchMethod: v.union(v.literal("plain"), v.literal("web_unlocker"), v.literal("failed")),
    status: v.union(
      v.literal("ok"), v.literal("blocked"), v.literal("empty"), v.literal("timeout"),
      v.literal("changed"), v.literal("rejected_by_policy"),
    ),
    contentHash: v.optional(v.string()),
    apifyRunId: v.optional(v.string()),
    textRef: v.optional(v.id("_storage")),
    verification,
  }).index("by_url", ["url", "retrievedAt"]).index("by_run", ["apifyRunId"]),
  extractionRuns: defineTable({
    sourceId: v.id("sources"),
    model: v.string(),
    schemaVersion: v.string(),
    outputRef: v.optional(v.id("_storage")),
    validatorResult: v.any(),
    createdAt: v.number(),
  }).index("by_source", ["sourceId"]),
  // Facts found on a page by the rule-based extractor, before they are matched to programs.
  // "ready" = nothing had to be guessed; "needs_confirmation" lists why; "rejected" failed validation.
  candidates: defineTable({
    sourceId: v.id("sources"),
    extractionRunId: v.id("extractionRuns"),
    domain: v.string(),
    kind: v.union(v.literal("cost"), v.literal("language"), v.literal("grade_policy"), v.literal("milestone")),
    status: v.union(v.literal("ready"), v.literal("needs_confirmation"), v.literal("rejected")),
    reasons: v.array(v.string()),
    fields: v.any(),
    evidence: v.string(),
    line: v.number(),
    ruleVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_source", ["sourceId"])
    .index("by_domain_kind", ["domain", "kind", "status"]),

  evidence: defineTable({
    sourceId: v.id("sources"),
    excerpt: v.string(),
    location: v.optional(v.string()),
    extractionRunId: v.optional(v.id("extractionRuns")),
  }).index("by_source", ["sourceId"]),

  // ---- Rules and results ----
  // Published facts. scope "institution" applies to every program of the institution unless a
  // program-scoped fact of the same kind exists. Each is backed by one ready candidate.
  requirements: defineTable({
    institutionId: v.optional(v.id("institutions")),
    programId: v.optional(v.id("programs")),
    candidateId: v.optional(v.id("candidates")),
    scope: v.optional(v.union(v.literal("institution"), v.literal("program"))),
    type: v.union(v.literal("academic"), v.literal("subject"), v.literal("language"), v.literal("test"), v.literal("document")),
    text: v.string(),
    threshold: v.optional(v.string()),
    scale: v.optional(v.string()),
    qualificationScope: v.optional(v.string()),
    evidenceId: v.optional(v.id("evidence")),
    verification,
    version: v.number(),
    supersedes: v.optional(v.id("requirements")),
  }).index("by_program", ["programId"]).index("by_institution", ["institutionId"]).index("by_candidate", ["candidateId"]),
  gradeRules: defineTable({
    institutionId: v.id("institutions"),
    programId: v.optional(v.id("programs")),
    qualification: v.string(),
    intakeYear: v.optional(v.number()),
    method: v.union(v.literal("direct"), v.literal("equivalency"), v.literal("no_conversion_published")),
    threshold: v.optional(v.string()),
    scale: v.optional(v.string()),
    evidenceId: v.optional(v.id("evidence")),
    version: v.number(),
    supersedes: v.optional(v.id("gradeRules")),
  }).index("by_institution", ["institutionId"]),
  assessments: defineTable({
    userId: v.id("users"),
    programId: v.id("programs"),
    ruleId: v.optional(v.id("gradeRules")),
    outcome: academicOutcome,
    inputsSnapshot: v.any(),
    computedAt: v.number(),
    ruleVersion: v.string(),
  }).index("by_user_program", ["userId", "programId"]),
  costItems: defineTable({
    institutionId: v.optional(v.id("institutions")),
    programId: v.optional(v.id("programs")),
    candidateId: v.optional(v.id("candidates")),
    scope: v.optional(v.union(v.literal("institution"), v.literal("program"))),
    kind: v.union(v.literal("tuition"), v.literal("fee"), v.literal("living"), v.literal("housing")),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    period: v.union(v.literal("annual"), v.literal("term"), v.literal("total"), v.literal("unknown")),
    applicantCategory: v.string(),
    inclusions: v.optional(v.string()),
    exclusions: v.optional(v.string()),
    evidenceId: v.optional(v.id("evidence")),
    academicYear: v.optional(v.string()),
  }).index("by_program", ["programId"]).index("by_institution", ["institutionId"]).index("by_candidate", ["candidateId"]),
  fxRates: defineTable({
    base: v.string(),
    quote: v.string(),
    rate: v.number(),
    rateDate: v.string(),
    source: v.string(),
  }).index("by_pair", ["base", "quote"]),

  // ---- Timelines ----
  milestones: defineTable({
    institutionId: v.optional(v.id("institutions")),
    programId: v.optional(v.id("programs")),
    candidateId: v.optional(v.id("candidates")),
    scope: v.optional(v.union(v.literal("institution"), v.literal("program"))),
    scholarship: v.optional(v.boolean()),
    intakeId: v.optional(v.id("intakes")),
    roundId: v.optional(v.id("admissionRounds")),
    category: v.string(),
    officialName: v.string(),
    dateStart: v.optional(v.string()),
    dateEnd: v.optional(v.string()),
    dateType,
    publishedTimezone: v.optional(v.string()),
    cutoffTime: v.optional(v.string()),
    originalWording: v.optional(v.string()),
    applicability: v.optional(v.string()),
    mandatoryState: v.union(v.literal("mandatory"), v.literal("optional"), v.literal("conditional"), v.literal("unknown")),
    evidenceId: v.optional(v.id("evidence")),
    verification,
    version: v.number(),
    supersedes: v.optional(v.id("milestones")),
  }).index("by_program", ["programId"]).index("by_institution", ["institutionId"]).index("by_candidate", ["candidateId"]),
  studentApplications: defineTable({
    userId: v.id("users"),
    programId: v.id("programs"),
    intakeId: v.optional(v.id("intakes")),
    roundId: v.optional(v.id("admissionRounds")),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_program", ["userId", "programId"]),
  tasks: defineTable({
    userId: v.id("users"),
    applicationId: v.id("studentApplications"),
    milestoneId: v.optional(v.id("milestones")),
    planKey: v.optional(v.string()), // rule step that created it, e.g. "english_book"
    params: v.optional(v.any()), // values for the localized title (test name, institution, …)
    title: v.string(),
    owner: v.union(
      v.literal("student"), v.literal("school"), v.literal("recommender"),
      v.literal("counselor"), v.literal("university"), v.literal("authority"),
    ),
    dueType: v.union(v.literal("official"), v.literal("recommended"), v.literal("student"), v.literal("none")),
    dueAt: v.optional(v.string()),
    studentDate: v.optional(v.string()),
    status: taskStatus,
    dependencies: v.array(v.id("tasks")),
    source: v.union(v.literal("user"), v.literal("agent_proposal"), v.literal("rule")),
    sourceId: v.optional(v.id("sources")),
    assumptions: v.array(v.string()),
    proposalState: v.union(v.literal("proposed"), v.literal("accepted"), v.literal("rejected")),
  }).index("by_user", ["userId"]).index("by_application", ["applicationId"]),
  changeEvents: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    field: v.string(),
    oldValue: v.any(),
    newValue: v.any(),
    reason: v.string(),
    sourceId: v.optional(v.id("sources")),
    verifiedAt: v.number(),
    affectedUsers: v.number(),
    test: v.optional(v.boolean()),
  }),

  // ---- Counseling ----
  counselors: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    active: v.boolean(),
    rotationOrder: v.number(),
    jiraAccountId: v.optional(v.string()),
  }).index("by_user", ["userId"]).index("by_rotation", ["rotationOrder"]),
  // Singleton row; read and advanced in the same mutation as the assignment (CV-5).
  rotation: defineTable({ key: v.literal("counselors"), lastOrder: v.union(v.number(), v.null()) }).index("by_key", ["key"]),
  counselingRequests: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("requested"), v.literal("pending"), v.literal("assigned"), v.literal("closed")),
    stage: v.string(),
    contextSnapshot: v.any(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_status", ["status"]),
  assignments: defineTable({
    requestId: v.id("counselingRequests"),
    studentId: v.id("users"),
    counselorId: v.id("counselors"),
    assignedAt: v.number(),
    method: v.literal("round_robin"),
    active: v.boolean(),
  })
    .index("by_student", ["studentId", "active"])
    .index("by_counselor", ["counselorId", "active"])
    .index("by_request", ["requestId"]),
  conversations: defineTable({
    studentId: v.id("users"),
    counselorId: v.id("counselors"),
    createdAt: v.number(),
  }).index("by_student", ["studentId"]).index("by_counselor", ["counselorId"]),
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderType: v.union(v.literal("student"), v.literal("counselor"), v.literal("system")),
    senderId: v.optional(v.id("users")),
    body: v.string(),
    programRef: v.optional(v.id("programs")),
    fileRefs: v.array(v.id("files")),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // ---- Files (private; downloads only through the authenticated HTTP action) ----
  files: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    ext: v.string(),
    storageId: v.id("_storage"),
    derivativeStorageId: v.optional(v.id("_storage")),
    mime: v.string(),
    size: v.number(),
    state: fileState,
    rejectReason: v.optional(v.string()),
    scanState: v.literal("not_scanned"),
    previewState: v.union(v.literal("ok"), v.literal("converting"), v.literal("unavailable"), v.literal("none")),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]).index("by_storage", ["storageId"]),
  fileShares: defineTable({
    fileId: v.id("files"),
    counselorId: v.id("counselors"),
    sharedAt: v.number(),
    revokedAt: v.optional(v.number()),
  }).index("by_file", ["fileId"]).index("by_counselor", ["counselorId"]),

  // ---- Agents and jobs (CV-4) ----
  agentJobs: defineTable({
    type: v.string(),
    userId: v.optional(v.id("users")),
    payload: v.any(),
    status: jobStatus,
    attempts: v.number(),
    maxAttempts: v.number(),
    idempotencyKey: v.string(),
    leaseUntil: v.optional(v.number()),
    workerId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    result: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_status", ["status", "createdAt"])
    .index("by_user", ["userId"]),
  agentRuns: defineTable({
    jobId: v.id("agentJobs"),
    attempt: v.number(),
    steps: v.array(v.any()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    outcome: v.optional(v.string()),
  }).index("by_job", ["jobId"]),
  actionHistory: defineTable({
    actor: v.string(),
    action: v.string(),
    userId: v.optional(v.id("users")),
    target: v.optional(v.string()),
    detail: v.optional(v.any()),
    at: v.number(),
  }).index("by_user", ["userId"]),
  integrationEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
    status: v.union(v.literal("sent"), v.literal("acked"), v.literal("failed")),
    attempts: v.number(),
    payloadHash: v.string(),
  }).index("by_event", ["eventId"]),

  // ---- Ops ----
  usage: defineTable({
    userId: v.id("users"),
    day: v.string(),
    aiCalls: v.number(),
    aiTokens: v.number(),
  }).index("by_user_day", ["userId", "day"]),
  deletionRequests: defineTable({
    userId: v.id("users"),
    requestedAt: v.number(),
    executedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
  metricsEvents: defineTable({
    name: v.string(),
    userId: v.optional(v.id("users")),
    value: v.optional(v.number()),
    meta: v.optional(v.any()),
    at: v.number(),
  }).index("by_name", ["name"]),
  demoResetLog: defineTable({ at: v.number(), detail: v.any() }),
});
