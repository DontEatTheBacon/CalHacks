// Access tests (CV-2, spec 3.1, scenarios 15–17).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { as, counselor, setup, student, threeCounselors } from "./setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const profile = { countries: ["US" as const, "GB" as const], settings: [], majors: ["computer_science"], budgetAmount: 1_200_000_000, budgetCurrency: "IDR" };

describe("identity and roles", () => {
  test("signed-out callers get nothing", async () => {
    const t = setup();
    expect(await t.query(api.profiles.me, {})).toBeNull();
    await expect(t.query(api.profiles.getMine, {})).rejects.toThrow(/Sign in required/);
    await expect(t.mutation(api.counseling.request, { stage: "intake" })).rejects.toThrow(/Sign in required/);
  });

  test("a counselor cannot use student-only functions, and a student cannot use counselor ones", async () => {
    const t = setup();
    const nadia = await student(t, "nadia@student.test");
    const ayu = await counselor(t, "ayu@counselor.test", "Counselor Ayu", 1);
    await expect(as(t, ayu).mutation(api.profiles.upsertMine, profile)).rejects.toThrow(/Students only/);
    await expect(as(t, nadia).query(api.counseling.listAssigned, {})).rejects.toThrow(/Counselors only/);
  });

  test("a user without a role is rejected", async () => {
    const t = setup();
    const noRole = await t.run((ctx) => ctx.db.insert("users", { email: "x@test" }));
    await expect(as(t, noRole).query(api.profiles.getMine, {})).rejects.toThrow(/no role/);
  });
});

describe("student data isolation", () => {
  test("student A cannot read student B", async () => {
    const t = setup();
    const a = await student(t, "a@student.test");
    const b = await student(t, "b@student.test");
    await as(t, b).mutation(api.profiles.upsertMine, profile);
    await expect(as(t, a).query(api.profiles.getForStudent, { studentId: b })).rejects.toThrow(/Not your record/);
    const own = await as(t, b).query(api.profiles.getForStudent, { studentId: b });
    expect(own.profile?.budgetAmount).toBe(1_200_000_000);
  });

  test("an unassigned counselor cannot read any student", async () => {
    const t = setup();
    const { ayu, budi } = await threeCounselors(t);
    const nadia = await student(t, "nadia@student.test");
    await as(t, nadia).mutation(api.profiles.upsertMine, profile);
    await as(t, nadia).mutation(api.counseling.request, { stage: "intake" }); // goes to Ayu
    for (const fn of [api.profiles.getForStudent, api.counseling.getCase, api.files.listShared]) {
      await expect(as(t, budi).query(fn, { studentId: nadia })).rejects.toThrow(/Not assigned/);
    }
    expect(await as(t, budi).query(api.counseling.listAssigned, {})).toEqual([]);
    const read = await as(t, ayu).query(api.profiles.getForStudent, { studentId: nadia });
    expect(read.profile?.majors).toEqual(["computer_science"]);
  });

  test("profile edits keep history; qualification records are append-only", async () => {
    const t = setup();
    const nadia = await student(t, "nadia@student.test");
    await as(t, nadia).mutation(api.profiles.upsertMine, profile);
    await as(t, nadia).mutation(api.profiles.upsertMine, { ...profile, countries: ["GB"] });
    const history = await t.run((ctx) => ctx.db.query("profileHistory").collect());
    expect(history).toHaveLength(1);
    expect(history[0]!.snapshot.countries).toEqual(["US", "GB"]);
    await as(t, nadia).mutation(api.profiles.addQualification, { curriculum: "Kurikulum Merdeka", scaleMin: 0, scaleMax: 100, reportedOverall: 86, subjects: [{ subject: "Mathematics", grade: 88 }] });
    await as(t, nadia).mutation(api.profiles.addQualification, { curriculum: "Kurikulum Merdeka", scaleMin: 0, scaleMax: 100, reportedOverall: 87, subjects: [] });
    const records = await t.run((ctx) => ctx.db.query("qualificationRecords").collect());
    expect(records.map((r) => r.reportedOverall)).toEqual([86, 87]);
  });
});

