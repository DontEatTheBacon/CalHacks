"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { AppStrings } from "@/lib/appStrings";

export function SaveButton({ programId, s, goToPlan = false }: { programId: Id<"programs">; s: AppStrings; goToPlan?: boolean }) {
  const mine = useQuery(api.applications.listMine);
  const save = useMutation(api.applications.save);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = mine?.savedProgramIds.includes(programId);
  if (saved) return <span className="text-sm font-medium text-emerald-800">{s.saved}</span>;
  return (
    <span>
      <button disabled={busy || !mine} className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const id = await save({ programId });
            if (goToPlan) router.push(`/applications/${id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}>{s.save}</button>
      {error && <span role="alert" className="ml-2 text-sm text-red-700">{error}</span>}
    </span>
  );
}
