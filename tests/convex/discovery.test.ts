// Discovery on catalog data: hard filters, lexicographic order, unknowns never rank as worse.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { as, setup, student, type T } from "./setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function seed(t: T) {
  await t.mutation(internal.catalog.seedInstitutions, {});
  await t.mutation(internal.fx.store, { rateDate: "2026-10-23", rates: [{ quote: "GBP", rate: 0.83728 }, { quote: "IDR", rate: 20268.06 }, { quote: "USD", rate: 1.1193 }] });
  return t.run(async (ctx) => {
    const inst = async (slug: string) => (await ctx.db.query("institutions").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
    const campus = async (slug: string, settingClass: "city" | "countryside" | "unclassified", climate: string) => {
      const i = await inst(slug);
      const c = (await ctx.db.query("campuses").withIndex("by_institution", (q) => q.eq("institutionId", i._id)).collect())[0]!;
      await ctx.db.patch(c._id, { settingClass, settingEvidence: { name: slug, population: 1, dataset: "test", reason: "test", climate: { class: climate, annualMeanC: 10, coldestMonthMeanC: 4, period: "test", source: "test" } } });
      return { i, c };
    };
    const program = async (slug: string, name: string, major: string, setting: "city" | "countryside" | "unclassified", climate: string, tuition?: [number, string]) => {
      const { i, c } = await campus(slug, setting, climate);
      const id = await ctx.db.insert("programs", { institutionId: i._id, campusId: c._id, name, degree: "BSc", taxonomyCode: major, status: "verified", version: 1 });
      if (tuition) await ctx.db.insert("costItems", { institutionId: i._id, programId: id, scope: "program", kind: "tuition", amount: tuition[0], currency: tuition[1], period: "annual", applicantCategory: "international" });
      return id;
    };
    return {
      lancasterCs: await program("lancaster", "Computer Science BSc", "cs", "countryside", "mild", [31700, "GBP"]),
      bathCs: await program("bath", "Computer Science BSc (Hons)", "cs", "city", "mild"),
      msuCs: await program("msu", "Computer Science (B.S.)", "cs", "countryside", "cool", [90000, "USD"]),
      lboroCs: await program("lboro", "Computer Science BSc", "cs", "unclassified", "mild"),
      sheffieldEcon: await program("sheffield", "Economics BSc", "econ", "city", "mild", [20000, "GBP"]),
    };
  });
}

const nadia = { countries: ["US" as const, "GB" as const], settings: [] as ("city" | "countryside")[], majors: ["cs"], budgetAmount: 1_200_000_000, budgetCurrency: "IDR", budgetPeriod: "annual" as const, budgetScope: "tuition_only" as const, climate: "mild" as const };

describe("discovery", () => {
  test("ranks by major, then budget, then climate; other majors and over-budget programs stay listed", async () => {
    const t = setup();
    const ids = await seed(t);
    const s = await student(t, "nadia@t");
    await as(t, s).mutation(api.profiles.upsertMine, nadia);
    const r = await as(t, s).query(api.discovery.forMe, {});
    if (r.needsProfile) throw new Error("profile expected");
    const order = r.results.map((x) => x.id as Id<"programs">);
    // CS programs first; within them by budget band: within (incomplete) → unknown → over; other majors after.
    expect(order[0]).toBe(ids.lancasterCs);
    expect(order.slice(1, 3).sort()).toEqual([ids.bathCs, ids.lboroCs].sort());
    expect(order[3]).toBe(ids.msuCs);
    expect(order[4]).toBe(ids.sheffieldEcon);
    const lan = r.results[0]!;
    // Mandatory fees are not published, so the cost is incomplete even for a tuition-only budget.
    expect(lan.bands).toEqual({ major: "direct", academic: "needs_confirmation", budget: "within_incomplete", climate: "match" });
    expect(lan.costs[0]!.converted).toBe(Math.round((31700 / 0.83728) * 20268.06));
    expect(r.results.find((x) => x.id === ids.msuCs)!.bands.budget).toBe("over");
    expect(r.results.find((x) => x.id === ids.bathCs)!.bands.budget).toBe("unknown");
    expect(r.results.find((x) => x.id === ids.sheffieldEcon)!.bands.major).toBe("other");
    expect(r.rates).toMatchObject({ date: "2026-10-23" });
  });

  test("country and setting are hard filters; unclassified campuses are counted, not shown", async () => {
    const t = setup();
    const ids = await seed(t);
    const s = await student(t, "nadia@t");
    await as(t, s).mutation(api.profiles.upsertMine, { ...nadia, countries: ["GB"], settings: ["countryside"] });
    const r = await as(t, s).query(api.discovery.forMe, {});
    if (r.needsProfile) throw new Error("profile expected");
    expect(r.results.map((x) => x.id)).toEqual([ids.lancasterCs]);
    expect(r.unclassifiedExcluded).toBe(1);
    await as(t, s).mutation(api.profiles.upsertMine, { ...nadia, countries: [] });
    const none = await as(t, s).query(api.discovery.forMe, {});
    expect(none).toMatchObject({ needsCountry: true, results: [] });
  });

  test("students only; a student without a profile is asked to fill it in", async () => {
    const t = setup();
    await expect(t.query(api.discovery.forMe, {})).rejects.toThrow(/Sign in required/);
    const s = await student(t, "new@t");
    expect(await as(t, s).query(api.discovery.forMe, {})).toEqual({ needsProfile: true });
  });
});
