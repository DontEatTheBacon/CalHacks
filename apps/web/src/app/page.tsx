"use client";

// Working shell for WP1 (auth, roles, counseling, messages, files). The visual design comes
// later from Figma (docs/figma-plan.md); this page proves the flows end to end.
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { SharedFiles, StudentFiles } from "@/components/Files";
import { Thread } from "@/components/Thread";
import { t, type Strings } from "@/lib/strings";
import { useLocale } from "@/lib/useLocale";

export default function Home() {
  const me = useQuery(api.profiles.me);
  const { signOut } = useAuthActions();
  const [locale, setLocale] = useLocale();
  if (me === undefined) return <main className="p-6">…</main>;
  if (me === null) return <main className="p-6">Sign in required.</main>;
  const s = t(locale);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{s.appName}</h1>
          <p className="text-sm text-stone-600">{me.name ?? me.email} · {me.role === "student" ? s.student : s.counselor}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button className="underline" onClick={() => setLocale(locale === "id" ? "en" : "id")}>
            {locale === "id" ? "English" : "Bahasa Indonesia"}
          </button>
          <button className="underline" onClick={() => void signOut()}>{s.signOut}</button>
        </div>
      </header>
      {me.role === "student" ? <StudentHome s={s} /> : <CounselorHome s={s} />}
    </main>
  );
}

function StudentHome({ s }: { s: Strings }) {
  const router = useRouter();
  const intake = useQuery(api.profiles.intake);
  const status = useQuery(api.counseling.myStatus);
  const request = useMutation(api.counseling.request);
  const [error, setError] = useState<string | null>(null);
  // New students start with the intake (spec screen 1).
  useEffect(() => {
    if (intake && !intake.completed) router.replace("/intake");
  }, [intake, router]);
  if (!intake?.completed) return null;
  return (
    <>
      <section className="flex items-center justify-between rounded border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">{s.profile}</h2>
        <div className="flex gap-4 text-sm">
          <Link href="/discover" className="font-medium text-emerald-800 underline">{s.seePrograms}</Link>
          <Link href="/intake" className="text-emerald-800 underline">{s.editProfile}</Link>
        </div>
      </section>
      <section className="rounded border border-stone-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">{s.counseling}</h2>
        {status?.status === "assigned" && status.counselorName && <p className="text-sm">{s.counselingAssigned(status.counselorName)}</p>}
        {status?.status === "pending" && <p className="text-sm">{s.counselingPending}</p>}
        {status && status.status !== "assigned" && (
          <>
            {status.status !== "pending" && <p className="mb-2 text-sm text-stone-600">{s.counselingNone}</p>}
            <button
              className="rounded bg-emerald-700 px-3 py-2 text-sm text-white"
              onClick={async () => {
                setError(null);
                try {
                  await request({ stage: "dashboard" });
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              {s.requestCounseling}
            </button>
          </>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </section>
      {status?.conversationId && <Thread conversationId={status.conversationId} s={s} />}
      <StudentFiles s={s} hasCounselor={status?.status === "assigned"} />
    </>
  );
}

function CounselorHome({ s }: { s: Strings }) {
  const students = useQuery(api.counseling.listAssigned);
  const [selected, setSelected] = useState<Id<"users"> | null>(null);
  if (selected) return <CaseView studentId={selected} s={s} onBack={() => setSelected(null)} />;
  return (
    <section className="rounded border border-stone-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">{s.assignedStudents}</h2>
      {students?.length === 0 && <p className="text-sm text-stone-600">{s.noStudents}</p>}
      <ul className="flex flex-col gap-2">
        {students?.map((st) => (
          <li key={st.studentId}>
            <button className="text-emerald-800 underline" onClick={() => setSelected(st.studentId)}>{st.name}</button>
            <span className="ml-2 text-xs text-stone-500">{st.stage}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CaseView({ studentId, s, onBack }: { studentId: Id<"users">; s: Strings; onBack: () => void }) {
  const caseData = useQuery(api.counseling.getCase, { studentId });
  const conversations = useQuery(api.counseling.conversationFor, { studentId });
  return (
    <>
      <button className="self-start text-sm underline" onClick={onBack}>← {s.back}</button>
      <section className="rounded border border-stone-200 bg-white p-4 text-sm">
        <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(caseData?.profile ?? null, null, 2)}</pre>
      </section>
      {conversations && <Thread conversationId={conversations} s={s} />}
      <SharedFiles studentId={studentId} s={s} />
    </>
  );
}