describe("round-robin counseling (scenarios 15, 16)", () => {
  test("three counselors, four students: rotation returns to the first", async () => {
    const t = setup();
    const { ayu, budi, citra } = await threeCounselors(t);
    const names = [];
    for (const email of ["s1@t", "s2@t", "s3@t", "s4@t"]) {
      const s = await student(t, email);
      const r = await as(t, s).mutation(api.counseling.request, { stage: "intake", context: { step: "profile" } });
      expect(r.status).toBe("assigned");
      names.push(r.status === "assigned" ? r.counselorName : null);
    }
    expect(names).toEqual(["Counselor Ayu", "Counselor Budi", "Counselor Citra", "Counselor Ayu"]);
    expect(await as(t, ayu).query(api.counseling.listAssigned, {})).toHaveLength(2);
    expect(await as(t, budi).query(api.counseling.listAssigned, {})).toHaveLength(1);
    expect(await as(t, citra).query(api.counseling.listAssigned, {})).toHaveLength(1);
  });

  test("simultaneous requests never take the same turn", async () => {
    const t = setup();
    await threeCounselors(t);
    const s1 = await student(t, "s1@t");
    const s2 = await student(t, "s2@t");
    const [r1, r2] = await Promise.all([
      as(t, s1).mutation(api.counseling.request, { stage: "discovery" }),
      as(t, s2).mutation(api.counseling.request, { stage: "discovery" }),
    ]);
    expect(r1.status === "assigned" && r2.status === "assigned" && r1.counselorId !== r2.counselorId).toBe(true);
  });

  test("a repeat request keeps the same counselor and does not advance the rotation", async () => {
    const t = setup();
    await threeCounselors(t);
    const s1 = await student(t, "s1@t");
    const first = await as(t, s1).mutation(api.counseling.request, { stage: "intake" });
    const again = await as(t, s1).mutation(api.counseling.request, { stage: "workspace" });
    expect(again.status === "assigned" && first.status === "assigned" && again.counselorId === first.counselorId).toBe(true);
    const s2 = await student(t, "s2@t");
    const next = await as(t, s2).mutation(api.counseling.request, { stage: "intake" });
    expect(next.status === "assigned" && next.counselorName).toBe("Counselor Budi");
  });

  test("with no active counselor the request is pending, the student keeps their data, and it is assigned later", async () => {
    const t = setup();
    const nadia = await student(t, "nadia@student.test");
    await as(t, nadia).mutation(api.profiles.upsertMine, profile);
    const r = await as(t, nadia).mutation(api.counseling.request, { stage: "intake", context: { draft: "keep me" } });
    expect(r.status).toBe("pending");
    expect((await as(t, nadia).query(api.counseling.myStatus, {})).status).toBe("pending");
    await counselor(t, "ayu@counselor.test", "Counselor Ayu", 1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const status = await as(t, nadia).query(api.counseling.myStatus, {});
    expect(status).toMatchObject({ status: "assigned", counselorName: "Counselor Ayu" });
    expect((await as(t, nadia).query(api.profiles.getMine, {}))?.budgetAmount).toBe(1_200_000_000);
  });
});

describe("messages (scenario 17)", () => {
  test("only the student and the assigned counselor can read and write the thread", async () => {
    const t = setup();
    const { ayu, budi } = await threeCounselors(t);
    const nadia = await student(t, "nadia@student.test");
    const other = await student(t, "other@student.test");
    const r = await as(t, nadia).mutation(api.counseling.request, { stage: "intake" });
    if (r.status !== "assigned") throw new Error("expected assignment");
    await as(t, nadia).mutation(api.messages.send, { conversationId: r.conversationId, body: "Halo, saya butuh bantuan." });
    await as(t, ayu).mutation(api.messages.send, { conversationId: r.conversationId, body: "Halo Nadia!" });
    // Later retrieval, no live connection needed: the thread is stored.
    const thread = await as(t, nadia).query(api.messages.list, { conversationId: r.conversationId });
    expect(thread.map((m) => m.senderType)).toEqual(["system", "student", "counselor"]);
    await expect(as(t, other).query(api.messages.list, { conversationId: r.conversationId })).rejects.toThrow(/Not your conversation/);
    await expect(as(t, budi).query(api.messages.list, { conversationId: r.conversationId })).rejects.toThrow(/Not assigned/);
    await expect(as(t, budi).mutation(api.messages.send, { conversationId: r.conversationId, body: "hi" })).rejects.toThrow(/Not assigned/);
  });
});
