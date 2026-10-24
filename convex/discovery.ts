// Discovery (spec 5.2, 5.3): hard filters on country and setting, then lexicographic ranking by
// major relevance → academic status → budget fit → climate fit. No match percentage. Unknown
// values stay unknown and never rank as "below" or "over".
import { query } from "./_generated/server";
import { assemble } from "./catalog";
import { latestRates } from "./fx";
import { requireStudent } from "./lib/access";
import { applyHardFilters, budgetFit, climateFit, compareGrades, majorRelevance, rank, type Bands, type ClimateClass, type CostItem } from "./lib/rules/index.ts";

export const forMe = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    const profile = await ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (!profile) return { needsProfile: true as const };
    const qualification = (await ctx.db.query("qualificationRecords").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(1))[0] ?? null;
    const subjects = qualification ? await ctx.db.query("subjectGrades").withIndex("by_qualification", (q) => q.eq("qualificationId", qualification._id)).collect() : [];
    const fx = await latestRates(ctx);
    const budget = profile.budgetAmount !== undefined && profile.budgetCurrency
      ? { amount: profile.budgetAmount, currency: profile.budgetCurrency, period: profile.budgetPeriod ?? "annual", scope: profile.budgetScope ?? "all_in" } as const
      : null;
    const pref: ClimateClass | "none" = profile.climate && ["warm", "mild", "cool", "cold"].includes(profile.climate) ? (profile.climate as ClimateClass) : "none";

    const programs = await Promise.all((await ctx.db.query("programs").collect()).map((p) => assemble(ctx, p)));
    const items = await Promise.all(programs.map(async (p) => {
      const campusDoc = (await ctx.db.query("campuses").withIndex("by_institution", (q) => q.eq("institutionId", p.institution.id)).collect())[0] ?? null;
      const env = (campusDoc?.settingEvidence ?? null) as null | { name: string; population: number; dataset: string; reason: string; climate: null | { class: ClimateClass | null; annualMeanC: number; coldestMonthMeanC: number; period: string; source: string } };
      let major = majorRelevance(p.major, profile.majors);
      if (major === "related" && profile.relatedOk === false) major = "other";
      // No validated Indonesian grade rule is published yet, so this is "needs confirmation" by design.
      const grade = compareGrades({
        qualification: qualification?.qualificationType ?? "SMA", scaleMin: qualification?.scaleMin ?? 0, scaleMax: qualification?.scaleMax ?? 100,
        overall: qualification?.reportedOverall ?? null, subjects: Object.fromEntries(subjects.map((s) => [s.subject, s.grade])), intakeYear: profile.intakeYear ?? 0,
      }, []);
      const costItems: CostItem[] = p.costs.filter((c) => c.amount != null && c.currency).map((c) => ({
        kind: c.kind === "tuition" ? "tuition" : c.kind === "fee" ? "fee" : "living",
        amount: c.amount!, currency: c.currency!, period: c.period, applicantCategory: "international",
      }));
      const cost = budget ? budgetFit(costItems, budget, null, fx.rates) : null;
      const bands: Bands = {
        major, academic: grade.outcome, budget: cost?.band ?? "unknown",
        climate: climateFit(pref, env?.climate?.class ?? null),
      };
      const convert = (amount: number, from: string) => budget && fx.rates[from] && fx.rates[budget.currency] ? Math.round((amount / fx.rates[from]!) * fx.rates[budget.currency]!) : null;
      return {
        id: p.id, name: p.name, degree: p.degree, joint: p.joint, major: p.major, officialUrl: p.officialUrl,
        institution: p.institution, country: p.institution.country, setting: (campusDoc?.settingClass ?? "unclassified"),
        campus: { name: campusDoc?.name ?? null, settlement: env?.name ?? null, population: env?.population ?? null, settingReason: env?.reason ?? null, climate: env?.climate ?? null },
        bands, gradeReason: grade.reason,
        cost: cost ? { annualKnown: cost.annualKnown, complete: cost.complete, gap: cost.gap, missing: cost.missing } : null,
        costs: p.costs.map((c) => ({ ...c, converted: c.amount != null && c.currency ? convert(c.amount, c.currency) : null })),
        requirements: p.requirements, milestones: p.milestones, unknowns: p.unknowns,
        name_: p.name, annualKnownCost: cost?.annualKnown ?? null,
      };
    }));
    const filtered = applyHardFilters(items, profile.countries, profile.settings);
    const ranked = rank(filtered.results.map((i) => ({ ...i, name: i.name_ })));
    return {
      needsProfile: false as const,
      needsCountry: filtered.needsCountry,
      unclassifiedExcluded: filtered.unclassifiedExcluded,
      total: items.length,
      budget,
      rates: { date: fx.rateDate, source: fx.source },
      results: ranked.map(({ name_: _n, annualKnownCost: _a, ...r }) => r),
    };
  },
});
