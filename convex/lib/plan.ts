// Personalized application plan (spec TIME-001, TIME-004, TIME-008; engineering-detail 7.2–7.4).
// Pure function: verified program facts + student evidence → tasks. Official dates come only from
// verified milestones; recommended dates are back-planned with config lead times and always carry
// their assumptions. Steps without a source are not added.
import planning from "../../config/planning.json" with { type: "json" };
import { backPlan } from "./rules/deadline.ts";

export type PlanMilestone = { id: string; dateStart: string | null; category: string; scholarship: boolean; sourceId: string | null; timezone: string | null };
export type PlanRequirement = { type: string; scale: string | null; threshold: string | null; text: string; sourceId: string | null };
export type PlanLanguage = { test: string; status: "taken" | "not_taken" | "unknown"; score?: number };

export type PlannedTask = {
  key: string;
  title: string;
  params: Record<string, string | number>;
  owner: "student" | "school" | "university";
  dueType: "official" | "recommended" | "none";
  dueAt: string | null;
  milestoneId: string | null;
  sourceId: string | null;
  assumptions: string[];
};

const TEST_NAME: Record<string, string> = { ielts: "IELTS", toefl_ibt: "TOEFL iBT", duolingo: "Duolingo English Test" };
const TEST_KEY: Record<string, string> = { ielts: "ielts_academic", toefl_ibt: "toefl_ibt", duolingo: "duolingo" };
const ROUND_PRIORITY = [/equal consideration/i, /regular decision/i, /early action/i, /deadline/i];

/** The main application deadline: earliest upcoming verified non-scholarship deadline, preferring standard rounds. */
export function primaryDeadline(milestones: PlanMilestone[], today: string): PlanMilestone | null {
  const upcoming = milestones.filter((m) => !m.scholarship && m.dateStart && m.dateStart >= today && !/reply|decide|decision by universities/i.test(m.category));
  for (const re of ROUND_PRIORITY) {
    const hit = upcoming.filter((m) => re.test(m.category)).sort((a, b) => a.dateStart!.localeCompare(b.dateStart!))[0];
    if (hit) return hit;
  }
  return upcoming.sort((a, b) => a.dateStart!.localeCompare(b.dateStart!))[0] ?? null;
}

export function buildPlan(input: {
  programName: string; institutionName: string; applyVia: "UCAS" | "university or shared portal";
  milestones: PlanMilestone[]; requirements: PlanRequirement[]; language: PlanLanguage[]; today: string;
}): PlannedTask[] {
  const tasks: PlannedTask[] = [];
  const deadline = primaryDeadline(input.milestones, input.today);
  const lead = planning.leadDays;
  const assumption = (what: string, days: number) => `Planning assumption: ${what} about ${days} days (config/planning.json), not an official date.`;

  if (deadline) {
    tasks.push({
      key: "submit", title: `Submit your application to ${input.institutionName} via ${input.applyVia}`, params: { institution: input.institutionName, via: input.applyVia }, owner: "student",
      dueType: "official", dueAt: deadline.dateStart, milestoneId: deadline.id, sourceId: deadline.sourceId,
      assumptions: deadline.timezone ? [] : ["The deadline is published as a date only; no cutoff time is assumed."],
    });
  } else {
    tasks.push({
      key: "find_deadline", title: `Find the official application deadline for ${input.programName}`, params: { program: input.programName }, owner: "student",
      dueType: "none", dueAt: null, milestoneId: null, sourceId: null, assumptions: ["No verified deadline is published in our records yet."],
    });
  }

  // English: one chain for the first verified test minimum (IELTS preferred), only if not yet met.
  const english = ["ielts", "toefl_ibt", "duolingo"].map((t) => input.requirements.find((r) => r.type === "language" && r.scale === t)).find(Boolean);
  if (english && english.scale) {
    const name = TEST_NAME[english.scale] ?? english.scale;
    const min = Number(english.threshold);
    const own = input.language.find((l) => l.test === TEST_KEY[english.scale!]);
    const met = own?.status === "taken" && own.score !== undefined && own.score >= min;
    const noReceipt = "No separate official score deadline is published, so the plan uses the application deadline.";
    if (met) {
      tasks.push({ key: "english_send", title: `Send your official ${name} score (${own!.score}) to ${input.institutionName}`, params: { test: name, score: own!.score!, institution: input.institutionName }, owner: "student",
        dueType: deadline ? "recommended" : "none", dueAt: deadline ? backPlan(deadline.dateStart!, [{ key: "send", leadDays: lead.officialScoreDelivery }])[0]!.recommendedBy : null,
        milestoneId: null, sourceId: english.sourceId, assumptions: [assumption("official score delivery takes", lead.officialScoreDelivery), noReceipt] });
    } else {
      const retake = own?.status === "taken";
      const steps = [
        { key: "english_send", leadDays: lead.officialScoreDelivery },
        { key: "english_results", leadDays: lead.englishResults },
        ...(retake ? [] : [{ key: "english_retake_buffer", leadDays: lead.englishRetakeBuffer }]),
        { key: "english_test", leadDays: 0 },
        { key: "english_book", leadDays: lead.englishTestBooking },
      ];
      const dates = deadline ? Object.fromEntries(backPlan(deadline.dateStart!, steps).map((d) => [d.key, d.recommendedBy])) : {};
      const base = [noReceipt, `Minimum required: ${english.text}.`];
      const titles: Record<string, string> = {
        english_book: `Book your ${name} test`, english_test: retake ? `Retake ${name} (your ${own!.score} is below ${min})` : `Take ${name} (minimum ${min})`,
        english_results: `${name} results available`, english_send: `Send your official ${name} score to ${input.institutionName}`,
      };
      for (const key of ["english_book", "english_test", "english_results", "english_send"]) {
        tasks.push({
          key: retake && key === "english_test" ? "english_retake" : key, title: titles[key]!,
          params: { test: name, min, institution: input.institutionName, ...(retake ? { score: own!.score! } : {}) },
          owner: key === "english_results" ? "university" : "student",
          dueType: deadline ? "recommended" : "none", dueAt: dates[key] ?? null, milestoneId: null, sourceId: english.sourceId,
          assumptions: key === "english_book" ? [...base, assumption("booking ahead takes", lead.englishTestBooking), ...(retake ? [] : [assumption("a possible retake needs", lead.englishRetakeBuffer)])]
            : key === "english_results" ? [assumption("results take", lead.englishResults)]
            : key === "english_send" ? [assumption("official score delivery takes", lead.officialScoreDelivery)] : [],
        });
      }
    }
  }

  tasks.push({
    key: "grade_confirmation", title: `Confirm how ${input.institutionName} assesses Indonesian SMA grades`, params: { institution: input.institutionName }, owner: "student",
    dueType: "none", dueAt: null, milestoneId: null, sourceId: null,
    assumptions: ["No verified Indonesian grade rule is published in our records; the app does not convert grades. A counselor can help."],
  });
  return tasks;
}
