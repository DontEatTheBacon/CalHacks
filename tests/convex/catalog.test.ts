// Programs and published facts: scope, withheld ambiguity, de-duplication, removal on re-extraction.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { as, setup, student, type T } from "./setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function page(t: T, url: string, title: string) {
  return t.run((ctx) => ctx.db.insert("sources", {
    url, finalUrl: url, domain: new URL(url).hostname, title, retrievedAt: Date.now(), fetchMethod: "plain", status: "ok", verification: "unverified", apifyRunId: "r1",
  }));
}
async function candidate(t: T, sourceId: Id<"sources">, kind: "cost" | "language" | "milestone", fields: object, status: "ready" | "needs_confirmation" = "ready") {
  return t.run(async (ctx) => {
    const src = (await ctx.db.get(sourceId))!;
    const runId = await ctx.db.insert("extractionRuns", { sourceId, model: "rules-test", schemaVersion: "candidate-v1", validatorResult: {}, createdAt: Date.now() });
    return ctx.db.insert("candidates", { sourceId, extractionRunId: runId, domain: src.domain, kind, status, reasons: [], fields, evidence: "excerpt", line: 0, ruleVersion: "rules-test", createdAt: Date.now() });
  });
}
const cost = (amount: number, label: string | null, extra: object = {}) => ({ amount, currency: "GBP", itemType: "tuition", period: "annual", applicantCategory: "international", academicYear: "2027/28", label, ...extra });

async function build(t: T) {
  await t.mutation(internal.catalog.seedInstitutions, {});
  await t.mutation(internal.catalog.identifyPrograms, {});
  return t.mutation(internal.catalog.publishFacts, {});
}
const programs = (t: T) => t.query(internal.catalog.reviewPrograms, {});

