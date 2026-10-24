"use client";

// Discovery (spec screen 2). Functional build; visual design comes from Figma later.
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import { BandChips, money } from "@/components/Bands";
import { discoverStrings } from "@/lib/discoverStrings";
import { useLocale } from "@/lib/useLocale";

export default function DiscoverPage() {
  const [locale, setLocale] = useLocale();
  const s = discoverStrings(locale);
  const data = useQuery(api.discovery.forMe);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{s.title}</h1>
          <p className="mt-1 text-sm text-stone-600">{s.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
          <button className="underline" onClick={() => setLocale(locale === "id" ? "en" : "id")}>{locale === "id" ? "English" : "Bahasa Indonesia"}</button>
          <Link href="/intake" className="text-emerald-800 underline">{s.editProfile}</Link>
          <Link href="/" className="underline">Dashboard</Link>
        </div>
      </header>

      {data === undefined && <p>…</p>}
      {data?.needsProfile && (
        <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">{s.needsProfile} <Link href="/intake" className="underline">{s.startIntake}</Link></p>
      )}
      {data && !data.needsProfile && (
        <>
          {data.needsCountry && <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">{s.needsCountry} <Link href="/intake" className="underline">{s.editProfile}</Link></p>}
          {!data.needsCountry && (
            <div className="flex flex-wrap justify-between gap-2 text-xs text-stone-600">
              <span>{s.count(data.results.length, data.total)}</span>
              {data.rates.date && <span>{s.rate(data.rates.date, data.rates.source)}</span>}
            </div>
          )}
          {data.unclassifiedExcluded > 0 && <p className="text-sm text-stone-700">{s.unclassified(data.unclassifiedExcluded)}</p>}
          {!data.needsCountry && data.results.length === 0 && <p className="text-sm">{s.none}</p>}
          <ol className="flex flex-col gap-3">
            {data.results.map((r, i) => {
              const tuition = r.costs.filter((c) => c.kind === "tuition");
              return (
                <li key={r.id} className="rounded border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-semibold">
                      <span className="mr-2 text-stone-400">{i + 1}.</span>
                      <Link href={`/programs/${r.id}`} className="hover:underline">{r.name}</Link>
                      {r.joint && <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs font-normal">{s.joint}</span>}
                    </h2>
                    <span className="text-sm text-stone-600">{r.institution.name} · {r.country === "GB" ? "UK" : "US"}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600">
                    {r.campus.name} · {s.setting[r.setting as keyof typeof s.setting]}
                    {r.campus.climate?.class ? ` · ${s.climate[r.campus.climate.class as keyof typeof s.climate]}` : ""}
                  </p>
                  <div className="mt-2"><BandChips bands={r.bands} s={s} /></div>
                  <div className="mt-2 text-sm">
                    {tuition.length ? tuition.map((c, k) => (
                      <p key={k}>
                        {s.tuition}: {money(c.amount, c.currency, locale)}{c.period === "annual" ? s.perYear : ""}
                        {data.budget && c.currency !== data.budget.currency && (
                          <span className="text-stone-600"> ({c.converted != null ? `${s.approx} ${money(c.converted, data.budget.currency, locale)}` : s.conversionUnavailable})</span>
                        )}
                        {c.academicYear ? <span className="text-stone-500"> · {c.academicYear}</span> : null}
                      </p>
                    )) : null}
                    {r.cost?.missing.length ? (
                      <p className="text-stone-600">{s.missing} {r.cost.missing.map((m) => s.missingItems[m] ?? m).join(", ")}</p>
                    ) : null}
                  </div>
                  <div className="mt-2 flex gap-4 text-sm">
                    <Link href={`/programs/${r.id}`} className="text-emerald-800 underline">{s.details}</Link>
                    {r.officialUrl && <a href={r.officialUrl} target="_blank" rel="noopener noreferrer" className="underline">{s.official} ↗</a>}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </main>
  );
}
