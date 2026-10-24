import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, primaryDeadline, type PlanMilestone } from "../../convex/lib/plan.ts";

const ms = (dateStart: string, category: string, scholarship = false): PlanMilestone => ({ id: `${dateStart}:${category}`, dateStart, category, scholarship, sourceId: "s", timezone: null });
const today = "2026-10-24";
const base = { programName: "Computer Science BSc", institutionName: "Lancaster University", applyVia: "UCAS" as const, today };

test("the main deadline is the earliest upcoming standard round; past, scholarship and reply dates are skipped", () => {
  const m = [ms("2026-01-14", "equal consideration"), ms("2027-04-23", "scholarship", true), ms("2027-06-30", "deadline"), ms("2027-01-13", "equal consideration"), ms("2027-07-21", "reply deadline")];
  assert.equal(primaryDeadline(m, today)?.dateStart, "2027-01-13");
  assert.equal(primaryDeadline([ms("2026-01-14", "deadline")], today), null);
});

test("English chain is back-planned from the deadline with labeled assumptions; official and recommended dates are distinct", () => {
  const plan = buildPlan({ ...base, milestones: [ms("2027-01-13", "equal consideration")],
    requirements: [{ type: "language", scale: "ielts", threshold: "6", text: "IELTS 6", sourceId: "r" }],
    language: [{ test: "ielts_academic", status: "not_taken" }] });
  const by = Object.fromEntries(plan.map((t) => [t.key, t]));
  assert.deepEqual([by.submit!.dueType, by.submit!.dueAt], ["official", "2027-01-13"]);
  // 13 Jan − 7 buffer − 14 delivery = 23 Dec; − 14 results = 9 Dec; − 28 retake = 11 Nov (test); − 42 booking = 30 Sep
  assert.deepEqual(["english_send", "english_results", "english_test", "english_book"].map((k) => by[k]!.dueAt), ["2026-12-23", "2026-12-09", "2026-11-11", "2026-09-30"]);
  assert.ok(plan.filter((t) => t.key.startsWith("english")).every((t) => t.dueType === "recommended"));
  assert.ok(by.english_book!.assumptions.some((a) => a.startsWith("Planning assumption")));
  assert.ok(by.english_book!.assumptions.some((a) => /No separate official score deadline/.test(a)));
  assert.equal(by.grade_confirmation!.dueAt, null);
});

test("a score that already meets the minimum only needs sending; a lower score plans a retake", () => {
  const req = [{ type: "language", scale: "ielts", threshold: "6.5", text: "IELTS 6.5", sourceId: "r" }];
  const met = buildPlan({ ...base, milestones: [ms("2027-01-13", "equal consideration")], requirements: req, language: [{ test: "ielts_academic", status: "taken", score: 7 }] });
  assert.deepEqual(met.map((t) => t.key), ["submit", "english_send", "grade_confirmation"]);
  const low = buildPlan({ ...base, milestones: [ms("2027-01-13", "equal consideration")], requirements: req, language: [{ test: "ielts_academic", status: "taken", score: 6 }] });
  const retake = low.find((t) => t.key === "english_retake")!;
  assert.match(retake.title, /Retake IELTS \(your 6 is below 6.5\)/);
  assert.deepEqual(retake.params, { test: "IELTS", min: 6.5, institution: "Lancaster University", score: 6 });
});

test("without a verified deadline no date is invented", () => {
  const plan = buildPlan({ ...base, milestones: [], requirements: [{ type: "language", scale: "ielts", threshold: "6", text: "IELTS 6", sourceId: "r" }], language: [] });
  assert.equal(plan[0]!.key, "find_deadline");
  assert.ok(plan.every((t) => t.dueAt === null && t.dueType !== "official"));
});