describe("catalog", () => {
  test("program pages become programs; listing pages and foundation variants do not; duplicates merge", async () => {
    const t = setup();
    await page(t, "https://sheffield.ac.uk/undergraduate/courses/2027/computer-science-bsc", "Computer Science BSc | Undergraduate study | The University of Sheffield");
    await page(t, "https://sheffield.ac.uk/undergraduate/courses/2027/computer-science-foundation-year-bsc", "Computer Science with a Foundation Year BSc | Undergraduate study | The University of Sheffield");
    await page(t, "https://sheffield.ac.uk/economics/undergraduate/courses", "Undergraduate courses | Economics | The University of Sheffield");
    await page(t, "https://catalog.illinois.edu/undergraduate/engineering/computer-science-bs/", "Computer Science, BS | 2026-2027 Course Catalog | University of Illinois Urbana-Champaign");
    await page(t, "https://siebelschool.illinois.edu/academics/undergraduate/degree-program-options/bs-computer-science", "B.S. in Computer Science | Siebel School of Computing and Data Science | Illinois");
    await build(t);
    const ps = await programs(t);
    expect(ps.map((p) => `${p.institution.name}: ${p.name}`).sort()).toEqual([
      "University of Illinois Urbana-Champaign: Computer Science, BS",
      "University of Sheffield: Computer Science BSc",
    ]);
  });

  test("facts on a program page belong to that program; institution facts apply to all; unknowns are listed", async () => {
    const t = setup();
    const cs = await page(t, "https://www.lancaster.ac.uk/study/undergraduate/courses/computer-science-bsc-hons-g400/2027/", "Computer Science BSc Hons (G400) - Lancaster University");
    const econ = await page(t, "https://www.lancaster.ac.uk/study/undergraduate/courses/economics-bsc-hons-l100/2027/", "Economics BSc Hons (L100) - Lancaster University");
    const general = await page(t, "https://www.lancaster.ac.uk/study/international-students/", "International students");
    await candidate(t, cs, "cost", cost(31700, "International"));
    await candidate(t, econ, "cost", cost(27100, "International"));
    await candidate(t, general, "language", { test: "ielts", score: 6.5, mayVary: true });
    await candidate(t, general, "milestone", { dateText: "13 January 2027", dateStart: "2027-01-13", cutoffTime: null, timezone: null, round: "Equal consideration", cue: "deadline", scholarship: false });
    await candidate(t, general, "cost", cost(99999, null), "needs_confirmation");
    await build(t);
    const ps = await programs(t);
    const csP = ps.find((p) => p.name.startsWith("Computer Science"))!;
    const econP = ps.find((p) => p.name.startsWith("Economics"))!;
    expect(csP.costs.map((c) => [c.amount, c.scope])).toEqual([[31700, "program"]]);
    expect(econP.costs.map((c) => [c.amount, c.scope])).toEqual([[27100, "program"]]);
    for (const p of [csP, econP]) {
      expect(p.requirements.map((r) => r.text)).toEqual(["IELTS 6.5 (some courses may require more)"]);
      expect(p.milestones.map((m) => m.dateStart)).toEqual(["2027-01-13"]);
      expect(p.unknowns).toEqual(["living costs", "grade requirement for Indonesian students"]);
    }
  });

  test("several institution-wide tuition amounts or conflicting English minimums are withheld, not guessed", async () => {
    const t = setup();
    await page(t, "https://www.bath.ac.uk/courses/undergraduate-2027/computer-science/bsc-computer-science/", "Computer Science BSc (Hons)");
    const fees = await page(t, "https://www.bath.ac.uk/corporate-information/fees-2027", "Tuition fees 2027");
    const english = await page(t, "https://www.bath.ac.uk/topics/english", "English requirements");
    await candidate(t, fees, "cost", cost(26150, "Band 1: Humanities"));
    await candidate(t, fees, "cost", cost(32950, "Band 3: Science and Engineering"));
    await candidate(t, english, "language", { test: "ielts", score: 6.5, mayVary: false });
    await candidate(t, english, "language", { test: "ielts", score: 7, mayVary: false });
    const r = await build(t);
    expect(r).toMatchObject({ withheldAmbiguousTuition: 2, withheldConflicting: 2, costItems: 0, requirements: 0 });
    const [p] = await programs(t);
    expect(p!.unknowns).toContain("international tuition");
    expect(p!.unknowns).toContain("English language minimum");
  });

  test("a cost row that names the program is scoped to it; repeats publish once; facts vanish with their candidate", async () => {
    const t = setup();
    await page(t, "https://www.bath.ac.uk/courses/undergraduate-2026/economics/bsc-economics/", "Economics BSc (Hons)");
    const fees = await page(t, "https://www.bath.ac.uk/corporate-information/fees-2027", "Tuition fees 2027");
    const named = await candidate(t, fees, "cost", cost(29500, "BSc Economics"));
    await candidate(t, fees, "cost", cost(29500, "BSc Economics"));
    await candidate(t, fees, "cost", cost(29500, "BSc Economics and Politics"));
    const r = await build(t);
    expect(r).toMatchObject({ costItems: 1, duplicates: 1, otherCourse: 1 });
    expect((await programs(t))[0]!.costs.map((c) => [c.amount, c.scope])).toEqual([[29500, "program"]]);
    // Re-extraction removed the candidate: the published fact goes too.
    await t.run(async (ctx) => {
      for (const c of await ctx.db.query("candidates").collect()) await ctx.db.delete(c._id);
    });
    void named;
    expect(await t.mutation(internal.catalog.publishFacts, {})).toMatchObject({ removed: 1 });
    expect((await programs(t))[0]!.costs).toEqual([]);
  });

  test("the program list is for signed-in users only", async () => {
    const t = setup();
    await expect(t.query(api.catalog.listPrograms, {})).rejects.toThrow(/Sign in required/);
    const s = await student(t, "s@t");
    expect(await as(t, s).query(api.catalog.listPrograms, {})).toEqual([]);
  });
});
