// Shared types for Langkah's deterministic rules. No I/O, no AI.
export type Country = "US" | "GB";
export type SettingClass = "city" | "countryside" | "unclassified";
export type MajorBand = "direct" | "related" | "other" | "unknown";
export type AcademicBand = "meets" | "needs_confirmation" | "subject_gap" | "below";
export type BudgetBand = "within" | "within_incomplete" | "unknown" | "slightly_over" | "over";
export type ClimateClass = "warm" | "mild" | "cool" | "cold";
export type ClimateBand = "match" | "partial" | "unknown" | "mismatch";
export type RiskBand = "on_track" | "tight" | "at_risk" | "closed" | "unknown";

export interface Bands {
  major: MajorBand;
  academic: AcademicBand;
  budget: BudgetBand;
  climate: ClimateBand;
}
