// Indonesian grade comparison (spec 5.5). Never invents a conversion.
import type { AcademicBand } from "./types.ts";

export interface StudentQualification {
  qualification: string;            // e.g. "SMA", "SMK", "IB"
  scaleMin: number;
  scaleMax: number;
  overall: number | null;
  subjects: Record<string, number>; // same scale as overall
  intakeYear: number;
}

export interface Scale { min: number; max: number }

/** A published, validated GradeEquivalencyRule. */
export type GradeRule = {
  id: string;
  sourceUrl: string;
  qualification: string;
  intakeYear: number;
} & (
  | { method: "direct"; scale: Scale; threshold: number; subjects?: { subject: string; threshold: number }[] }
  | { method: "equivalency"; studentScale: Scale; bands: { fromMin: number; equivalent: number }[]; destScale: Scale; required: number; subjects?: { subject: string; threshold: number }[] }
  | { method: "no_conversion_published" }
);

export type ComparisonMethod = "direct_indonesian_requirement" | "accepted_equivalency" | "none";

export interface GradeResult {
  outcome: AcademicBand;
  method: ComparisonMethod;
  ruleId: string | null;
  sourceUrl: string | null;
  original: { value: number | null; scale: Scale };
  equivalent: { value: number; scale: Scale } | null;
  required: { value: number; scale: Scale } | null;
  subjectGaps: { subject: string; required: number; actual: number | null }[];
  reason: string;
}

const sameScale = (a: Scale, b: Scale) => a.min === b.min && a.max === b.max;
const norm = (q: string) => q.trim().toUpperCase();

export function compareGrades(student: StudentQualification, rules: GradeRule[]): GradeResult {
  const original = { value: student.overall, scale: { min: student.scaleMin, max: student.scaleMax } };
  const base = { ruleId: null, sourceUrl: null, original, equivalent: null, required: null, subjectGaps: [] };
  const confirm = (reason: string, rule?: GradeRule): GradeResult =>
    ({ ...base, outcome: "needs_confirmation", method: "none", ruleId: rule?.id ?? null, sourceUrl: rule?.sourceUrl ?? null, reason });

  const applicable = rules.filter((r) => norm(r.qualification) === norm(student.qualification));
  if (applicable.length === 0) return confirm("No published rule for this qualification.");
  const forIntake = applicable.filter((r) => r.intakeYear === student.intakeYear);
  if (forIntake.length === 0) return confirm(`Published rule is for a different intake year.`, applicable[0]);
  // Prefer a direct Indonesian requirement, then an accepted equivalency (spec GRADE-002 order).
  const rule = forIntake.find((r) => r.method === "direct") ?? forIntake.find((r) => r.method === "equivalency") ?? forIntake[0]!;
  if (rule.method === "no_conversion_published") return confirm("The university publishes no conversion for this qualification.", rule);
  if (student.overall == null) return confirm("Overall grade not provided.", rule);

  const subjectGaps = (reqs: { subject: string; threshold: number }[] = []) =>
    reqs.filter((s) => (student.subjects[s.subject] ?? -Infinity) < s.threshold)
        .map((s) => ({ subject: s.subject, required: s.threshold, actual: student.subjects[s.subject] ?? null }));

  if (rule.method === "direct") {
    if (!sameScale(rule.scale, original.scale)) return confirm("Your school's grading scale differs from the published one.", rule);
    const gaps = subjectGaps(rule.subjects);
    const meets = student.overall >= rule.threshold;
    return {
      ...base, method: "direct_indonesian_requirement", ruleId: rule.id, sourceUrl: rule.sourceUrl,
      required: { value: rule.threshold, scale: rule.scale }, subjectGaps: gaps,
      outcome: !meets ? "below" : gaps.length ? "subject_gap" : "meets",
      reason: "Compared directly with the published Indonesian requirement.",
    };
  }

  // Accepted equivalency published by the institution.
  if (!sameScale(rule.studentScale, original.scale)) return confirm("Your school's grading scale is not covered by the published equivalency.", rule);
  const band = [...rule.bands].sort((a, b) => b.fromMin - a.fromMin).find((b) => student.overall! >= b.fromMin);
  if (!band) return confirm("Your grade is outside the published equivalency table.", rule);
  const gaps = subjectGaps(rule.subjects);
  const meets = band.equivalent >= rule.required;
  return {
    ...base, method: "accepted_equivalency", ruleId: rule.id, sourceUrl: rule.sourceUrl,
    equivalent: { value: band.equivalent, scale: rule.destScale }, required: { value: rule.required, scale: rule.destScale },
    subjectGaps: gaps, outcome: !meets ? "below" : gaps.length ? "subject_gap" : "meets",
    reason: "Converted using the equivalency the university publishes.",
  };
}
