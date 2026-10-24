import { getAuthUserId } from "@convex-dev/auth/server";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

// Only the app's own origin may call the download endpoint from a browser.
function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.SITE_URL ?? "http://localhost:3000",
    "Access-Control-Allow-Headers": "Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition, X-Langkah-Warning",
    Vary: "Origin",
  };
}

const deny = (status: number, message: string) =>
  new Response(message, { status, headers: { ...cors(), "Content-Type": "text/plain", "Cache-Control": "no-store" } });

/**
 * Authenticated download (CV-3, scenario 18). The caller sends their Convex Auth token as a
 * Bearer header; the file is streamed only to the owner or a counselor it was explicitly shared
 * with. A copied URL without the owner's token returns 401/404. Storage URLs are never exposed.
 */
http.route({
  path: "/files/download",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return deny(401, "Sign in required");
    const url = new URL(request.url);
    const fileId = url.searchParams.get("id") ?? "";
    const preview = url.searchParams.get("variant") === "preview";
    const grant = await ctx.runQuery(internal.files.authorizeDownload, { fileId, userId, preview });
    // Same answer for "missing" and "not yours", so file IDs cannot be probed.
    if (!grant) return deny(404, "Not found");
    const blob = await ctx.storage.get(grant.storageId);
    if (!blob) return deny(404, "Not found");
    const inline = preview || grant.mime === "image/png" || grant.mime === "image/jpeg";
    const headers: Record<string, string> = {
      ...cors(),
      "Content-Type": grant.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(grant.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    };
    if (grant.word) headers["X-Langkah-Warning"] = "word-macro";
    return new Response(blob, { status: 200, headers });
  }),
});

http.route({
  path: "/files/download",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: { ...cors(), "Access-Control-Max-Age": "600" } })),
});

function sameSecret(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Apify run-finished webhook (AP-5). The secret is in the path. The body only tells us which
 * run to look at; collection re-reads the run from the Apify API and is idempotent, so a forged
 * or replayed call cannot store anything that is not really in the Actor's dataset.
 */
http.route({
  pathPrefix: "/apify/webhook/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.APIFY_WEBHOOK_SECRET;
    const given = new URL(request.url).pathname.slice("/apify/webhook/".length);
    if (!expected || expected.length < 32 || !sameSecret(given, expected)) return new Response("Not found", { status: 404 });
    let runId: unknown;
    try {
      const body = await request.json();
      runId = body?.eventData?.actorRunId ?? body?.resource?.id;
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    if (typeof runId !== "string" || !/^[A-Za-z0-9]{8,32}$/.test(runId)) return new Response("Bad request", { status: 400 });
    const known = await ctx.runMutation(internal.ingestion.noteWebhook, { apifyRunId: runId });
    if (!known) return new Response("Unknown run", { status: 404 });
    // Answer quickly; collection runs in the background.
    await ctx.scheduler.runAfter(0, internal.ingestion.collect, { apifyRunId: runId, via: "webhook" });
    return new Response("OK", { status: 200 });
  }),
});

export default http;
