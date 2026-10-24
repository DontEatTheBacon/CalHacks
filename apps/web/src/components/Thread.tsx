"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Strings } from "@/lib/strings";

export function Thread({ conversationId, s }: { conversationId: Id<"conversations">; s: Strings }) {
  const messages = useQuery(api.messages.list, { conversationId });
  const send = useMutation(api.messages.send);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded border border-stone-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">{s.messages}</h2>
      <ul className="mb-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
        {messages?.map((m) => (
          <li key={m._id} className={m.senderType === "system" ? "text-xs text-stone-500" : "text-sm"}>
            {m.senderType !== "system" && <span className="font-medium">{m.senderType === "student" ? s.student : s.counselor}: </span>}
            {m.body}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setError(null);
          try {
            await send({ conversationId, body });
            setBody("");
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      >
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={s.messagePlaceholder}
          className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm" aria-label={s.messagePlaceholder} />
        <button className="rounded bg-emerald-700 px-3 py-2 text-sm text-white">{s.send}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
