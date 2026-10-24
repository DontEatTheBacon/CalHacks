// Saved programs, personalized plans and tasks (spec 5.6, 5.7; screens 6 and 7).
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import planning from "../config/planning.json" with { type: "json" };
import { enqueue } from "./jobs";
import { requireStudent, requireStudentReader } from "./lib/access";
import { buildPlan } from "./lib/plan.ts";
import { deadlineRisk, ianaZone } from "./lib/rules/deadline.ts";
import { taskStatus } from "./schema";

const today = () => new Date().toISOString().slice(0, 10);

async function programFacts(ctx: QueryCtx, program: Doc<"programs">) {
  const wide = <R extends { scope?: "institution" | "program" }>(rows: R[]) => rows.filter((r) => r.scope === "institution");
  const msDocs = [
    ...(await ctx.db.query("milestones").withIndex("by_program", (q) => q.eq("programId", program._id)).collect()),
    ...wide(await ctx.db.query("milestones").withIndex("by_institution", (q) => q.eq("institutionId", program.institutionId)).collect()),
  ];
  const reqDocs = [
    ...(await ctx.db.query("requirements").withIndex("by_program", (q) => q.eq("programId", program._id)).collect()),
    ...wide(await ctx.db.query("requirements").withIndex("by_institution", (q) => q.eq("institutionId", program.institutionId)).collect()),
  ];
  const sourceOf = async (evidenceId: Id<"evidence"> | undefined) => (evidenceId ? (await ctx.db.get(evidenceId))?.sourceId ?? null : null);
  const milestones = await Promise.all(msDocs.map(async (m) => ({ doc: m, sourceId: await sourceOf(m.evidenceId) })));
  const requirements = await Promise.all(reqDocs.map(async (r) => ({ doc: r, sourceId: await sourceOf(r.evidenceId) })));
  return { milestones, requirements };
}

/** Save a program: creates the application, its rule-based plan, and a queued research job for the agent worker. */
export const save = mutation({
  args: { programId: v.id("programs") },
  handler: async (ctx, { programId }) => {
    const user = await requireStudent(ctx);
    const existing = await ctx.db.query("studentApplications").withIndex("by_user_program", (q) => q.eq("userId", user._id).eq("programId", programId)).first();
    if (existing) return existing._id;
    const program = await ctx.db.get(programId);
    if (!program) throw new Error("Program not found");
    const inst = (await ctx.db.get(program.institutionId))!;
    const facts = await programFacts(ctx, program);
    const language = (await ctx.db.query("languageEvidence").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      .map((l) => ({ test: l.test, status: l.status, score: l.score }));
    const plan = buildPlan({
      programName: program.name, institutionName: inst.name, applyVia: inst.country === "GB" ? "UCAS" : "university or shared portal",
      milestones: facts.milestones.map(({ doc, sourceId }) => ({ id: doc._id, dateStart: doc.dateStart ?? null, category: doc.category, scholarship: doc.scholarship ?? false, sourceId, timezone: doc.publishedTimezone ?? null })),
      requirements: facts.requirements.map(({ doc, sourceId }) => ({ type: doc.type, scale: doc.scale ?? null, threshold: doc.threshold ?? null, text: doc.text, sourceId })),
      language, today: today(),
    });
    const applicationId = await ctx.db.insert("studentApplications", { userId: user._id, programId, status: "planning", createdAt: Date.now() });
    const ids = new Map<string, Id<"tasks">>();
    for (const t of plan) {
      const id = await ctx.db.insert("tasks", {
        userId: user._id, applicationId, milestoneId: (t.milestoneId as Id<"milestones"> | null) ?? undefined, planKey: t.key, params: t.params, title: t.title, owner: t.owner,
        dueType: t.dueType, dueAt: t.dueAt ?? undefined, status: "not_started", dependencies: [], source: "rule",
        sourceId: (t.sourceId as Id<"sources"> | null) ?? undefined, assumptions: t.assumptions, proposalState: "accepted",
      });
      ids.set(t.key, id);
    }
    // English chain order: book → test → results → send.
    const chain = ["english_book", "english_test", "english_retake", "english_results", "english_send"].filter((k) => ids.has(k));
    for (let i = 1; i < chain.length; i++) await ctx.db.patch(ids.get(chain[i]!)!, { dependencies: [ids.get(chain[i - 1]!)!] });
    if (ids.has("submit") && ids.has("english_send")) await ctx.db.patch(ids.get("submit")!, { dependencies: [ids.get("english_send")!] });
    await enqueue(ctx, { type: "application_research", userId: user._id, idempotencyKey: `application:${applicationId}:research`, payload: { applicationId, programId } });
    await ctx.db.insert("actionHistory", { actor: "student", action: "program_saved", userId: user._id, target: programId, detail: { tasks: plan.length }, at: Date.now() });
    return applicationId;
  },
});

export const remove = mutation({
  args: { applicationId: v.id("studentApplications") },
  handler: async (ctx, { applicationId }) => {
    const user = await requireStudent(ctx);
    const app = await ctx.db.get(applicationId);
    if (!app || app.userId !== user._id) throw new Error("Not your application");
    for (const t of await ctx.db.query("tasks").withIndex("by_application", (q) => q.eq("applicationId", applicationId)).collect()) await ctx.db.delete(t._id);
    await ctx.db.delete(applicationId);
    await ctx.db.insert("actionHistory", { actor: "student", action: "program_removed", userId: user._id, target: app.programId, at: Date.now() });
  },
});

const LEAD: Record<string, number> = {
  english_book: planning.leadDays.englishTestBooking, english_results: planning.leadDays.englishResults, english_send: planning.leadDays.officialScoreDelivery,
};
const DONE = new Set(["submitted", "confirmed_complete", "not_applicable"]);

/** Display status: "overdue" is computed from official deadlines only, never from recommended targets. */
function displayStatus(t: Doc<"tasks">, now: string) {
  if (!DONE.has(t.status) && t.dueType === "official" && t.dueAt && t.dueAt < now) return "overdue";
  return t.status;
}

async function summarize(ctx: QueryCtx, app: Doc<"studentApplications">) {
  const program = await ctx.db.get(app.programId);
  const inst = program ? await ctx.db.get(program.institutionId) : null;
  const tasks = await ctx.db.query("tasks").withIndex("by_application", (q) => q.eq("applicationId", app._id)).collect();
  const submit = tasks.find((t) => t.dueType === "official" && t.dueAt);
  // Lead time still needed = lead days of the plan steps not yet done (engineering-detail 7.4).
  const remainingLead = tasks.filter((t) => !DONE.has(t.status)).reduce((n, t) => n + (LEAD[t.planKey ?? ""] ?? 0), 0);
  const milestone = submit?.milestoneId ? await ctx.db.get(submit.milestoneId) : null;
  const risk = submit?.status && DONE.has(submit.status) ? "on_track"
    : deadlineRisk(submit?.dueAt ? { date: submit.dueAt, timezone: ianaZone(milestone?.publishedTimezone) } : null, remainingLead, new Date());
  const now = today();
  return {
    id: app._id, status: app.status, createdAt: app.createdAt,
    program: program ? { id: program._id, name: program.name, degree: program.degree, officialUrl: program.officialUrl ?? null } : null,
    institution: inst ? { name: inst.name, country: inst.country } : null,
    deadline: submit?.dueAt ?? null, risk,
    tasks: tasks.map((t) => ({
      id: t._id, title: t.title, owner: t.owner, dueType: t.dueType, dueAt: t.dueAt ?? null, studentDate: t.studentDate ?? null,
      status: displayStatus(t, now), storedStatus: t.status, assumptions: t.assumptions, source: t.source, dependencies: t.dependencies, planKey: t.planKey ?? null, params: (t.params ?? null) as Record<string, string | number> | null,
    })).sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")),
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    const apps = await ctx.db.query("studentApplications").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const list = await Promise.all(apps.map((a) => summarize(ctx, a)));
    const nextActions = list.flatMap((a) => a.tasks.filter((t) => !DONE.has(t.storedStatus)).map((t) => ({ ...t, applicationId: a.id, program: a.program?.name ?? "", institution: a.institution?.name ?? "" })))
      .sort((a, b) => (a.studentDate ?? a.dueAt ?? "9999").localeCompare(b.studentDate ?? b.dueAt ?? "9999"));
    return { applications: list, nextActions, savedProgramIds: apps.map((a) => a.programId) };
  },
});

