"use client";

// Student intake (spec 5.1 PROF-001, screen 1). Four steps, each saved to Convex so the student
// can leave and resume. Every answer except destination country may be left unknown.
// Functional build; the visual design comes later from Figma.
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import taxonomy from "@config/taxonomy.json";
import { intakeStrings, type IntakeStrings } from "@/lib/intakeStrings";
import { useLocale } from "@/lib/useLocale";
import type { Locale } from "@/lib/strings";

type Country = "US" | "GB";
type Setting = "city" | "countryside";
type Climate = "warm" | "mild" | "cool" | "cold" | "no_preference" | "unknown";
type Term = "fall" | "spring" | "unknown";
type TestKey = "ielts_academic" | "toefl_ibt" | "duolingo" | "other";
type TestStatus = "taken" | "not_taken" | "unknown";

type Prefs = {
  majors: string[]; relatedOk: boolean; countries: Country[]; settings: Setting[];
  budgetKnown: boolean; budgetAmount: string; budgetCurrency: string; budgetPeriod: "annual" | "total"; budgetScope: "tuition_only" | "all_in";
  climate: Climate; intakeTerm: Term; intakeYear: string;
};
type School = {
  skip: boolean; qualificationType: string; curriculum: string; school: string; gradeLevel: string; year: string;
  scaleMin: string; scaleMax: string; overallKnown: boolean; overall: string; subjects: { subject: string; grade: string }[];
};
type Lang = Record<TestKey, { status: TestStatus; score: string; takenOn: string }>;

const THIS_YEAR = new Date().getFullYear();
const TESTS: TestKey[] = ["ielts_academic", "toefl_ibt", "duolingo", "other"];
const QUAL_TYPES = ["SMA", "SMK", "MA", "IB", "Cambridge", "Other"];
const CURRICULA = ["Kurikulum Merdeka", "Kurikulum 2013 (K13)", "IB Diploma", "Cambridge A Level", "Other"];
const DEFAULT_SUBJECTS = ["Matematika", "Bahasa Inggris"];

const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(/[.,\s](?=\d{3}(\D|$))/g, "").replace(",", ".")));
const label = (key: string, l: Locale) => (taxonomy.fields as Record<string, { label: Record<Locale, string> }>)[key]?.label[l] ?? key;

export default function IntakePage() {
  const [locale, setLocale] = useLocale();
  const s = intakeStrings(locale);
  const data = useQuery(api.profiles.intake);
  const [step, setStep] = useState(0);

  if (data === undefined) return <main className="p-6">…</main>;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{s.title}</h1>
          <p className="mt-1 text-sm text-stone-600">{s.subtitle}</p>
        </div>
        <button className="shrink-0 text-sm underline" onClick={() => setLocale(locale === "id" ? "en" : "id")}>
          {locale === "id" ? "English" : "Bahasa Indonesia"}
        </button>
      </header>
      <nav aria-label={s.stepOf(step + 1, 4)}>
        <ol className="flex flex-wrap gap-2 text-sm">
          {s.steps.map((name, i) => (
            <li key={name}>
              <button
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={`rounded-full px-3 py-1 ${i === step ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-800"}`}
              >
                {i + 1}. {name}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {step === 0 && <PrefsStep s={s} locale={locale} data={data} onDone={() => setStep(1)} />}
      {step === 1 && <SchoolStep s={s} data={data} onBack={() => setStep(0)} onDone={() => setStep(2)} />}
      {step === 2 && <LanguageStep s={s} data={data} onBack={() => setStep(1)} onDone={() => setStep(3)} />}
      {step === 3 && <ReviewStep s={s} locale={locale} data={data} goTo={setStep} />}
      <CounselingHelp s={s} step={step} />
    </main>
  );
}

type IntakeData = NonNullable<ReturnType<typeof useQuery<typeof api.profiles.intake>>>;

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="rounded border border-stone-200 bg-white p-4">
      <legend className="px-1 font-semibold">{title}</legend>
      {hint && <p className="mb-3 text-xs text-stone-600">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}

function Radio<T extends string>({ name, value, current, onChange, children }: { name: string; value: T; current: T; onChange: (v: T) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} /> {children}
    </label>
  );
}

const inputCls = "rounded border border-stone-300 px-3 py-2 text-sm";
const toggle = <T,>(list: T[], item: T, on: boolean) => (on ? [...list.filter((x) => x !== item), item] : list.filter((x) => x !== item));

function Actions({ s, busy, error, onBack, submitLabel }: { s: IntakeStrings; busy: boolean; error: string | null; onBack?: () => void; submitLabel?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        {onBack && <button type="button" onClick={onBack} className="rounded border border-stone-300 px-4 py-2 text-sm">{s.back}</button>}
        <button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? s.saving : submitLabel ?? s.next}
        </button>
      </div>
    </div>
  );
}

