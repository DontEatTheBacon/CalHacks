// Deadline risk (engineering-detail 7.4). Date-only deadlines never get an invented time.
import planning from "../../../config/planning.json" with { type: "json" };
import type { RiskBand } from "./types.ts";

export interface OfficialDeadline {
  date: string;              // YYYY-MM-DD as published
  timezone: string | null;   // IANA name as published, or null if unknown
}

/** Calendar date (YYYY-MM-DD) of `now` in a timezone. */
export function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const dayNumber = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;

/**
 * Whole days left before the deadline date ends, in the published timezone.
 * Unknown timezone: use the earliest timezone on Earth (UTC+14) so we never call a closed deadline open.
 */
export function daysAvailable(deadline: OfficialDeadline, now: Date): number {
  const tz = deadline.timezone ?? "Etc/GMT-14";
  return dayNumber(deadline.date) - dayNumber(localDate(now, tz));
}

export function deadlineRisk(deadline: OfficialDeadline | null, remainingLeadDays: number, now: Date, cfg = planning): RiskBand {
  if (!deadline) return "unknown";
  const available = daysAvailable(deadline, now);
  if (available < 0) return "closed";
  const needed = remainingLeadDays + cfg.safetyBufferDays;
  if (available >= needed * cfg.risk.onTrackFactor) return "on_track";
  if (available >= needed) return "tight";
  return "at_risk";
}

/** Recommended target dates, counted back from an official date. Labeled as planning assumptions in the UI. */
export function backPlan(officialDate: string, stepsLatestFirst: { key: string; leadDays: number }[]): { key: string; recommendedBy: string }[] {
  let cursor = dayNumber(officialDate) - planning.safetyBufferDays;
  return stepsLatestFirst.map((s) => {
    cursor -= s.leadDays;
    return { key: s.key, recommendedBy: new Date(cursor * 86_400_000).toISOString().slice(0, 10) };
  });
}
