// Saved programs and plans (spec 5.6, 5.7; scenario 13).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { as, setup, student, threeCounselors, type T } from "./setup";

beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-24T12:00:00Z") }));
afterEach(() => vi.useRealTimers());

async function program(t: T, deadline: string | null) {
  await t.mutation(internal.catalog.seedInstitutions, {});
  return t.run(async (ctx) => {
    const inst = (await ctx.db.query("institutions").withIndex("by_slug", (q) => q.eq("slug", "lancaster")).unique())!;
    const src = await ctx.db.insert("sources", { url: "https://www.lancaster.ac.uk/x", domain: "www.lancaster.ac.uk", retrievedAt: Date.now(), fetchMethod: "plain", status: "ok", verification: "unverified" });
    const ev = await ctx.db.insert("evidence", { sourceId: src, excerpt: "e" });
    const programId = await ctx.db.insert("programs", { institutionId: inst._id, name: "Computer Science BSc Hons (G400)", degree: "BSc", taxonomyCode: "cs", status: "verified", version: 1 });
    await ctx.db.insert("requirements", { institutionId: inst._id, programId, scope: "program", type: "language", text: "IELTS 6", threshold: "6", scale: "ielts", evidenceId: ev, verification: "verified", version: 1 });
    if (deadline) await ctx.db.insert("milestones", { institutionId: inst._id, scope: "institution", category: "equal consideration", officialName: "x", dateStart: deadline, dateType: "verified_hard_deadline", mandatoryState: "unknown", evidenceId: ev, verification: "verified", version: 1 });
    return programId;
  });
}

describe("saved programs", () => {
  test("saving creates the plan once, queues the agent job, and appears in next actions", async () => {
    const t = setup();
    const programId = await program(t, "2027-01-13");
    const s = await student(t, "nadia@t");
    const id1 = await as(t, s).mutation(api.applications.save, { programId });
    const id2 = await as(t, s).mutation(api.applications.save, { programId });
    expect(id2).toBe(id1);
    const mine = await as(t, s).query(api.applications.listMine, {});
    expect(mine.applications).toHaveLength(1);
    const app = mine.applications[0]!;
    expect(app.deadline).toBe("2027-01-13");
    expect(app.tasks.map((x) => [x.planKey, x.dueType, x.dueAt])).toEqual([
      ["english_book", "recommended", "2026-09-30"], ["english_test", "recommended", "2026-11-11"], ["english_results", "recommended", "2026-12-09"],
      ["english_send", "recommended", "2026-12-23"], ["submit", "official", "2027-01-13"], ["grade_confirmation", "none", null],
    ]);
    // 80 days left (counted in UTC+14 when the timezone is unpublished) vs 42+14+14 lead + 7 buffer = 77 needed: tight, not on track (needs ×1.25).
    expect(app.risk).toBe("tight");
    expect(mine.nextActions[0]!.planKey).toBe("english_book");
    const jobs = await t.run((ctx) => ctx.db.query("agentJobs").collect());
    expect(jobs).toMatchObject([{ type: "application_research", status: "queued", idempotencyKey: `application:${id1}:research` }]);
  });

  test("task status moves forward only unless marked as a correction; overdue is computed from official dates", async () => {
    const t = setup();
    const programId = await program(t, "2026-10-20"); // already passed
    const s = await student(t, "nadia@t");
    const appId = await as(t, s).mutation(api.applications.save, { programId });
    const app = (await as(t, s).query(api.applications.get, { applicationId: appId }))!;
    // A passed deadline is not "upcoming", so the plan asks to find the deadline instead of inventing one.
    expect(app.tasks[0]!.planKey).toBe("find_deadline");
    const task = app.tasks.find((x) => x.planKey === "grade_confirmation")!;
    await as(t, s).mutation(api.applications.setTaskStatus, { taskId: task.id, status: "in_progress" });
    await expect(as(t, s).mutation(api.applications.setTaskStatus, { taskId: task.id, status: "not_started" })).rejects.toThrow(/only move forward/);
    await as(t, s).mutation(api.applications.setTaskStatus, { taskId: task.id, status: "not_started", correction: true });
    await expect(as(t, s).mutation(api.applications.setTaskStatus, { taskId: task.id, status: "overdue" })).rejects.toThrow(/calculated/);
    // Official date in the past and not done → overdue.
    await t.run(async (ctx) => ctx.db.patch(task.id as Id<"tasks">, { dueType: "official", dueAt: "2026-10-01" }));
    expect((await as(t, s).query(api.applications.get, { applicationId: appId }))!.tasks.find((x) => x.id === task.id)!.status).toBe("overdue");
  });

  test("only the owner and the assigned counselor can see an application; removal deletes its tasks", async () => {
    const t = setup();
    const { ayu, budi } = await threeCounselors(t);
    const programId = await program(t, "2027-01-13");
    const s = await student(t, "nadia@t");
    const other = await student(t, "other@t");
    const appId = await as(t, s).mutation(api.applications.save, { programId });
    await expect(as(t, other).query(api.applications.get, { applicationId: appId })).rejects.toThrow(/Not your record/);
    await as(t, s).mutation(api.counseling.request, { stage: "workspace" });
    expect(await as(t, ayu).query(api.applications.get, { applicationId: appId })).not.toBeNull();
    await expect(as(t, budi).query(api.applications.get, { applicationId: appId })).rejects.toThrow(/Not assigned/);
    const taskId = (await as(t, s).query(api.applications.get, { applicationId: appId }))!.tasks[0]!.id;
    await expect(as(t, other).mutation(api.applications.setTaskStatus, { taskId, status: "in_progress" })).rejects.toThrow(/Not your task/);
    await expect(as(t, other).mutation(api.applications.remove, { applicationId: appId })).rejects.toThrow(/Not your application/);
    await as(t, s).mutation(api.applications.remove, { applicationId: appId });
    expect(await t.run((ctx) => ctx.db.query("tasks").collect())).toEqual([]);
  });
});