function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^[\s\S]*Uncaught Error: /, "").split("\n")[0] ?? msg);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

function PrefsStep({ s, locale, data, onDone }: { s: IntakeStrings; locale: Locale; data: IntakeData; onDone: () => void }) {
  const p = data.profile;
  const [f, setF] = useState<Prefs>(() => ({
    majors: p?.majors ?? [], relatedOk: p?.relatedOk ?? true, countries: p?.countries ?? [], settings: p?.settings ?? [],
    budgetKnown: p ? p.budgetAmount !== undefined : true, budgetAmount: p?.budgetAmount?.toString() ?? "", budgetCurrency: p?.budgetCurrency ?? "IDR",
    budgetPeriod: p?.budgetPeriod ?? "annual", budgetScope: p?.budgetScope ?? "all_in",
    climate: p?.climate ?? "no_preference", intakeTerm: p?.intakeTerm ?? "fall", intakeYear: p?.intakeYear?.toString() ?? String(THIS_YEAR + 1),
  }));
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation(api.profiles.upsertMine);
  const { busy, error, run, setError } = useSave();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const amount = f.budgetKnown ? num(f.budgetAmount) : undefined;
        if (f.budgetKnown && f.budgetAmount && (amount === undefined || Number.isNaN(amount))) return setError(s.amount + "?");
        run(() => save({
          countries: f.countries, settings: f.settings, majors: f.majors, relatedOk: f.relatedOk,
          ...(amount !== undefined ? { budgetAmount: amount, budgetCurrency: f.budgetCurrency, budgetPeriod: f.budgetPeriod, budgetScope: f.budgetScope } : {}),
          climate: f.climate, intakeTerm: f.intakeTerm, ...(f.intakeTerm !== "unknown" ? { intakeYear: Number(f.intakeYear) } : {}),
        }), onDone);
      }}
    >
      <Card title={s.majors} hint={s.majorsHint}>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {Object.keys(taxonomy.fields).map((k) => (
            <Check key={k} checked={f.majors.includes(k)} onChange={(on) => set("majors", toggle(f.majors, k, on))}>{label(k, locale)}</Check>
          ))}
        </div>
        <div className="mt-3"><Check checked={f.relatedOk} onChange={(v) => set("relatedOk", v)}>{s.relatedOk}</Check></div>
      </Card>
      <Card title={s.countries} hint={s.countriesHint}>
        <div className="flex flex-wrap gap-4">
          {(["US", "GB"] as const).map((c) => <Check key={c} checked={f.countries.includes(c)} onChange={(on) => set("countries", toggle(f.countries, c, on))}>{s[c]}</Check>)}
        </div>
      </Card>
      <Card title={s.settings} hint={s.settingsHint}>
        <div className="flex flex-wrap gap-4">
          {(["city", "countryside"] as const).map((c) => <Check key={c} checked={f.settings.includes(c)} onChange={(on) => set("settings", toggle(f.settings, c, on))}>{s[c]}</Check>)}
        </div>
      </Card>
      <Card title={s.budget}>
        <Check checked={!f.budgetKnown} onChange={(v) => set("budgetKnown", !v)}>{s.budgetUnknown}</Check>
        {f.budgetKnown && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <input aria-label={s.amount} placeholder={s.amount} inputMode="numeric" value={f.budgetAmount} onChange={(e) => set("budgetAmount", e.target.value)} className={`${inputCls} w-48`} />
              <select aria-label={s.currency} value={f.budgetCurrency} onChange={(e) => set("budgetCurrency", e.target.value)} className={inputCls}>
                {["IDR", "USD", "GBP"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-4">
              <Radio name="period" value="annual" current={f.budgetPeriod} onChange={(v) => set("budgetPeriod", v)}>{s.annual}</Radio>
              <Radio name="period" value="total" current={f.budgetPeriod} onChange={(v) => set("budgetPeriod", v)}>{s.total}</Radio>
            </div>
            <div className="flex flex-wrap gap-4">
              <Radio name="scope" value="all_in" current={f.budgetScope} onChange={(v) => set("budgetScope", v)}>{s.allIn}</Radio>
              <Radio name="scope" value="tuition_only" current={f.budgetScope} onChange={(v) => set("budgetScope", v)}>{s.tuitionOnly}</Radio>
            </div>
          </div>
        )}
      </Card>
      <Card title={s.climate}>
        <div className="flex flex-wrap gap-4">
          {(["warm", "mild", "cool", "cold", "no_preference", "unknown"] as const).map((c) => (
            <Radio key={c} name="climate" value={c} current={f.climate} onChange={(v) => set("climate", v)}>{s[c]}</Radio>
          ))}
        </div>
      </Card>
      <Card title={s.intake}>
        <div className="flex flex-col gap-2">
          {(["fall", "spring", "unknown"] as const).map((term) => (
            <Radio key={term} name="term" value={term} current={f.intakeTerm} onChange={(v) => set("intakeTerm", v)}>{term === "unknown" ? s.unknown : s[term]}</Radio>
          ))}
          {f.intakeTerm !== "unknown" && (
            <select aria-label={s.year} value={f.intakeYear} onChange={(e) => set("intakeYear", e.target.value)} className={`${inputCls} w-32`}>
              {[0, 1, 2, 3, 4].map((d) => <option key={d}>{THIS_YEAR + d}</option>)}
            </select>
          )}
        </div>
      </Card>
      <Actions s={s} busy={busy} error={error} />
    </form>
  );
}

