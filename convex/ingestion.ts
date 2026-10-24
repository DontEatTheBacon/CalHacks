// Ingestion step 1: collection (spec 6.3 steps 3–5, AP-5). Convex starts the Apify Actor
// asynchronously, learns of completion from a webhook (polling as backup), confirms the run with
// the Apify API, and stores each page as a source with its content hash. Extraction comes next.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import domains from "../config/domains.json" with { type: "json" };
import limits from "../config/limits.json" with { type: "json" };
import { isAllowedUrl } from "./lib/rules/domains.ts";

const APIFY = "https://api.apify.com/v2";
const POLL_EVERY_MS = 5 * 60 * 1000;
const MAX_POLLS = 12;
const COLLECT_LEASE_MS = 10 * 60 * 1000;
const PAGE_SIZE = 20;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set on this Convex deployment`);
  return value;
}

async function apify(path: string, init: RequestInit = {}) {
  const res = await fetch(`${APIFY}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env("APIFY_TOKEN")}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Apify ${init.method ?? "GET"} ${path.split("?")[0]} failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

const DEFAULT_KEYWORDS = [
  "international", "indonesia", "admission", "apply", "entry", "requirement", "tuition", "fee", "cost",
  "computer", "economics", "deadline", "date", "english", "language", "scholarship", "undergraduate", "first-year",
];

/** Starts an Actor run (never the synchronous endpoint) with a webhook back to this deployment. */
export const startRun = internalAction({
  args: {
    startUrls: v.array(v.string()),
    label: v.optional(v.string()),
    maxDepth: v.optional(v.number()),
    maxPages: v.optional(v.number()),
    linkKeywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ apifyRunId: string }> => {
    const allowlist = [...domains.US, ...domains.GB];
    const rejected = args.startUrls.filter((u) => !isAllowedUrl(u));
    if (rejected.length) throw new Error(`Not on the domain allowlist: ${rejected.join(", ")}`);
    // Keep the crawl on the start URLs' own sites.
    const hosts = args.startUrls.map((u) => new URL(u).hostname);
    const allowedDomains = allowlist.filter((d) => hosts.some((h) => h === d || h.endsWith("." + d)));
    const input = {
      startUrls: args.startUrls,
      allowedDomains,
      maxDepth: args.maxDepth ?? limits.ingestion.maxDepth,
      maxPages: Math.min(args.maxPages ?? 40, limits.ingestion.maxPagesPerRun),
      linkKeywords: args.linkKeywords ?? DEFAULT_KEYWORDS,
      label: args.label ?? null,
    };
    const webhooks = [{
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
      requestUrl: `${env("CONVEX_SITE_URL")}/apify/webhook/${env("APIFY_WEBHOOK_SECRET")}`,
    }];
    const encoded = btoa(JSON.stringify(webhooks));
    const run = await apify(`/acts/${env("APIFY_ACTOR_ID")}/runs?webhooks=${encodeURIComponent(encoded)}`, { method: "POST", body: JSON.stringify(input) });
    const apifyRunId: string = run.data.id;
    await ctx.runMutation(internal.ingestion.recordStart, {
      apifyRunId, datasetId: run.data.defaultDatasetId, label: args.label, startUrls: args.startUrls,
    });
    await ctx.scheduler.runAfter(POLL_EVERY_MS, internal.ingestion.poll, { apifyRunId, attempt: 1 });
    return { apifyRunId };
  },
});

export const recordStart = internalMutation({
  args: { apifyRunId: v.string(), datasetId: v.optional(v.string()), label: v.optional(v.string()), startUrls: v.array(v.string()) },
  handler: async (ctx, a) => {
    await ctx.db.insert("ingestionRuns", { ...a, status: "running", startedAt: Date.now(), webhookCount: 0 });
  },
});

/** Called by the webhook HTTP action. Counts deliveries; replays are harmless. */
export const noteWebhook = internalMutation({
  args: { apifyRunId: v.string() },
  handler: async (ctx, { apifyRunId }) => {
    const run = await ctx.db.query("ingestionRuns").withIndex("by_apify_run", (q) => q.eq("apifyRunId", apifyRunId)).unique();
    if (!run) return false;
    await ctx.db.patch(run._id, { webhookCount: run.webhookCount + 1 });
    return true;
  },
});

/** Backup for a lost webhook: checks every 5 minutes for up to an hour. */
export const poll = internalAction({
  args: { apifyRunId: v.string(), attempt: v.number() },
  handler: async (ctx, { apifyRunId, attempt }) => {
    const outcome = await ctx.runAction(internal.ingestion.collect, { apifyRunId, via: "poll" });
    if (outcome === "not_finished" && attempt < MAX_POLLS) {
      await ctx.scheduler.runAfter(POLL_EVERY_MS, internal.ingestion.poll, { apifyRunId, attempt: attempt + 1 });
    }
  },
});

