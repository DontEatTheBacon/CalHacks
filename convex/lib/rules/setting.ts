import config from "../../../config/setting.json" with { type: "json" };
import type { SettingClass } from "./types.ts";

export interface SettingEvidence {
  campusId: string;
  settlement: string | null;
  population: number | null;
  distanceKm: number | null;
}

export interface SettingResult {
  setting: SettingClass;
  reason: string;
  configVersion: string;
}

type Override = { campusId: string; setting: SettingClass; reason: string; sourceUrl: string };

/** Classifies a teaching campus by nearest-settlement population against config thresholds. */
export function classifySetting(e: SettingEvidence, cfg = config): SettingResult {
  const v = cfg.version;
  const override = (cfg.overrides as Override[]).find((o) => o.campusId === e.campusId);
  if (override) return { setting: override.setting, reason: `override: ${override.reason}`, configVersion: v };
  if (e.population == null || e.distanceKm == null || e.distanceKm > cfg.settlementSearchRadiusKm) {
    return { setting: "unclassified", reason: "no settlement within radius", configVersion: v };
  }
  if (e.population >= cfg.cityMinPopulation) return { setting: "city", reason: `${e.settlement} population ${e.population}`, configVersion: v };
  if (e.population <= cfg.countrysideMaxPopulation) return { setting: "countryside", reason: `${e.settlement} population ${e.population}`, configVersion: v };
  return { setting: cfg.betweenThresholds as SettingClass, reason: `${e.settlement} population ${e.population} is between thresholds`, configVersion: v };
}
