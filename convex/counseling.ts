import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { activeAssignment, requireCounselor, requireStudent, requireStudentReader } from "./lib/access";
import { nextCounselor } from "./lib/rules/roundRobin.ts";

/**
 * Round-robin assignment (COUNSEL-002, CV-5). Reading the pointer, choosing the counselor and
 * advancing the pointer happen in this one mutation, so Convex's transactions guarantee two
 * simultaneous requests never take the same turn.
 */
async function assign(ctx: MutationCtx, requestId: Id<"counselingRequests">, studentId: Id<"users">) {
  const counselors = await ctx.db.query("counselors").collect();
  const rotation = await ctx.db.query("rotation").withIndex("by_key", (q) => q.eq("key", "counselors")).unique();
  const current = await activeAssignment(ctx, studentId);
  const choice = nextCounselor(
    counselors.map((c) => ({ id: c._id, rotationOrder: c.rotationOrder, active: c.active })),
    rotation?.lastOrder ?? null,
    current?.counselorId ?? null,
  );
  if (choice.status === "pending") {
    await ctx.db.patch(requestId, { status: "pending" });
    return { status: "pending" as const };
  }
  const counselorId = choice.counselorId as Id<"counselors">;
  if (!choice.reused) {
    if (rotation) await ctx.db.patch(rotation._id, { lastOrder: choice.newPointer });
    else await ctx.db.insert("rotation", { key: "counselors", lastOrder: choice.newPointer });
    await ctx.db.insert("assignments", { requestId, studentId, counselorId, assignedAt: Date.now(), method: "round_robin", active: true });
  }
  await ctx.db.patch(requestId, { status: "assigned" });
  const conversationId = await ensureConversation(ctx, studentId, counselorId);
  const counselor = (await ctx.db.get(counselorId))!;
  if (!choice.reused) {
    await ctx.db.insert("messages", {
      conversationId, senderType: "system", body: `${counselor.displayName} is your counselor.`, fileRefs: [], createdAt: Date.now(),
    });
  }
  await ctx.db.insert("actionHistory", {
    actor: "system", action: "counselor_assigned", userId: studentId, target: counselorId,
    detail: { requestId, method: "round_robin", reused: choice.reused }, at: Date.now(),
  });
  return { status: "assigned" as const, counselorId, counselorName: counselor.displayName, conversationId };
}

async function ensureConversation(ctx: MutationCtx, studentId: Id<"users">, counselorId: Id<"counselors">) {
  const existing = (await ctx.db.query("conversations").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect())
    .find((c) => c.counselorId === counselorId);
  return existing?._id ?? ctx.db.insert("conversations", { studentId, counselorId, createdAt: Date.now() });
}

/** A student can ask for counseling at any stage; their work is not blocked either way. */
export const request = mutation({
  args: { stage: v.string(), context: v.optional(v.any()) },
  handler: async (ctx, { stage, context }) => {
    const user = await requireStudent(ctx);
    const requestId = await ctx.db.insert("counselingRequests", {
      userId: user._id, status: "requested", stage, contextSnapshot: context ?? null, createdAt: Date.now(),
    });
    return { requestId, ...(await assign(ctx, requestId, user._id)) };
  },
});

export const myStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    const assignment = await activeAssignment(ctx, user._id);
    const requests = await ctx.db.query("counselingRequests").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(1);
    if (!assignment) return { status: requests[0]?.status ?? "none", counselorName: null, conversationId: null };
    const counselor = await ctx.db.get(assignment.counselorId);
    const conversation = (await ctx.db.query("conversations").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect())
      .find((c) => c.counselorId === assignment.counselorId);
    return { status: "assigned", counselorName: counselor?.displayName ?? null, conversationId: conversation?._id ?? null };
  },
});

/** Counselor sees only students assigned to them. */
export const listAssigned = query({
  args: {},
  handler: async (ctx) => {
    const { counselor } = await requireCounselor(ctx);
    const assignments = await ctx.db.query("assignments").withIndex("by_counselor", (q) => q.eq("counselorId", counselor._id).eq("active", true)).collect();
    return Promise.all(assignments.map(async (a) => {
      const student = await ctx.db.get(a.studentId);
      const request = await ctx.db.get(a.requestId);
      return { studentId: a.studentId, name: student?.name ?? student?.email ?? "Student", assignedAt: a.assignedAt, stage: request?.stage ?? null };
    }));
  },
});

export const getCase = query({
  args: { studentId: v.id("users") },
  handler: async (ctx, { studentId }) => {
    const access = await requireStudentReader(ctx, studentId);
    if (access.as !== "counselor") throw new Error("Counselor view only");
    const profile = await ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", studentId)).unique();
    const requests = await ctx.db.query("counselingRequests").withIndex("by_user", (q) => q.eq("userId", studentId)).collect();
    const applications = await ctx.db.query("studentApplications").withIndex("by_user", (q) => q.eq("userId", studentId)).collect();
    const tasks = await ctx.db.query("tasks").withIndex("by_user", (q) => q.eq("userId", studentId)).collect();
    return { profile, requests, applications, tasks };
  },
});

/** When a counselor becomes active, pending requests are assigned in arrival order. */
export const assignPending = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db.query("counselingRequests").withIndex("by_status", (q) => q.eq("status", "pending")).collect();
    const results = [];
    for (const r of pending.sort((a, b) => a.createdAt - b.createdAt)) results.push(await assign(ctx, r._id, r.userId));
    return results;
  },
});

/** The assigned counselor's conversation with a student. */
export const conversationFor = query({
  args: { studentId: v.id("users") },
  handler: async (ctx, { studentId }) => {
    const access = await requireStudentReader(ctx, studentId);
    if (access.as !== "counselor") throw new Error("Counselor view only");
    const conversations = await ctx.db.query("conversations").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect();
    return conversations.find((c) => c.counselorId === access.counselor._id)?._id ?? null;
  },
});
