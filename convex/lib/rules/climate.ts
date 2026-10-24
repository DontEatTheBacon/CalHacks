import config from "../../../config/climate.json" with { type: "json" };
import type { ClimateBand, ClimateClass } from "./types.ts";

export interface ClimateNormals {
  annualMeanC: number;
  coldestMonthMeanC: number;
}

type Rule = {
  class: ClimateClass;
  annualMeanCAtLeast?: number;
  annualMeanCBelow?: number;
  orColdestMonthMeanCBelow?: number;
  coldestMonthMeanCAtLeast?: number;
  otherwise?: boolean;
};

export function classifyClimate(n: ClimateNormals | null): ClimateClass | null {
  if (!n) return null;
  for (const r of config.rules as Rule[]) {
    if (r.otherwise) return r.class;
    if (r.annualMeanCAtLeast !== undefined && n.annualMeanC >= r.annualMeanCAtLeast) return r.class;
    if (r.annualMeanCBelow !== undefined &&
        (n.annualMeanC < r.annualMeanCBelow || (r.orColdestMonthMeanCBelow !== undefined && n.coldestMonthMeanC < r.orColdestMonthMeanCBelow))) return r.class;
    if (r.coldestMonthMeanCAtLeast !== undefined && n.coldestMonthMeanC >= r.coldestMonthMeanCAtLeast) return r.class;
  }
  return null;
}

/** Same class = match, adjacent = partial, two or more apart = mismatch; no preference = match. */
export function climateFit(preference: ClimateClass | "none", campus: ClimateClass | null): ClimateBand {
  if (preference === "none") return "match";
  if (!campus) return "unknown";
  const order = config.order as ClimateClass[];
  const d = Math.abs(order.indexOf(preference) - order.indexOf(campus));
  return d === 0 ? "match" : d === 1 ? "partial" : "mismatch";
}
