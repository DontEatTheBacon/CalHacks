// Exchange rates (spec 5.4): Frankfurter, which publishes European Central Bank reference rates.
// Conversions always carry the rate, its date and source; without a rate the app says
// "conversion unavailable" instead of estimating.
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const SOURCE = "Frankfurter (European Central Bank reference rates)";
const QUOTES = ["USD", "GBP", "IDR"];

export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${QUOTES.join(",")}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
    const data = (await res.json()) as { date: string; rates: Record<string, number> };
    await ctx.runMutation(internal.fx.store, { rateDate: data.date, rates: QUOTES.filter((q) => data.rates[q]).map((q) => ({ quote: q, rate: data.rates[q]! })) });
    return data;
  },
});

export const store = internalMutation({
  args: { rateDate: v.string(), rates: v.array(v.object({ quote: v.string(), rate: v.number() })) },
  handler: async (ctx, { rateDate, rates }) => {
    for (const r of rates) {
      const existing = (await ctx.db.query("fxRates").withIndex("by_pair", (q) => q.eq("base", "EUR").eq("quote", r.quote)).collect()).find((x) => x.rateDate === rateDate);
      if (!existing) await ctx.db.insert("fxRates", { base: "EUR", quote: r.quote, rate: r.rate, rateDate, source: SOURCE });
    }
  },
});

/** Latest rate per currency, EUR-based ("units per 1 EUR"), with its date. EUR itself is 1. */
export async function latestRates(ctx: { db: import("./_generated/server").QueryCtx["db"] }) {
  const rates: Record<string, number> = { EUR: 1 };
  const dates: string[] = [];
  for (const quote of QUOTES) {
    const rows = await ctx.db.query("fxRates").withIndex("by_pair", (q) => q.eq("base", "EUR").eq("quote", quote)).collect();
    const latest = rows.sort((a, b) => b.rateDate.localeCompare(a.rateDate))[0];
    if (latest) {
      rates[quote] = latest.rate;
      dates.push(latest.rateDate);
    }
  }
  // Report the oldest date used, so a conversion never claims to be fresher than it is.
  return { rates, rateDate: dates.sort()[0] ?? null, source: SOURCE };
}

export const latest = internalQuery({ args: {}, handler: (ctx) => latestRates(ctx) });