/** Claims the run for collection. Only one caller wins; an abandoned claim expires after 10 minutes. */
export const claim = internalMutation({
  args: { apifyRunId: v.string() },
  handler: async (ctx, { apifyRunId }) => {
    const run = await ctx.db.query("ingestionRuns").withIndex("by_apify_run", (q) => q.eq("apifyRunId", apifyRunId)).unique();
    if (!run) return "unknown" as const;
    if (run.status === "stored" || run.status === "failed") return "done" as const;
    const now = Date.now();
    if (run.status === "collecting" && (run.collectingSince ?? 0) + COLLECT_LEASE_MS > now) return "busy" as const;
    await ctx.db.patch(run._id, { status: "collecting", collectingSince: now });
    return "claimed" as const;
  },
});

export const release = internalMutation({
  args: { apifyRunId: v.string(), apifyStatus: v.string() },
  handler: async (ctx, { apifyRunId, apifyStatus }) => {
    const run = await ctx.db.query("ingestionRuns").withIndex("by_apify_run", (q) => q.eq("apifyRunId", apifyRunId)).unique();
    if (run) await ctx.db.patch(run._id, { status: "running", collectingSince: undefined, apifyStatus });
  },
});

export const finish = internalMutation({
  args: {
    apifyRunId: v.string(), status: v.union(v.literal("stored"), v.literal("failed")), apifyStatus: v.string(),
    via: v.union(v.literal("webhook"), v.literal("poll")), error: v.optional(v.string()),
    counts: v.optional(v.object({ new: v.number(), changed: v.number(), unchanged: v.number(), failed: v.number() })),
  },
  handler: async (ctx, { apifyRunId, via, ...rest }) => {
    const run = await ctx.db.query("ingestionRuns").withIndex("by_apify_run", (q) => q.eq("apifyRunId", apifyRunId)).unique();
    if (!run) return;
    await ctx.db.patch(run._id, { ...rest, notifiedBy: via, finishedAt: Date.now(), collectingSince: undefined });
    await ctx.db.insert("actionHistory", { actor: "system", action: `ingestion_${rest.status}`, target: apifyRunId, detail: { via, counts: rest.counts, error: rest.error }, at: Date.now() });
  },
});

export const latestForUrl = internalQuery({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const row = await ctx.db.query("sources").withIndex("by_url", (q) => q.eq("url", url)).order("desc").first();
    return row ? { id: row._id, contentHash: row.contentHash ?? null, apifyRunId: row.apifyRunId ?? null, status: row.status } : null;
  },
});

const fetchMethod = v.union(v.literal("plain"), v.literal("web_unlocker"), v.literal("failed"));
const sourceStatus = v.union(v.literal("ok"), v.literal("blocked"), v.literal("empty"), v.literal("timeout"), v.literal("changed"), v.literal("rejected_by_policy"));

export const putSource = internalMutation({
  args: {
    url: v.string(), finalUrl: v.optional(v.string()), domain: v.string(), title: v.optional(v.string()),
    httpStatus: v.optional(v.number()), error: v.optional(v.string()), depth: v.optional(v.number()),
    retrievedAt: v.number(), fetchMethod, status: sourceStatus, contentHash: v.optional(v.string()),
    apifyRunId: v.string(), textRef: v.optional(v.id("_storage")), previousId: v.optional(v.id("sources")),
    unchangedId: v.optional(v.id("sources")),
  },
  handler: async (ctx, { unchangedId, ...src }) => {
    // Idempotent per run and URL: a second collection of the same run changes nothing.
    const sameRun = (await ctx.db.query("sources").withIndex("by_url", (q) => q.eq("url", src.url)).collect()).find((s) => s.apifyRunId === src.apifyRunId);
    if (sameRun) {
      if (src.textRef && src.textRef !== sameRun.textRef) await ctx.storage.delete(src.textRef);
      return sameRun._id;
    }
    if (unchangedId) {
      await ctx.db.patch(unchangedId, { retrievedAt: src.retrievedAt, apifyRunId: src.apifyRunId, fetchMethod: src.fetchMethod });
      return unchangedId;
    }
    return ctx.db.insert("sources", { ...src, verification: "unverified" });
  },
});

type Item = {
  url: string; finalUrl?: string; domain?: string; title?: string | null; httpStatus?: number | null; error?: string | null;
  depth?: number; status: string; fetchMethod: string; text?: string | null; contentHash?: string | null; retrievedAt?: string;
};

