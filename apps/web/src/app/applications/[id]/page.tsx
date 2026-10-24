"use client";

// Application workspace (spec screen 7): the student's plan for one saved program.
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { DueDate, riskStyle } from "@/components/Applications";
import { appStrings, taskTitle } from "@/lib/appStrings";
import { useLocale } from "@/lib/useLocale";

const STATUSES = ["not_started", "in_progress", "waiting_on_someone", "submitted", "confirmed_complete", "not_applicable"] as const;

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [locale, setLocale] = useLocale();
  const s = appStrings(locale);
  const app = useQuery(api.applications.get, { applicationId: id as Id<"studentApplications"> });
  const setStatus = useMutation(api.applications.setTaskStatus);
  const setDate = useMutation(api.applications.setStudentDate);
  const remove = useMutation(api.applications.remove);
  const [correction, setCorrection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (app === undefined) return <main className="p-6">…</main>;
  if (app === null) return <main className="p-6">Not found. <Link href="/" className="underline">{s.back}</Link></main>;
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).replace(/^[\s\S]*Uncaught Error: /, "").split("\n")[0]!;
      setError(/only move forward/.test(msg) ? s.forwardOnly : msg);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex justify-between text-sm">
        <Link href="/" className="underline">{s.back}</Link>
        <button className="underline" onClick={() => setLocale(locale === "id" ? "en" : "id")}>{locale === "id" ? "English" : "Bahasa Indonesia"}</button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{app.program?.name}</h1>
          <p className="text-stone-600">{app.institution?.name}</p>
          <p className="mt-1 text-sm">{app.deadline ? `${s.deadline}: ${app.deadline}` : s.noDeadline}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${riskStyle[app.risk] ?? ""}`}>{s.risk[app.risk] ?? app.risk}</span>
      </header>
      <p className="rounded bg-stone-100 p-3 text-sm">{s.applyNote} {app.program?.officialUrl && <a href={app.program.officialUrl} target="_blank" rel="noopener noreferrer" className="underline">↗</a>}</p>

      <section className="rounded border border-stone-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{s.plan}</h2>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={correction} onChange={(e) => setCorrection(e.target.checked)} />{s.correction}</label>
        </div>
        {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
        <ol className="flex flex-col gap-4">
          {app.tasks.map((t) => (
            <li key={t.id} className="border-l-2 border-stone-200 pl-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <DueDate dueType={t.dueType} dueAt={t.dueAt} studentDate={t.studentDate} s={s} />
                <span className="text-xs text-stone-500">{s.owner[t.owner] ?? t.owner}</span>
              </div>
              <p className="mt-1 font-medium">{taskTitle(t, locale)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <select aria-label={taskTitle(t, locale)} value={t.storedStatus} className="rounded border border-stone-300 px-2 py-1 text-xs"
                  onChange={(e) => run(() => setStatus({ taskId: t.id, status: e.target.value as (typeof STATUSES)[number], correction }))}>
                  {STATUSES.map((st) => <option key={st} value={st}>{s.status[st]}</option>)}
                </select>
                {t.status === "overdue" && <span className="rounded bg-red-100 px-1.5 text-xs text-red-900">{s.status.overdue}</span>}
                <label className="flex items-center gap-1 text-xs text-stone-600">{s.myDate}
                  <input type="date" value={t.studentDate ?? ""} className="rounded border border-stone-300 px-1 text-xs"
                    onChange={(e) => run(() => setDate({ taskId: t.id, date: e.target.value || null }))} />
                </label>
              </div>
              {t.assumptions.length > 0 && (
                <details className="mt-1 text-xs text-stone-600"><summary className="cursor-pointer">{s.why}</summary>
                  <ul className="list-disc pl-5">{t.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </details>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{s.officialDates}</h2>
        <ul className="flex flex-col gap-2">
          {app.milestones.map((m) => (
            <li key={m.id}>
              <span className="font-medium">{m.dateStart ?? "—"}{m.cutoffTime ? ` ${m.cutoffTime}` : ""}{m.timezone ? ` ${m.timezone}` : ""}</span>
              {m.scholarship && <span className="ml-2 rounded bg-stone-100 px-1.5 text-xs">{s.scholarship}</span>}
              {m.wording && <p className="text-xs italic text-stone-600">“{m.wording.slice(0, 200)}”</p>}
              {m.sourceUrl && <p className="text-xs text-stone-600">{s.source}: <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{new URL(m.sourceUrl).hostname}</a></p>}
            </li>
          ))}
        </ul>
      </section>

      <button className="self-start text-sm text-red-700 underline" onClick={() => run(async () => { await remove({ applicationId: app.id }); router.push("/"); })}>{s.remove}</button>
    </main>
  );
}
