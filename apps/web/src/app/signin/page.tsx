"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { t } from "@/lib/strings";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = t("id");

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="mb-6 text-3xl font-semibold">{s.appName}</h1>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const data = new FormData(e.currentTarget);
          data.set("flow", flow);
          try {
            await signIn("password", data);
          } catch {
            setError(s.signInFailed);
          } finally {
            setBusy(false);
          }
        }}
      >
        {flow === "signUp" && (
          <label className="flex flex-col gap-1 text-sm">
            {s.name}
            <input name="name" className="rounded border border-stone-300 px-3 py-2" autoComplete="name" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          {s.email}
          <input name="email" type="email" required className="rounded border border-stone-300 px-3 py-2" autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {s.password}
          <input name="password" type="password" required minLength={8} className="rounded border border-stone-300 px-3 py-2"
            autoComplete={flow === "signUp" ? "new-password" : "current-password"} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50">
          {flow === "signIn" ? s.signIn : s.signUp}
        </button>
        <button type="button" className="text-sm text-emerald-800 underline" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
          {flow === "signIn" ? s.noAccount : s.haveAccount}
        </button>
      </form>
    </main>
  );
}
