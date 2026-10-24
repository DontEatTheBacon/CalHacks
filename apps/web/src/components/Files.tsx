"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { downloadFile } from "@/lib/download";
import type { Strings } from "@/lib/strings";

const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif";
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

type FileRow = { id: Id<"files">; name: string; ext: string; size: number; state: string; rejectReason: string | null; scanState: string };

function DownloadButton({ file, s }: { file: FileRow; s: Strings }) {
  const token = useAuthToken();
  const [error, setError] = useState<string | null>(null);
  const word = file.ext === "doc" || file.ext === "docx";
  return (
    <>
      <button
        className="text-emerald-800 underline"
        onClick={async () => {
          if (word && !window.confirm(s.wordWarning)) return;
          setError(null);
          try {
            await downloadFile(token, file.id, file.name);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        {s.download}
      </button>
      {error && <span role="alert" className="text-red-700">{error}</span>}
    </>
  );
}

export function StudentFiles({ s, hasCounselor }: { s: Strings; hasCounselor: boolean }) {
  const files = useQuery(api.files.listMine);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const finishUpload = useMutation(api.files.finishUpload);
  const attachPreview = useMutation(api.files.attachPreview);
  const share = useMutation(api.files.share);
  const unshare = useMutation(api.files.unshare);
  const remove = useMutation(api.files.remove);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB");
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = await res.json();
      const result = await finishUpload({ storageId, name: file.name });
      if (!result.ok) throw new Error(result.error);
      // HEIC preview conversion in the browser is not built yet; mark the preview unavailable (download still works).
      if (/\.(heic|heif)$/i.test(file.name)) await attachPreview({ fileId: result.fileId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="rounded border border-stone-200 bg-white p-4">
      <h2 className="mb-1 font-semibold">{s.files}</h2>
      <p className="mb-3 text-xs text-stone-600">{s.fileRules}</p>
      <input ref={input} type="file" accept={ACCEPT} disabled={busy} aria-label={s.upload}
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} className="mb-3 text-sm" />
      {busy && <p className="text-sm">{s.uploading}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {files?.length === 0 && <p className="text-sm text-stone-600">{s.noFiles}</p>}
      <ul className="flex flex-col gap-2">
        {files?.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{f.name}</span>
            <span className="text-stone-500">{f.ext.toUpperCase()} · {kb(f.size)}</span>
            {f.state === "validating" && <span>{s.validating}</span>}
            {f.state === "rejected" && <span className="text-red-700">{s.rejected}: {f.rejectReason}</span>}
            {f.state === "ready" && (
              <>
                <span className="text-xs text-stone-500">{s.notScanned}</span>
                <DownloadButton file={f} s={s} />
                {hasCounselor && (f.sharedWithCounselor
                  ? <button className="underline" onClick={() => unshare({ fileId: f.id })}>{s.unshare} ({s.shared})</button>
                  : <button className="underline" onClick={() => share({ fileId: f.id })}>{s.share}</button>)}
              </>
            )}
            <button className="text-red-700 underline" onClick={() => remove({ fileId: f.id })}>{s.remove}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SharedFiles({ studentId, s }: { studentId: Id<"users">; s: Strings }) {
  const files = useQuery(api.files.listShared, { studentId });
  return (
    <section className="rounded border border-stone-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">{s.sharedFiles}</h2>
      {files?.length === 0 && <p className="text-sm text-stone-600">{s.noFiles}</p>}
      <ul className="flex flex-col gap-2">
        {files?.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{f.name}</span>
            <span className="text-stone-500">{f.ext.toUpperCase()} · {kb(f.size)}</span>
            <DownloadButton file={f} s={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}