const STATUSES = new Set(["ok", "blocked", "empty", "timeout", "rejected_by_policy"]);
const METHODS = new Set(["plain", "web_unlocker", "failed"]);

/**
 * Confirms the run with the Apify API (the webhook body is not trusted), then stores the dataset.
 * Returns "not_finished" while the run is still going so polling can try again later.
 */
export const collect = internalAction({
  args: { apifyRunId: v.string(), via: v.union(v.literal("webhook"), v.literal("poll")) },
  handler: async (ctx, { apifyRunId, via }): Promise<"stored" | "failed" | "not_finished" | "busy" | "done" | "unknown"> => {
    const claimed = await ctx.runMutation(internal.ingestion.claim, { apifyRunId });
    if (claimed !== "claimed") return claimed;
    let apifyStatus = "UNKNOWN";
    try {
      const run = (await apify(`/actor-runs/${apifyRunId}`)).data;
      apifyStatus = run.status;
      if (run.status === "READY" || run.status === "RUNNING") {
        await ctx.runMutation(internal.ingestion.release, { apifyRunId, apifyStatus });
        return "not_finished";
      }
      if (run.status !== "SUCCEEDED") {
        await ctx.runMutation(internal.ingestion.finish, { apifyRunId, status: "failed", apifyStatus, via, error: `Actor run ${run.status}` });
        return "failed";
      }
      const counts = { new: 0, changed: 0, unchanged: 0, failed: 0 };
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const items: Item[] = await apify(`/datasets/${run.defaultDatasetId}/items?clean=1&format=json&offset=${offset}&limit=${PAGE_SIZE}`);
        for (const item of items) {
          if (typeof item.url !== "string" || !isAllowedUrl(item.url)) { counts.failed++; continue; }
          const status = STATUSES.has(item.status) ? item.status : "blocked";
          const method = METHODS.has(item.fetchMethod) ? item.fetchMethod : "failed";
          const base = {
            url: item.url, finalUrl: item.finalUrl, domain: item.domain ?? new URL(item.url).hostname,
            title: item.title ?? undefined, httpStatus: item.httpStatus ?? undefined, error: item.error ?? undefined,
            depth: item.depth, retrievedAt: item.retrievedAt ? Date.parse(item.retrievedAt) : Date.now(),
            fetchMethod: method as "plain" | "web_unlocker" | "failed", apifyRunId,
          };
          if (status !== "ok" || !item.text || !item.contentHash) {
            counts.failed++;
            await ctx.runMutation(internal.ingestion.putSource, { ...base, status: status as "blocked" });
            continue;
          }
          const prev = await ctx.runQuery(internal.ingestion.latestForUrl, { url: item.url });
          if (prev?.apifyRunId === apifyRunId) continue; // already stored by an earlier, interrupted collection
          if (prev && prev.contentHash === item.contentHash) {
            counts.unchanged++;
            await ctx.runMutation(internal.ingestion.putSource, { ...base, status: "ok", contentHash: item.contentHash, unchangedId: prev.id });
            continue;
          }
          const textRef = await ctx.storage.store(new Blob([item.text], { type: "text/plain; charset=utf-8" }));
          const changed = !!prev?.contentHash;
          if (changed) counts.changed++; else counts.new++;
          await ctx.runMutation(internal.ingestion.putSource, {
            ...base, status: changed ? "changed" : "ok", contentHash: item.contentHash, textRef,
            ...(changed ? { previousId: prev!.id as Id<"sources"> } : {}),
          });
        }
        if (items.length < PAGE_SIZE) break;
      }
      await ctx.runMutation(internal.ingestion.finish, { apifyRunId, status: "stored", apifyStatus, via, counts });
      if (counts.new + counts.changed > 0) await ctx.scheduler.runAfter(0, internal.extraction.extractPending, {});
      return "stored";
    } catch (e) {
      // Leave the run claimable again: the lease expires and polling or a webhook replay retries.
      await ctx.runMutation(internal.ingestion.release, { apifyRunId, apifyStatus });
      throw e;
    }
  },
});

/** Marks a stored source as rejected (e.g. found afterwards to be off-allowlist content) and drops its candidates. */
export const rejectSource = internalMutation({
  args: { url: v.string(), reason: v.string() },
  handler: async (ctx, { url, reason }) => {
    const rows = await ctx.db.query("sources").withIndex("by_url", (q) => q.eq("url", url)).collect();
    for (const s of rows) {
      await ctx.db.patch(s._id, { status: "rejected_by_policy", error: reason, verification: "unavailable" });
      for (const c of await ctx.db.query("candidates").withIndex("by_source", (q) => q.eq("sourceId", s._id)).collect()) await ctx.db.delete(c._id);
    }
    return { rejected: rows.length };
  },
});
