import { test } from "node:test";
import assert from "node:assert/strict";
import { compareGrades, type GradeRule, type StudentQualification } from "../../convex/lib/rules/index.ts";

const nadia: StudentQualification = {
  qualification: "SMA", scaleMin: 0, scaleMax: 100, overall: 86,
  subjects: { Mathematics: 88, English: 84, Economics: 82 }, intakeYear: 2027,
};
const src = "https://example.ac.uk/indonesia"; // fixture

test("AS7 unsupported mapping: 86/100 vs a US 3.0/4.0 with no accepted mapping is Needs confirmation, raw values not compared", () => {
  const rules: GradeRule[] = [{ id: "r1", sourceUrl: src, qualification: "SMA", intakeYear: 2027, method: "no_conversion_published" }];
  const r = compareGrades(nadia, rules);
  assert.equal(r.outcome, "needs_confirmation");
  assert.equal(r.equivalent, null);
  assert.deepEqual(r.original, { value: 86, scale: { min: 0, max: 100 } });
  assert.equal(compareGrades(nadia, []).outcome, "needs_confirmation");
});

test("AS8 direct Indonesian requirement compares directly and cites the source", () => {
  const rules: GradeRule[] = [{ id: "r2", sourceUrl: src, qualification: "SMA", intakeYear: 2027, method: "direct", scale: { min: 0, max: 100 }, threshold: 80 }];
  const r = compareGrades(nadia, rules);
  assert.equal(r.outcome, "meets");
  assert.equal(r.method, "direct_indonesian_requirement");
  assert.equal(r.sourceUrl, src);
  assert.equal(r.equivalent, null, "direct comparisons show original and requirement only");
  assert.equal(compareGrades({ ...nadia, overall: 78 }, rules).outcome, "below");
});

test("direct rule on a different scale is not converted", () => {
  const rules: GradeRule[] = [{ id: "r3", sourceUrl: src, qualification: "SMA", intakeYear: 2027, method: "direct", scale: { min: 0, max: 10 }, threshold: 8 }];
  assert.equal(compareGrades(nadia, rules).outcome, "needs_confirmation");
});

test("rule for another qualification or intake is not used", () => {
  const base = { id: "r4", sourceUrl: src, method: "direct", scale: { min: 0, max: 100 }, threshold: 80 } as const;
  assert.equal(compareGrades(nadia, [{ ...base, qualification: "SMK", intakeYear: 2027 }]).outcome, "needs_confirmation");
  assert.equal(compareGrades(nadia, [{ ...base, qualification: "SMA", intakeYear: 2026 }]).outcome, "needs_confirmation");
});

test("AS10 subject gap is separate from the overall result", () => {
  const rules: GradeRule[] = [{ id: "r5", sourceUrl: src, qualification: "SMA", intakeYear: 2027, method: "direct", scale: { min: 0, max: 100 }, threshold: 80,
    subjects: [{ subject: "Mathematics", threshold: 90 }, { subject: "Physics", threshold: 80 }] }];
  const r = compareGrades(nadia, rules);
  assert.equal(r.outcome, "subject_gap");
  assert.deepEqual(r.subjectGaps.map((g) => g.subject), ["Mathematics", "Physics"]);
  assert.equal(r.subjectGaps[1]!.actual, null);
});

test("AS9 accepted equivalency uses only the institution's own table", () => {
  const rules: GradeRule[] = [{ id: "r6", sourceUrl: src, qualification: "SMA", intakeYear: 2027, method: "equivalency",
    studentScale: { min: 0, max: 100 }, bands: [{ fromMin: 90, equivalent: 3 }, { fromMin: 85, equivalent: 2 }, { fromMin: 80, equivalent: 1 }],
    destScale: { min: 0, max: 3 }, required: 2 }];
  const r = compareGrades(nadia, rules);
  assert.equal(r.outcome, "meets");
  assert.deepEqual(r.equivalent, { value: 2, scale: { min: 0, max: 3 } });
  assert.equal(compareGrades({ ...nadia, overall: 70 }, rules).outcome, "needs_confirmation", "outside the published table");
});
