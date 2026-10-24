// Job table (CV-4). Convex scheduled actions run at most once and never retry, so all agent and
// integration work goes through here: an idempotency key prevents duplicate jobs, a lease marks
// a running job, and the sweeper puts expired leases back in the queue until maxAttempts is reached.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import limits from "../config/limits.json" with { type: "json" };
import { requireStudent } from "./lib/access";

const LEASE_MS = limits.agent.jobTimeoutSec * 1000;

export async function enqueue(
  ctx: MutationCtx,
  job: { type: string; idempotencyKey: string; payload: unknown; userId?: Id<"users">; maxAttempts?: number },
): Promise<{ jobId: Id<"agentJobs">; created: boolean }> {
  const existing = await ctx.db.query("agentJobs").withIndex("by_idempotency", (q) => q.eq("idempotencyKey", job.idempotencyKey)).first();
  if (existing) return { jobId: existing._id, created: false };
  const now = Date.now();
  const jobId = await ctx.db.insert("agentJobs", {
    type: job.type, userId: job.userId, payload: job.payload, idempotencyKey: job.idempotencyKey,
    status: "queued", attempts: 0, maxAttempts: job.maxAttempts ?? 2, createdAt: now, updatedAt: now,
  });
  return { jobId, created: true };
}

// ---- Worker side. The Factory worker authenticates with a service secret (CV-6). ----

function requireWorker(workerKey: string) {
  const expected = process.env.WORKER_SECRET;
  if (!expected || expected.length < 32) throw new Error("Worker access is not configured");
  // Length-independent comparison so the secret cannot be guessed byte by byte from timing.
  let diff = workerKey.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= (workerKey.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  if (diff !== 0) throw new Error("Invalid worker credential");
}

/** Claims the oldest queued job of the given types and leases it to this worker. */
export const claim = mutation({
  args: { workerKey: v.string(), workerId: v.string(), types: v.array(v.string()) },
  handler: async (ctx, { workerKey, workerId, types }) => {
    requireWorker(workerKey);
    const queued = await ctx.db.query("agentJobs").withIndex("by_status", (q) => q.eq("status", "queued")).order("asc").take(50);
    const job = queued.find((j) => types.includes(j.type));
    if (!job) return null;
    const now = Date.now();
    const attempt = job.attempts + 1;
    await ctx.db.patch(job._id, { status: "running", attempts: attempt, workerId, leaseUntil: now + LEASE_MS, updatedAt: now });
    const runId = await ctx.db.insert("agentRuns", { jobId: job._id, attempt, steps: [], startedAt: now });
    return { jobId: job._id, runId, attempt, type: job.type, payload: job.payload };
  },
});

/** Only the current lease holder may write; a worker whose lease expired is ignored (no duplicates). */
async function requireLease(ctx: MutationCtx, jobId: Id<"agentJobs">, workerId: string, attempt: number) {
  const job = await ctx.db.get(jobId);
  if (!job || job.status !== "running" || job.workerId !== workerId || job.attempts !== attempt) return null;
  return job;
}

export const appendStep = mutation({
  args: { workerKey: v.string(), workerId: v.string(), jobId: v.id("agentJobs"), runId: v.id("agentRuns"), attempt: v.number(), step: v.any() },
  handler: async (ctx, { workerKey, workerId, jobId, runId, attempt, step }) => {
    requireWorker(workerKey);
    const job = await requireLease(ctx, jobId, workerId, attempt);
    if (!job) return { accepted: false };
    const run = await ctx.db.get(runId);
    if (!run || run.jobId !== jobId) return { accepted: false };
    await ctx.db.patch(runId, { steps: [...run.steps, { at: Date.now(), ...step }] });
    await ctx.db.patch(jobId, { leaseUntil: Date.now() + LEASE_MS, updatedAt: Date.now() });
    return { accepted: true };
  },
});

export const complete = mutation({
  args: { workerKey: v.string(), workerId: v.string(), jobId: v.id("agentJobs"), runId: v.id("agentRuns"), attempt: v.number(), result: v.any() },
  handler: async (ctx, { workerKey, workerId, jobId, runId, attempt, result }) => {
    requireWorker(workerKey);
    if (!(await requireLease(ctx, jobId, workerId, attempt))) return { accepted: false };
    const now = Date.now();
    await ctx.db.patch(jobId, { status: "succeeded", result, leaseUntil: undefined, updatedAt: now });
    await ctx.db.patch(runId, { endedAt: now, outcome: "succeeded" });
    return { accepted: true };
  },
});

export const fail = mutation({
  args: { workerKey: v.string(), workerId: v.string(), jobId: v.id("agentJobs"), runId: v.id("agentRuns"), attempt: v.number(), error: v.string() },
  handler: async (ctx, { workerKey, workerId, jobId, runId, attempt, error }) => {
    requireWorker(workerKey);
    const job = await requireLease(ctx, jobId, workerId, attempt);
    if (!job) return { accepted: false };
    const now = Date.now();
    const retry = job.attempts < job.maxAttempts;
    await ctx.db.patch(jobId, { status: retry ? "queued" : "failed", lastError: error.slice(0, 2000), leaseUntil: undefined, workerId: undefined, updatedAt: now });
    await ctx.db.patch(runId, { endedAt: now, outcome: "failed" });
    return { accepted: true, willRetry: retry };
  },
});

/** Runs every minute (convex/crons.ts): recovers jobs whose worker died mid-run. */
export const requeueExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const running = await ctx.db.query("agentJobs").withIndex("by_status", (q) => q.eq("status", "running")).collect();
    let requeued = 0;
    for (const job of running) {
      if ((job.leaseUntil ?? 0) > now) continue;
      const retry = job.attempts < job.maxAttempts;
      await ctx.db.patch(job._id, {
        status: retry ? "queued" : "failed", lastError: "Lease expired: the worker stopped responding",
        leaseUntil: undefined, workerId: undefined, updatedAt: now,
      });
      const runs = await ctx.db.query("agentRuns").withIndex("by_job", (q) => q.eq("jobId", job._id)).collect();
      for (const r of runs) if (r.endedAt === undefined) await ctx.db.patch(r._id, { endedAt: now, outcome: "lease_expired" });
      if (retry) requeued++;
    }
    return { requeued };
  },
});

/** Visible job states for the student's own work. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    const jobs = await ctx.db.query("agentJobs").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(50);
    return jobs.map((j) => ({ id: j._id, type: j.type, status: j.status, attempts: j.attempts, lastError: j.lastError ?? null, updatedAt: j.updatedAt }));
  },
});
