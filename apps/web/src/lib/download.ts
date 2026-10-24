// Files are fetched from the authenticated Convex HTTP action with the user's token;
// the browser never receives a public storage URL (CV-3).
export async function downloadFile(token: string | null, fileId: string, name: string, variant?: "preview") {
  if (!token) throw new Error("Not signed in");
  const base = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const url = `${base}/files/download?id=${encodeURIComponent(fileId)}${variant ? `&variant=${variant}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(res.status === 404 ? "File not available" : `Download failed (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