function SchoolStep({ s, data, onBack, onDone }: { s: IntakeStrings; data: IntakeData; onBack: () => void; onDone: () => void }) {
  const q = data.qualification;
  const [f, setF] = useState<School>(() => ({
    skip: false, qualificationType: q?.qualificationType ?? "SMA", curriculum: q?.curriculum ?? "Kurikulum Merdeka", school: q?.school ?? "",
    gradeLevel: q?.gradeLevel?.toString() ?? "12", year: q?.year?.toString() ?? String(THIS_YEAR + 1),
    scaleMin: q?.scaleMin?.toString() ?? "0", scaleMax: q?.scaleMax?.toString() ?? "100",
    overallKnown: q ? q.reportedOverall !== undefined : true, overall: q?.reportedOverall?.toString() ?? "",
    subjects: data.subjects.length ? data.subjects.map((x) => ({ subject: x.subject, grade: String(x.grade) })) : DEFAULT_SUBJECTS.map((subject) => ({ subject, grade: "" })),
  }));
  const set = <K extends keyof School>(k: K, v: School[K]) => setF((x) => ({ ...x, [k]: v }));
  const add = useMutation(api.profiles.addQualification);
  const { busy, error, run, setError } = useSave();

  // Checked here first so the message is in the student's language; the server checks again.
  const checkSchool = (): string | null => {
    const min = num(f.scaleMin), max = num(f.scaleMax);
    if (min === undefined || max === undefined || Number.isNaN(min) || Number.isNaN(max) || max <= min) return s.badScale;
    const rows: [string, string][] = [
      ...(f.overallKnown && f.overall.trim() ? [[s.overall, f.overall] as [string, string]] : []),
      ...f.subjects.filter((x) => x.subject.trim() && x.grade.trim()).map((x) => [x.subject.trim(), x.grade] as [string, string]),
    ];
    for (const [what, raw] of rows) {
      const g = num(raw);
      if (g === undefined || Number.isNaN(g)) return s.notANumber(what);
      if (g < min || g > max) return s.outOfScale(what, f.scaleMin, f.scaleMax);
    }
    return null;
  };

  // A new record is created only when something changed, so originals are never rewritten.
  const payload = () => ({
    qualificationType: f.qualificationType, curriculum: f.curriculum, ...(f.school.trim() ? { school: f.school.trim() } : {}),
    gradeLevel: Number(f.gradeLevel), year: Number(f.year), scaleMin: Number(f.scaleMin), scaleMax: Number(f.scaleMax),
    ...(f.overallKnown && f.overall.trim() ? { reportedOverall: num(f.overall) } : {}),
    subjects: f.subjects.filter((x) => x.subject.trim() && x.grade.trim()).map((x) => ({ subject: x.subject.trim(), grade: num(x.grade)! })),
  });
  const unchanged = () => {
    if (!q) return false;
    const p = payload();
    const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);
    return same(p.qualificationType, q.qualificationType) && same(p.curriculum, q.curriculum) && same(p.school, q.school)
      && same(p.gradeLevel, q.gradeLevel) && same(p.year, q.year) && same(p.scaleMin, q.scaleMin) && same(p.scaleMax, q.scaleMax)
      && same(p.reportedOverall, q.reportedOverall) && JSON.stringify(p.subjects) === JSON.stringify(data.subjects);
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      if (f.skip) return onDone();
      const problem = checkSchool();
      if (problem) return setError(problem);
      if (unchanged()) return onDone();
      run(() => add(payload()), onDone);
    }}>
      <Card title={s.schoolTitle} hint={s.schoolHint}>
        <Check checked={f.skip} onChange={(v) => set("skip", v)}>{s.skipGrades}</Check>
        {!f.skip && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">{s.qualificationType}
              <select value={f.qualificationType} onChange={(e) => set("qualificationType", e.target.value)} className={inputCls}>{QUAL_TYPES.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-sm">{s.curriculum}
              <select value={f.curriculum} onChange={(e) => set("curriculum", e.target.value)} className={inputCls}>{CURRICULA.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">{s.school}
              <input value={f.school} onChange={(e) => set("school", e.target.value)} className={inputCls} maxLength={120} />
            </label>
            <label className="flex flex-col gap-1 text-sm">{s.gradeLevel}
              <select value={f.gradeLevel} onChange={(e) => set("gradeLevel", e.target.value)} className={inputCls}>{["10", "11", "12"].map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-sm">{s.gradYear}
              <select value={f.year} onChange={(e) => set("year", e.target.value)} className={inputCls}>{[0, 1, 2, 3].map((d) => <option key={d}>{THIS_YEAR + d}</option>)}</select>
            </label>
          </div>
        )}
      </Card>
      {!f.skip && (
        <>
          <Card title={s.scale}>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">{s.scaleMin}<input inputMode="decimal" value={f.scaleMin} onChange={(e) => set("scaleMin", e.target.value)} className={`${inputCls} w-24`} /></label>
              <label className="flex flex-col gap-1 text-sm">{s.scaleMax}<input inputMode="decimal" value={f.scaleMax} onChange={(e) => set("scaleMax", e.target.value)} className={`${inputCls} w-24`} /></label>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-sm">{s.overall}</span>
              <Check checked={!f.overallKnown} onChange={(v) => set("overallKnown", !v)}>{s.overallUnknown}</Check>
              {f.overallKnown && (
                <div className="flex items-center gap-2 text-sm">
                  <input aria-label={s.overall} inputMode="decimal" value={f.overall} onChange={(e) => set("overall", e.target.value)} className={`${inputCls} w-24`} />
                  <span>/ {f.scaleMax || "?"}</span>
                </div>
              )}
            </div>
          </Card>
          <Card title={s.subjects}>
            <ul className="flex flex-col gap-2">
              {f.subjects.map((row, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <input aria-label={s.subject} placeholder={s.subject} value={row.subject} className={`${inputCls} flex-1`}
                    onChange={(e) => set("subjects", f.subjects.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))} />
                  <input aria-label={s.grade} placeholder={s.grade} inputMode="decimal" value={row.grade} className={`${inputCls} w-24`}
                    onChange={(e) => set("subjects", f.subjects.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} />
                  <button type="button" className="text-sm text-red-700 underline" onClick={() => set("subjects", f.subjects.filter((_, j) => j !== i))}>{s.removeSubject}</button>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-2 text-sm text-emerald-800 underline" onClick={() => set("subjects", [...f.subjects, { subject: "", grade: "" }])}>{s.addSubject}</button>
            <p className="mt-3 text-xs text-stone-600">{s.originalNote}</p>
          </Card>
        </>
      )}
      <Actions s={s} busy={busy} error={error} onBack={onBack} />
    </form>
  );
}

function LanguageStep({ s, data, onBack, onDone }: { s: IntakeStrings; data: IntakeData; onBack: () => void; onDone: () => void }) {
  const [f, setF] = useState<Lang>(() => Object.fromEntries(TESTS.map((k) => {
    const saved = data.language.find((l) => l.test === k);
    return [k, { status: (saved?.status as TestStatus) ?? (k === "ielts_academic" ? "not_taken" : "unknown"), score: saved?.score?.toString() ?? "", takenOn: saved?.takenOn ?? "" }];
  })) as Lang);
  const setLanguage = useMutation(api.profiles.setLanguage);
  const { busy, error, run } = useSave();

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      run(() => setLanguage({
        tests: TESTS.map((test) => ({
          test, status: f[test].status,
          ...(f[test].status === "taken" && f[test].score ? { score: num(f[test].score) } : {}),
          ...(f[test].status === "taken" && f[test].takenOn ? { takenOn: f[test].takenOn } : {}),
        })),
      }), onDone);
    }}>
      <Card title={s.languageTitle} hint={s.languageHint}>
        <div className="flex flex-col gap-4">
          {TESTS.map((k) => (
            <div key={k} className="flex flex-col gap-2 border-t border-stone-100 pt-3 first:border-0 first:pt-0">
              <span className="text-sm font-medium">{s.tests[k]}</span>
              <div className="flex flex-wrap gap-4">
                {(["taken", "not_taken", "unknown"] as const).map((st) => (
                  <Radio key={st} name={`lang-${k}`} value={st} current={f[k].status} onChange={(v) => setF((x) => ({ ...x, [k]: { ...x[k], status: v } }))}>
                    {st === "unknown" ? s.unknown : s[st]}
                  </Radio>
                ))}
              </div>
              {f[k].status === "taken" && (
                <div className="flex flex-wrap gap-3">
                  <label className="flex flex-col gap-1 text-sm">{s.score}
                    <input inputMode="decimal" value={f[k].score} onChange={(e) => setF((x) => ({ ...x, [k]: { ...x[k], score: e.target.value } }))} className={`${inputCls} w-24`} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">{s.takenOn}
                    <input type="date" value={f[k].takenOn} onChange={(e) => setF((x) => ({ ...x, [k]: { ...x[k], takenOn: e.target.value } }))} className={inputCls} />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Actions s={s} busy={busy} error={error} onBack={onBack} />
    </form>
  );
}

function ReviewStep({ s, locale, data, goTo }: { s: IntakeStrings; locale: Locale; data: IntakeData; goTo: (n: number) => void }) {
  const router = useRouter();
  const complete = useMutation(api.profiles.completeIntake);
  const { busy, error, run } = useSave();
  const p = data.profile;
  const q = data.qualification;
  const fmt = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US");
  const missing = <span className="text-stone-500">{s.notProvided}</span>;

  const rows: [string, ReactNode, number][] = [
    [s.majors, p?.majors.length ? p.majors.map((m) => label(m, locale)).join(", ") + (p.relatedOk ? ` (+ ${s.relatedOk.toLowerCase()})` : "") : missing, 0],
    [s.countries, p?.countries.length ? p.countries.map((c) => s[c]).join(", ") : <span className="text-red-700">{s.countriesHint}</span>, 0],
    [s.settings, p ? (p.settings.length ? p.settings.map((x) => s[x]).join(", ") : s.no_preference) : missing, 0],
    [s.budget, p?.budgetAmount !== undefined ? `${p.budgetCurrency} ${fmt.format(p.budgetAmount)} · ${p.budgetPeriod === "total" ? s.total : s.annual} · ${p.budgetScope === "tuition_only" ? s.tuitionOnly : s.allIn}` : p ? s.budgetUnknown : missing, 0],
    [s.climate, p?.climate ? s[p.climate] : missing, 0],
    [s.intake, p?.intakeTerm && p.intakeTerm !== "unknown" ? `${s[p.intakeTerm]} ${p.intakeYear ?? ""}` : p ? s.unknown : missing, 0],
    [s.schoolTitle, q ? `${q.qualificationType ?? ""} · ${q.curriculum} · ${q.reportedOverall !== undefined ? `${q.reportedOverall} / ${q.scaleMax}` : s.overallUnknown}` : missing, 1],
    [s.subjects, data.subjects.length ? data.subjects.map((x) => `${x.subject} ${x.grade}`).join(", ") : missing, 1],
    [s.languageTitle, data.language.length ? data.language.filter((l) => l.status !== "unknown").map((l) => `${s.tests[l.test as TestKey]}: ${l.status === "taken" ? (l.score ?? s.taken) : s.not_taken}`).join(", ") || s.unknown : missing, 2],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card title={s.reviewTitle} hint={s.reviewNote}>
        <dl className="flex flex-col divide-y divide-stone-100">
          {rows.map(([k, v, stepIndex]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
              <dt className="w-48 shrink-0 text-stone-600">{k}</dt>
              <dd className="flex-1">{v}</dd>
              <button className="text-emerald-800 underline" onClick={() => goTo(stepIndex)}>{s.edit}</button>
            </div>
          ))}
        </dl>
      </Card>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button onClick={() => goTo(2)} className="rounded border border-stone-300 px-4 py-2 text-sm">{s.back}</button>
        <button disabled={busy} onClick={() => run(() => complete({}), () => router.push("/"))}
          className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? s.saving : s.finish}
        </button>
      </div>
    </div>
  );
}

function CounselingHelp({ s, step }: { s: IntakeStrings; step: number }) {
  const status = useQuery(api.counseling.myStatus);
  const request = useMutation(api.counseling.request);
  const [error, setError] = useState<string | null>(null);
  if (!status) return null;
  return (
    <aside className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <h2 className="font-semibold">{s.helpTitle}</h2>
      {status.status === "assigned" && status.counselorName ? <p className="mt-1">{s.helpAssigned(status.counselorName)}</p>
        : status.status === "pending" ? <p className="mt-1">{s.helpPending}</p>
        : (
          <>
            <p className="mt-1">{s.helpBody}</p>
            <button className="mt-2 rounded border border-emerald-700 px-3 py-1.5 text-emerald-800"
              onClick={() => request({ stage: "intake", context: { step: step + 1 } }).catch((e) => setError(String(e)))}>
              {s.helpButton}
            </button>
          </>
        )}
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    </aside>
  );
}
