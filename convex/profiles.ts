import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { climatePref, country } from "./schema";
import taxonomy from "../config/taxonomy.json" with { type: "json" };
import { requireStudent, requireStudentReader, requireUser } from "./lib/access";

/** The signed-in user's identity and role, for routing in the UI. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx).catch(() => null);
    if (!user) return null;
    return { id: user._id, email: user.email ?? null, name: user.name ?? null, role: user.role!, locale: user.locale ?? "id" };
  },
});

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    return ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
  },
});

/** Owner or assigned counselor only. */
export const getForStudent = query({
  args: { studentId: v.id("users") },
  handler: async (ctx, { studentId }) => {
    await requireStudentReader(ctx, studentId);
    const profile = await ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", studentId)).unique();
    const qualifications = await ctx.db.query("qualificationRecords").withIndex("by_user", (q) => q.eq("userId", studentId)).collect();
    return { profile, qualifications };
  },
});

const profileFields = {
  displayName: v.optional(v.string()),
  budgetAmount: v.optional(v.number()),
  budgetCurrency: v.optional(v.string()),
  budgetPeriod: v.optional(v.union(v.literal("annual"), v.literal("total"))),
  budgetScope: v.optional(v.union(v.literal("tuition_only"), v.literal("all_in"))),
  countries: v.array(country),
  settings: v.array(v.union(v.literal("city"), v.literal("countryside"))),
  majors: v.array(v.string()),
  relatedOk: v.optional(v.boolean()),
  climate: v.optional(climatePref),
  intakeTerm: v.optional(v.union(v.literal("fall"), v.literal("spring"), v.literal("unknown"))),
  intakeYear: v.optional(v.number()),
};

const CURRENCIES = ["IDR", "USD", "GBP"];

/** Rejects values the rest of the system cannot interpret. Missing values mean "unknown" (PROF-001). */
function checkProfile(p: { majors: string[]; budgetAmount?: number; budgetCurrency?: string; intakeYear?: number; displayName?: string }) {
  const known = Object.keys(taxonomy.fields);
  const bad = p.majors.filter((m) => !known.includes(m));
  if (bad.length) throw new Error(`Unknown major: ${bad.join(", ")}`);
  if (p.majors.length > 5) throw new Error("Choose at most 5 majors");
  if (p.budgetAmount !== undefined && !(p.budgetAmount > 0 && Number.isFinite(p.budgetAmount))) throw new Error("Budget must be a positive number");
  if (p.budgetAmount !== undefined && !p.budgetCurrency) throw new Error("Budget needs a currency");
  if (p.budgetCurrency !== undefined && !CURRENCIES.includes(p.budgetCurrency)) throw new Error("Currency must be IDR, USD or GBP");
  const year = new Date().getFullYear();
  if (p.intakeYear !== undefined && (p.intakeYear < year || p.intakeYear > year + 5)) throw new Error("Intake year is out of range");
  if (p.displayName !== undefined && p.displayName.length > 80) throw new Error("Name is too long");
}

/** Writes keep the previous version in profileHistory. */
export const upsertMine = mutation({
  args: profileFields,
  handler: async (ctx, args) => {
    const user = await requireStudent(ctx);
    checkProfile(args);
    const now = Date.now();
    const existing = await ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (existing) {
      const { _id, _creationTime, ...previous } = existing;
      await ctx.db.insert("profileHistory", { userId: user._id, version: existing.version, snapshot: previous, changedBy: "student", at: now });
      await ctx.db.replace(existing._id, {
        ...args, userId: user._id, version: existing.version + 1, updatedAt: now, intakeCompletedAt: existing.intakeCompletedAt,
      });
      return existing._id;
    }
    return ctx.db.insert("studentProfiles", { ...args, userId: user._id, version: 1, updatedAt: now });
  },
});

