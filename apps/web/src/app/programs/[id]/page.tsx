"use client";

// Program details (spec screen 3) with the evidence behind every fact (spec 12.6).
import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { money } from "@/components/Bands";
import { SaveButton } from "@/components/SaveButton";
import { appStrings } from "@/lib/appStrings";
import { discoverStrings, type DiscoverStrings } from "@/lib/discoverStrings";
import { useLocale } from "@/lib/useLocale";

type Sourced = { excerpt: string | null; sourceUrl: string | null; retrievedAt: number | null; fetchMethod: string | null; scope?: string | undefined };

function Source({ f, s, locale }: { f: Sourced; s: DiscoverStrings; locale: string }) {
  if (!f.sourceUrl) return null;
  const date = f.retrievedAt ? new Date(f.retrievedAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <div className="mt-1 text-xs text-stone-600">
      {f.excerpt && <blockquote className="border-l-2 border-stone-300 pl-2 italic">“{f.excerpt.slice(0, 300)}”</blockquote>}
      <p className="mt-0.5">
        {s.source}: <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{new URL(f.sourceUrl).hostname}</a>
        {date && ` · ${s.retrieved} ${date}`}{f.fetchMethod ? ` · ${s.via[f.fetchMethod] ?? f.fetchMethod}` : ""}
        {f.scope ? ` · ${f.scope === "institution" ? s.scopeInstitution : s.scopeProgram}` : ""}
      </p>
    </div>
  );
}

export default function ProgramPage() {
  const { id } = useParams<{ id: string }>();
  const [locale, setLocale] = useLocale();
  const s = discoverStrings(locale);
  const p = useQuery(api.catalog.getProgram, { id: id as Id<"programs"> });
  if (p === undefined) return <main className="p-6">…</main>;
  if (p === null) return <main className="p-6">Not found. <Link href="/discover" className="underline">{s.back}</Link></main>;
  const env = p.campusEvidence as null | { name: string; population: number; dataset: string; reason: string; climate: null | { class: string; annualMeanC: number; coldestMonthMeanC: number; period: string; source: string } };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex justify-between text-sm">
        <Link href="/discover" className="underline">{s.back}</Link>
        <button className="underline" onClick={() => setLocale(locale === "id" ? "en" : "id")}>{locale === "id" ? "English" : "Bahasa Indonesia"}</button>
      </div>
      <header>
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <p className="text-stone-600">{p.institution.name} · {p.degree}{p.joint ? ` · ${s.joint}` : ""}</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <SaveButton programId={p.id} s={appStrings(locale)} goToPlan />
          {p.officialUrl && <a href={p.officialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-800 underline">{s.official} ↗</a>}
        </div>
        {p.programSource && <Source f={p.programSource} s={s} locale={locale} />}
      </header>

      <section className="rounded border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{s.campus}</h2>
        <p>{p.campus?.name} · {s.setting[(p.campus?.settingClass ?? "unclassified") as keyof typeof s.setting]}</p>
        {env && <p className="text-xs text-stone-600">{s.settingFrom}: {env.name}, {s.population} {env.population.toLocaleString(locale === "id" ? "id-ID" : "en-GB")} ({env.dataset}, CC BY 4.0)</p>}
        {env?.climate && <p className="text-xs text-stone-600">{s.climateFrom}: {s.climate[env.climate.class as keyof typeof s.climate]} · {env.climate.annualMeanC}°C / {env.climate.coldestMonthMeanC}°C ({env.climate.period}, {env.climate.source})</p>}
      </section>

      <section className="rounded border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{s.costs}</h2>
        {p.costs.length === 0 && <p className="text-stone-600">{s.empty}</p>}
        <ul className="flex flex-col gap-3">
          {p.costs.map((c, i) => (
            <li key={i}>
              <p className="font-medium">{c.label ?? c.kind}: {money(c.amount, c.currency, locale)}{c.period === "annual" ? s.perYear : ""}{c.academicYear ? ` · ${c.academicYear}` : ""}</p>
              <Source f={c} s={s} locale={locale} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
        <h2 className="font-semibold">{s.gradeTitle}: {s.gradeNeeds}</h2>
        <p className="mt-1">{s.gradeBody}</p>
      </section>

      <section className="rounded border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{s.requirements}</h2>
        {p.requirements.length === 0 && <p className="text-stone-600">{s.empty}</p>}
        <ul className="flex flex-col gap-3">
          {p.requirements.map((r, i) => (<li key={i}><p className="font-medium">{r.text}</p><Source f={r} s={s} locale={locale} /></li>))}
        </ul>
      </section>

      <section className="rounded border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{s.deadlines}</h2>
        {p.milestones.length === 0 && <p className="text-stone-600">{s.empty}</p>}
        <ul className="flex flex-col gap-3">
          {[...p.milestones].sort((a, b) => (a.dateStart ?? "").localeCompare(b.dateStart ?? "")).map((m, i) => (
            <li key={i}>
              <p className="font-medium">
                {m.dateStart ?? "—"}{m.cutoffTime ? ` ${m.cutoffTime}` : ""}{m.timezone ? ` ${m.timezone}` : ""}
                {m.scholarship ? ` · ${s.scholarship}` : ""}
              </p>
              <Source f={m} s={s} locale={locale} />
            </li>
          ))}
        </ul>
      </section>

      {p.unknowns.length > 0 && (
        <section className="rounded border border-dashed border-stone-400 p-4 text-sm">
          <h2 className="mb-1 font-semibold">{s.unknowns}</h2>
          <ul className="list-disc pl-5">{p.unknowns.map((u) => <li key={u}>{s.unknownNames[u] ?? u}</li>)}</ul>
        </section>
      )}
    </main>
  );
}
