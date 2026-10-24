// Comparable annual cost and budget band (engineering-detail 7.1).
import ranking from "../../../config/ranking.json" with { type: "json" };
import type { BudgetBand } from "./types.ts";

export interface CostItem {
  kind: "tuition" | "fee" | "living";
  amount: number;
  currency: string;
  period: "annual" | "term" | "total" | "unknown";
  termsPerYear?: number;            // only if the source states it
  applicantCategory: "international" | "domestic" | "unknown";
}

export interface Budget {
  amount: number;
  currency: string;
  period: "annual" | "total";
  scope: "tuition_only" | "all_in";
}

/** rates[CUR] = units of CUR per 1 unit of base; base is any common currency (Frankfurter style). */
export type Rates = Record<string, number>;

export interface CostResult {
  band: BudgetBand;
  annualKnown: number | null;       // in budget currency
  complete: boolean;
  gap: number | null;               // annualKnown - annual budget, when calculable
  missing: ("tuition" | "fee" | "living" | "duration" | "rate")[];
}

function annualize(i: CostItem, durationYears: number | null): number | null {
  if (i.period === "annual") return i.amount;
  if (i.period === "term") return i.termsPerYear ? i.amount * i.termsPerYear : null;
  if (i.period === "total") return durationYears ? i.amount / durationYears : null;
  return null;
}

function convert(amount: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return amount;
  const f = rates[from], t = rates[to];
  return f && t ? (amount / f) * t : null;
}

export function budgetFit(items: CostItem[], budget: Budget, durationYears: number | null, rates: Rates, slightlyOverPct = ranking.slightlyOverPct): CostResult {
  const usable = items.filter((i) => i.applicantCategory === "international"); // never assume domestic rates apply
  const kinds: CostItem["kind"][] = budget.scope === "all_in" ? ["tuition", "fee", "living"] : ["tuition", "fee"];
  const missing: CostResult["missing"] = [];
  let total = 0;
  let tuitionKnown = false;

  for (const kind of kinds) {
    const ofKind = usable.filter((i) => i.kind === kind);
    if (ofKind.length === 0) { missing.push(kind); continue; }
    for (const i of ofKind) {
      const a = annualize(i, durationYears);
      if (a == null) { missing.push(i.period === "total" ? "duration" : kind); continue; }
      const c = convert(a, i.currency, budget.currency, rates);
      if (c == null) return { band: "unknown", annualKnown: null, complete: false, gap: null, missing: [...missing, "rate"] };
      total += c;
      if (kind === "tuition") tuitionKnown = true;
    }
  }
  if (!tuitionKnown) return { band: "unknown", annualKnown: null, complete: false, gap: null, missing };

  let annualBudget = budget.amount;
  if (budget.period === "total") {
    if (!durationYears) return { band: "unknown", annualKnown: total, complete: false, gap: null, missing: [...missing, "duration"] };
    annualBudget = budget.amount / durationYears;
  }
  const complete = missing.length === 0;
  const gap = total - annualBudget;
  let band: BudgetBand;
  if (gap > 0) band = (gap / annualBudget) * 100 <= slightlyOverPct ? "slightly_over" : "over";
  else band = complete ? "within" : "within_incomplete";
  return { band, annualKnown: total, complete, gap, missing: [...new Set(missing)] };
}
