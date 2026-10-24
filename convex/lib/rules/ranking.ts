// Hard filters and lexicographic ranking (spec 5.2, 5.3). No weights, no match percentage.
import config from "../../../config/ranking.json" with { type: "json" };
import type { Bands, Country, SettingClass } from "./types.ts";

export interface Candidate {
  id: string;
  name: string;
  country: Country;
  setting: SettingClass;
  bands: Bands;
  annualKnownCost: number | null; // in the student's budget currency
}

export interface FilterResult<T> {
  results: T[];
  needsCountry: boolean;            // no country chosen: show a prompt, never "both"
  unclassifiedExcluded: number;     // shown as "N need classification"
}

export function applyHardFilters<T extends Pick<Candidate, "country" | "setting">>(
  items: T[], countries: Country[], settings: ("city" | "countryside")[],
): FilterResult<T> {
  if (countries.length === 0) return { results: [], needsCountry: true, unclassifiedExcluded: 0 };
  let results = items.filter((i) => countries.includes(i.country));
  let unclassifiedExcluded = 0;
  if (settings.length > 0) {
    unclassifiedExcluded = results.filter((i) => i.setting === "unclassified").length;
    results = results.filter((i) => i.setting !== "unclassified" && settings.includes(i.setting));
  }
  return { results, needsCountry: false, unclassifiedExcluded };
}

const keys = config.keys as (keyof Bands)[];
const outcomes = config.outcomes as Record<keyof Bands, string[]>;

export function compareCandidates(a: Candidate, b: Candidate): number {
  for (const k of keys) {
    const d = outcomes[k].indexOf(a.bands[k]) - outcomes[k].indexOf(b.bands[k]);
    if (d !== 0) return d;
  }
  const ca = a.annualKnownCost ?? Infinity, cb = b.annualKnownCost ?? Infinity;
  if (ca !== cb) return ca - cb;
  return a.name.localeCompare(b.name);
}

export function rank<T extends Candidate>(items: T[]): T[] {
  return [...items].sort(compareCandidates);
}
