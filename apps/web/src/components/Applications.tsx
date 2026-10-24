"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import { appStrings, taskTitle, type AppStrings } from "@/lib/appStrings";
import { useLocale } from "@/lib/useLocale";

export const riskStyle: Record<string, string> = {
  on_track: "bg-emerald-100 text-emerald-900", tight: "bg-amber-100 text-amber-900", at_risk: "bg-red-100 text-red-900",
  closed: "bg-stone-200 text-stone-800", unknown: "border border-dashed border-stone-400 text-stone-700",
};

/** Official dates are solid and bold; recommended dates are dashed and labeled as planning assumptions. */
export function DueDate({ dueType, dueAt, studentDate, s }: { dueType: string; dueAt: string | null; studentDate?: string | null; s: AppStrings }) {
  if (studentDate) return <span className="rounded bg-sky-100 px-1.5 text-sky-900">{studentDate} · {s.dueType.student}</span>;
  if (!dueAt) return <span className="text-stone-500">{s.dueType.none}</span>;
  const passed = dueAt < new Date().toISOString().slice(0, 10);
  return dueType === "official"
    ? <span className="rounded border border-stone-800 px-1.5 font-semibold">{dueAt} · {s.dueType.official}</span>
    : <span className="rounded border border-dashed border-stone-400 px-1.5 text-stone-700">{dueAt} · {s.dueType.recommended}{passed ? ` · ${s.recommendedPassed}` : ""}</span>;
}

export function DashboardApplications() {
  const [locale] = useLocale();
  const s = appStrings(locale);
  const data = useQuery(api.applications.listMine);
  if (!data) return null;
  return (
    <>
      <section className="rounded border border-stone-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">{s.nextSteps}</h2>
        {data.nextActions.length === 0 && <p className="text-sm text-stone-600">{s.noSteps}</p>}
        <ul className="flex flex-col gap-2 text-sm">
          {data.nextActions.slice(0, 8).map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2">
              <DueDate dueType={t.dueType} dueAt={t.dueAt} studentDate={t.studentDate} s={s} />
              <Link href={`/applications/${t.applicationId}`} className="hover:underline">{taskTitle(t, locale)}</Link>
              {t.status === "overdue" && <span className="rounded bg-red-100 px-1.5 text-xs text-red-900">{s.status.overdue}</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded border border-stone-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">{s.savedPrograms}</h2>
        {data.applications.length === 0 && <p className="text-sm text-stone-600">{s.noSaved}</p>}
        <ul className="flex flex-col gap-3 text-sm">
          {data.applications.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/applications/${a.id}`} className="font-medium hover:underline">{a.program?.name}</Link>
                <span className="text-stone-600"> · {a.institution?.name}</span>
                <p className="text-xs text-stone-600">{a.deadline ? `${s.deadline}: ${a.deadline}` : s.noDeadline}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${riskStyle[a.risk] ?? ""}`}>{s.risk[a.risk] ?? a.risk}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