/** Original grade records are append-only (scenario 19): a correction is a new record. */
export const addQualification = mutation({
  args: {
    qualificationType: v.optional(v.string()),
    curriculum: v.string(),
    school: v.optional(v.string()),
    gradeLevel: v.optional(v.number()),
    year: v.optional(v.number()),
    scaleMin: v.number(),
    scaleMax: v.number(),
    reportedOverall: v.optional(v.number()),
    notes: v.optional(v.string()),
    subjects: v.array(v.object({ subject: v.string(), grade: v.number() })),
  },
  handler: async (ctx, { subjects, ...record }) => {
    const user = await requireStudent(ctx);
    if (record.scaleMax <= record.scaleMin) throw new Error("Scale maximum must be above minimum");
    const inScale = (g: number) => Number.isFinite(g) && g >= record.scaleMin && g <= record.scaleMax;
    if (record.reportedOverall !== undefined && !inScale(record.reportedOverall)) throw new Error("Overall result is outside the grading scale");
    for (const sg of subjects) {
      if (!sg.subject.trim()) throw new Error("Subject name is missing");
      if (!inScale(sg.grade)) throw new Error(`${sg.subject}: grade is outside the grading scale`);
    }
    if (subjects.length > 30) throw new Error("Too many subjects");
    if (record.gradeLevel !== undefined && ![10, 11, 12].includes(record.gradeLevel)) throw new Error("Class must be 10, 11 or 12");
    const id = await ctx.db.insert("qualificationRecords", { ...record, userId: user._id, createdAt: Date.now() });
    for (const sg of subjects) await ctx.db.insert("subjectGrades", { qualificationId: id, subject: sg.subject.trim(), grade: sg.grade });
    return id;
  },
});

const languageTest = v.object({
  test: v.union(v.literal("ielts_academic"), v.literal("toefl_ibt"), v.literal("duolingo"), v.literal("other")),
  status: v.union(v.literal("taken"), v.literal("not_taken"), v.literal("unknown")),
  score: v.optional(v.number()),
  takenOn: v.optional(v.string()),
});

const SCORE_MAX: Record<string, number> = { ielts_academic: 9, toefl_ibt: 120, duolingo: 160, other: 1000 };

/** Student-entered language evidence, one row per test; a later answer replaces the earlier one. */
export const setLanguage = mutation({
  args: { tests: v.array(languageTest) },
  handler: async (ctx, { tests }) => {
    const user = await requireStudent(ctx);
    const now = Date.now();
    for (const t of tests) {
      if (t.status === "taken" && t.score !== undefined && !(t.score >= 0 && t.score <= SCORE_MAX[t.test]!)) throw new Error(`${t.test}: score out of range`);
      if (t.takenOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(t.takenOn)) throw new Error("Test date must be YYYY-MM-DD");
    }
    const existing = await ctx.db.query("languageEvidence").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    for (const t of tests) {
      const row = { userId: user._id, test: t.test, status: t.status, updatedAt: now,
        ...(t.status === "taken" ? { score: t.score, takenOn: t.takenOn } : {}) };
      const prev = existing.find((e) => e.test === t.test);
      if (prev) await ctx.db.replace(prev._id, row);
      else await ctx.db.insert("languageEvidence", row);
    }
  },
});

/** Everything the intake form needs to resume where the student left off. */
export const intake = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    const profile = await ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    const qualification = (await ctx.db.query("qualificationRecords").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(1))[0] ?? null;
    const subjects = qualification
      ? await ctx.db.query("subjectGrades").withIndex("by_qualification", (q) => q.eq("qualificationId", qualification._id)).collect()
      : [];
    const language = await ctx.db.query("languageEvidence").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return {
      profile, qualification, subjects: subjects.map((sg) => ({ subject: sg.subject, grade: sg.grade })),
      language: language.map((l) => ({ test: l.test, status: l.status, score: l.score, takenOn: l.takenOn })),
      completed: !!profile?.intakeCompletedAt,
    };
  },
});

/** Finishing needs only preferences; grades and tests may stay unknown and be added later. */
export const completeIntake = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    const profile = await ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (!profile) throw new Error("Save your study preferences first");
    if (profile.countries.length === 0) throw new Error("Choose at least one country (US or UK)");
    if (!profile.intakeCompletedAt) await ctx.db.patch(profile._id, { intakeCompletedAt: Date.now() });
  },
});
