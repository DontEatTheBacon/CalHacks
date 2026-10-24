import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { country } from "./schema";
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
  climate: v.optional(v.string()),
  intakeTerm: v.optional(v.string()),
  intakeYear: v.optional(v.number()),
};

/** Writes keep the previous version in profileHistory. */
export const upsertMine = mutation({
  args: profileFields,
  handler: async (ctx, args) => {
    const user = await requireStudent(ctx);
    const now = Date.now();
    const existing = await ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (existing) {
      const { _id, _creationTime, ...previous } = existing;
      await ctx.db.insert("profileHistory", { userId: user._id, version: existing.version, snapshot: previous, changedBy: "student", at: now });
      await ctx.db.replace(existing._id, { ...args, userId: user._id, version: existing.version + 1, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("studentProfiles", { ...args, userId: user._id, version: 1, updatedAt: now });
  },
});

/** Original grade records are append-only (scenario 19): a correction is a new record. */
export const addQualification = mutation({
  args: {
    curriculum: v.string(),
    school: v.optional(v.string()),
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
    const id = await ctx.db.insert("qualificationRecords", { ...record, userId: user._id, createdAt: Date.now() });
    for (const s of subjects) await ctx.db.insert("subjectGrades", { qualificationId: id, subject: s.subject, grade: s.grade });
    return id;
  },
});
