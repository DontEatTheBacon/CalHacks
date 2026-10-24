// Student intake (PROF-001, scenario 15 at intake).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { as, setup, student } from "./setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const year = new Date().getFullYear();
const prefs = {
  countries: ["US" as const, "GB" as const], settings: [], majors: ["cs", "econ"], relatedOk: true,
  budgetAmount: 1_200_000_000, budgetCurrency: "IDR", budgetPeriod: "annual" as const, budgetScope: "all_in" as const,
  climate: "mild" as const, intakeTerm: "fall" as const, intakeYear: year + 1,
};

describe("intake", () => {
  test("every answer except country may be unknown, and the intake can still be finished", async () => {
    const t = setup();
    const s = await student(t, "s@t");
    await as(t, s).mutation(api.profiles.upsertMine, { countries: ["GB"], settings: [], majors: [], climate: "unknown", intakeTerm: "unknown" });
    await as(t, s).mutation(api.profiles.completeIntake, {});
    const state = await as(t, s).query(api.profiles.intake, {});
    expect(state.completed).toBe(true);
    expect(state.qualification).toBeNull();
    expect(state.profile?.budgetAmount).toBeUndefined();
  });

  test("finishing requires at least one country (an empty selection never means both)", async () => {
    const t = setup();
    const s = await student(t, "s@t");
    await expect(as(t, s).mutation(api.profiles.completeIntake, {})).rejects.toThrow(/study preferences first/);
    await as(t, s).mutation(api.profiles.upsertMine, { ...prefs, countries: [] });
    await expect(as(t, s).mutation(api.profiles.completeIntake, {})).rejects.toThrow(/at least one country/);
  });

  test("invalid answers are refused", async () => {
    const t = setup();
    const s = await student(t, "s@t");
    const m = (p: object) => as(t, s).mutation(api.profiles.upsertMine, { ...prefs, ...p });
    await expect(m({ majors: ["astrology"] })).rejects.toThrow(/Unknown major/);
    await expect(m({ budgetAmount: -5 })).rejects.toThrow(/positive/);
    await expect(m({ budgetCurrency: "EUR" })).rejects.toThrow(/IDR, USD or GBP/);
    await expect(m({ intakeYear: year - 1 })).rejects.toThrow(/out of range/);
    const q = (p: object) => as(t, s).mutation(api.profiles.addQualification, { curriculum: "Kurikulum Merdeka", scaleMin: 0, scaleMax: 100, subjects: [], ...p });
    await expect(q({ reportedOverall: 120 })).rejects.toThrow(/outside the grading scale/);
    await expect(q({ subjects: [{ subject: "Matematika", grade: 101 }] })).rejects.toThrow(/outside the grading scale/);
    await expect(q({ gradeLevel: 9 })).rejects.toThrow(/10, 11 or 12/);
    await expect(as(t, s).mutation(api.profiles.setLanguage, { tests: [{ test: "ielts_academic", status: "taken", score: 10 }] })).rejects.toThrow(/out of range/);
  });

  test("the intake resumes with saved answers; completion survives later edits; grades are never overwritten", async () => {
    const t = setup();
    const s = await student(t, "s@t");
    await as(t, s).mutation(api.profiles.upsertMine, prefs);
    await as(t, s).mutation(api.profiles.addQualification, {
      qualificationType: "SMA", curriculum: "Kurikulum Merdeka", gradeLevel: 12, year: year + 1, scaleMin: 0, scaleMax: 100, reportedOverall: 86,
      subjects: [{ subject: "Matematika", grade: 88 }, { subject: "Bahasa Inggris", grade: 84 }],
    });
    await as(t, s).mutation(api.profiles.setLanguage, { tests: [{ test: "ielts_academic", status: "not_taken" }] });
    await as(t, s).mutation(api.profiles.completeIntake, {});
    await as(t, s).mutation(api.profiles.upsertMine, { ...prefs, settings: ["countryside"] });
    await as(t, s).mutation(api.profiles.addQualification, { curriculum: "Kurikulum Merdeka", scaleMin: 0, scaleMax: 100, reportedOverall: 87, subjects: [] });
    await as(t, s).mutation(api.profiles.setLanguage, { tests: [{ test: "ielts_academic", status: "taken", score: 7, takenOn: `${year}-09-01` }] });
    const state = await as(t, s).query(api.profiles.intake, {});
    expect(state.completed).toBe(true);
    expect(state.profile?.settings).toEqual(["countryside"]);
    expect(state.qualification?.reportedOverall).toBe(87);
    expect(state.language).toEqual([{ test: "ielts_academic", status: "taken", score: 7, takenOn: `${year}-09-01` }]);
    const all = await t.run((ctx) => ctx.db.query("qualificationRecords").collect());
    expect(all.map((r) => r.reportedOverall)).toEqual([86, 87]);
  });

  test("a counselor request from the intake step keeps the context", async () => {
    const t = setup();
    const s = await student(t, "s@t");
    await as(t, s).mutation(api.profiles.upsertMine, prefs);
    const r = await as(t, s).mutation(api.counseling.request, { stage: "intake", context: { step: 2 } });
    expect(r.status).toBe("pending");
    const req = await t.run((ctx) => ctx.db.get(r.requestId));
    expect(req).toMatchObject({ stage: "intake", contextSnapshot: { step: 2 } });
    expect((await as(t, s).query(api.profiles.intake, {})).profile?.majors).toEqual(["cs", "econ"]);
  });
});