/** Owner or assigned counselor. */
export const get = query({
  args: { applicationId: v.id("studentApplications") },
  handler: async (ctx, { applicationId }) => {
    const app = await ctx.db.get(applicationId);
    if (!app) return null;
    await requireStudentReader(ctx, app.userId);
    const summary = await summarize(ctx, app);
    const program = await ctx.db.get(app.programId);
    const facts = program ? await programFacts(ctx, program) : { milestones: [], requirements: [] };
    const milestones = await Promise.all(facts.milestones.map(async ({ doc, sourceId }) => {
      const src = sourceId ? await ctx.db.get(sourceId) : null;
      return { id: doc._id, dateStart: doc.dateStart ?? null, category: doc.category, scholarship: doc.scholarship ?? false, cutoffTime: doc.cutoffTime ?? null, timezone: doc.publishedTimezone ?? null, wording: doc.originalWording ?? null, sourceUrl: src?.finalUrl ?? src?.url ?? null, retrievedAt: src?.retrievedAt ?? null };
    }));
    return { ...summary, milestones: milestones.sort((a, b) => (a.dateStart ?? "").localeCompare(b.dateStart ?? "")) };
  },
});

const ORDER = ["not_started", "in_progress", "waiting_on_someone", "submitted", "confirmed_complete"];

/** Status moves forward only, unless the student marks it as a correction (spec 7.3). */
export const setTaskStatus = mutation({
  args: { taskId: v.id("tasks"), status: taskStatus, correction: v.optional(v.boolean()) },
  handler: async (ctx, { taskId, status, correction }) => {
    const user = await requireStudent(ctx);
    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== user._id) throw new Error("Not your task");
    if (status === "overdue") throw new Error("Overdue is calculated, not set");
    const from = ORDER.indexOf(task.status), to = ORDER.indexOf(status);
    if (status !== "not_applicable" && task.status !== "not_applicable" && to < from && !correction) throw new Error("Status can only move forward; mark it as a correction to go back");
    await ctx.db.patch(taskId, { status });
    await ctx.db.insert("actionHistory", { actor: "student", action: correction ? "task_status_corrected" : "task_status", userId: user._id, target: taskId, detail: { from: task.status, to: status }, at: Date.now() });
  },
});

/** A student's own date for a task. Agents and rules never overwrite it. */
export const setStudentDate = mutation({
  args: { taskId: v.id("tasks"), date: v.union(v.string(), v.null()) },
  handler: async (ctx, { taskId, date }) => {
    const user = await requireStudent(ctx);
    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== user._id) throw new Error("Not your task");
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must be YYYY-MM-DD");
    await ctx.db.patch(taskId, { studentDate: date ?? undefined });
  },
});
