// Job table (CV-4): idempotent enqueue, leases, retry once after a worker dies, no duplicate completion.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { enqueue } from "../../convex/jobs";
import { setup, WORKER_SECRET } from "./setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const worker = (workerId: string) => ({ workerKey: WORKER_SECRET, workerId });

describe("job table", () => {
  test("enqueue with the same idempotency key creates one job", async () => {
    const t = setup();
    const a = await t.run((ctx) => enqueue(ctx, { type: "research", idempotencyKey: "app-1:research", payload: { n: 1 } }));
    const b = await t.run((ctx) => enqueue(ctx, { type: "research", idempotencyKey: "app-1:research", payload: { n: 2 } }));
    expect(a.created).toBe(true);
    expect(b).toEqual({ jobId: a.jobId, created: false });
    expect(await t.run((ctx) => ctx.db.query("agentJobs").collect())).toHaveLength(1);
  });

  test("a wrong or missing worker secret is refused", async () => {
    const t = setup();
    await expect(t.mutation(api.jobs.claim, { workerKey: "nope", workerId: "w", types: ["research"] })).rejects.toThrow(/Invalid worker credential/);
  });

  test("a worker killed mid-run: the job is retried once, then marked failed, and the dead worker cannot finish it", async () => {
    const t = setup();
    const { jobId } = await t.run((ctx) => enqueue(ctx, { type: "research", idempotencyKey: "k", payload: {}, maxAttempts: 2 }));

    const first = await t.mutation(api.jobs.claim, { ...worker("w1"), types: ["research"] });
    expect(first).toMatchObject({ jobId, attempt: 1 });
    expect(await t.mutation(api.jobs.claim, { ...worker("w2"), types: ["research"] })).toBeNull(); // leased, not handed out twice

    vi.advanceTimersByTime(6 * 60 * 1000); // past the 5-minute lease
    expect(await t.mutation(internal.jobs.requeueExpired, {})).toEqual({ requeued: 1 });

    const second = await t.mutation(api.jobs.claim, { ...worker("w2"), types: ["research"] });
    expect(second).toMatchObject({ jobId, attempt: 2 });
    // The first worker wakes up late: its writes are ignored, so the result is not duplicated.
    expect(await t.mutation(api.jobs.complete, { ...worker("w1"), jobId, runId: first!.runId, attempt: 1, result: "stale" })).toEqual({ accepted: false });
    expect(await t.mutation(api.jobs.complete, { ...worker("w2"), jobId, runId: second!.runId, attempt: 2, result: "ok" })).toEqual({ accepted: true });
    const job = await t.run((ctx) => ctx.db.get(jobId));
    expect(job).toMatchObject({ status: "succeeded", result: "ok", attempts: 2 });
  });

  test("after the last attempt expires the job is failed with the reason kept", async () => {
    const t = setup();
    const { jobId } = await t.run((ctx) => enqueue(ctx, { type: "research", idempotencyKey: "k", payload: {}, maxAttempts: 1 }));
    await t.mutation(api.jobs.claim, { ...worker("w1"), types: ["research"] });
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(await t.mutation(internal.jobs.requeueExpired, {})).toEqual({ requeued: 0 });
    expect(await t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ status: "failed", lastError: expect.stringMatching(/Lease expired/) });
  });

  test("an explicit failure retries until maxAttempts", async () => {
    const t = setup();
    const { jobId } = await t.run((ctx) => enqueue(ctx, { type: "research", idempotencyKey: "k", payload: {}, maxAttempts: 2 }));
    const c1 = (await t.mutation(api.jobs.claim, { ...worker("w"), types: ["research"] }))!;
    expect(await t.mutation(api.jobs.fail, { ...worker("w"), jobId, runId: c1.runId, attempt: 1, error: "timeout" })).toEqual({ accepted: true, willRetry: true });
    const c2 = (await t.mutation(api.jobs.claim, { ...worker("w"), types: ["research"] }))!;
    expect(await t.mutation(api.jobs.fail, { ...worker("w"), jobId, runId: c2.runId, attempt: 2, error: "timeout" })).toEqual({ accepted: true, willRetry: false });
    expect(await t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ status: "failed", lastError: "timeout" });
  });
});
