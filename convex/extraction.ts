// Ingestion step 2: rule-based extraction (spec 6.3 steps 6–7). Runs on every stored page whose
// text is new or changed, records an ExtractionRun with the rule version and validator results,
// and stores the candidates. Matching candidates to programs happens in the next step.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { extract, RULES_VERSION, validate } from "./lib/extract/rules.ts";

const SCHEMA_VERSION = "candidate-v1";
const BATCH = 10;

export const sourceForExtraction = internalQuery({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, { sourceId }) => {
    const source = await ctx.db.get(sourceId);
    if (!source?.textRef) return null;
    const runs = await ctx.db.query("extractionRuns").withIndex("by_source", (q) => q.eq("sourceId", sourceId)).collect();
    return { textRef: source.textRef, domain: source.domain, done: runs.some((r) => r.model === RULES_VERSION) };
  },
});

export const extractSource = internalAction({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, { sourceId }): Promise<Id<"extractionRuns"> | null> => {
    const src: { textRef: Id<"_storage">; domain: string; done: boolean } | null =
      await ctx.runQuery(internal.extraction.sourceForExtraction, { sourceId });
    if (!src || src.done) return null;
    const blob = await ctx.storage.get(src.textRef);
    if (!blob) return null;
    const text = await blob.text();
    const results = extract(text).map((c) => {
      const check = validate(c, text);
      const { evidence, line, status, reasons, kind, ...fields } = c;
      return {
        kind, evidence, line, fields,
        status: check.ok ? status : ("rejected" as const),
        reasons: check.ok ? reasons : [...reasons, check.reason!],
      };
    });
    return ctx.runMutation(internal.extraction.storeExtraction, { sourceId, domain: src.domain, results });
  },
});

export const storeExtraction = internalMutation({
  args: {
    sourceId: v.id("sources"),
    domain: v.string(),
    results: v.array(v.object({
      kind: v.union(v.literal("cost"), v.literal("language"), v.literal("grade_policy"), v.literal("milestone")),
      status: v.union(v.literal("ready"), v.literal("needs_confirmation"), v.literal("rejected")),
      reasons: v.array(v.string()), fields: v.any(), evidence: v.string(), line: v.number(),
    })),
  },
  handler: async (ctx, { sourceId, domain, results }): Promise<Id<"extractionRuns"> | null> => {
    const runs = await ctx.db.query("extractionRuns").withIndex("by_source", (q) => q.eq("sourceId", sourceId)).collect();
    if (runs.some((r) => r.model === RULES_VERSION)) return null; // idempotent
    // A newer rule version replaces older candidates for this page; the old runs stay as history.
    for (const old of await ctx.db.query("candidates").withIndex("by_source", (q) => q.eq("sourceId", sourceId)).collect()) await ctx.db.delete(old._id);
    const count = (s: string) => results.filter((r) => r.status === s).length;
    const runId: Id<"extractionRuns"> = await ctx.db.insert("extractionRuns", {
      sourceId, model: RULES_VERSION, schemaVersion: SCHEMA_VERSION, createdAt: Date.now(),
      validatorResult: { total: results.length, ready: count("ready"), needsConfirmation: count("needs_confirmation"), rejected: count("rejected") },
    });
    const now = Date.now();
    for (const r of results) await ctx.db.insert("candidates", { ...r, sourceId, extractionRunId: runId, domain, ruleVersion: RULES_VERSION, createdAt: now });
    return runId;
  },
});

/** Sources with text that have not been extracted with the current rules. */
export const pendingSources = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("sources").collect();
    const out: Id<"sources">[] = [];
    for (const s of sources) {
      if (!s.textRef || (s.status !== "ok" && s.status !== "changed")) continue;
      const runs = await ctx.db.query("extractionRuns").withIndex("by_source", (q) => q.eq("sourceId", s._id)).collect();
      if (!runs.some((r) => r.model === RULES_VERSION)) out.push(s._id);
    }
    return out;
  },
});

/** Extracts everything pending, a batch at a time, rescheduling itself until done. */
export const extractPending = internalAction({
  args: {},
  handler: async (ctx): Promise<{ extracted: number; remaining: number }> => {
    const pending = await ctx.runQuery(internal.extraction.pendingSources, {});
    const batch = pending.slice(0, BATCH);
    for (const sourceId of batch) await ctx.runAction(internal.extraction.extractSource, { sourceId });
    const remaining = pending.length - batch.length;
    if (remaining > 0) await ctx.scheduler.runAfter(0, internal.extraction.extractPending, {});
    return { extracted: batch.length, remaining };
  },
});
