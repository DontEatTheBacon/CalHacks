// Catalog: institutions and campuses from config, program pages discovered at runtime with
// Bright Data SERP and collected by the Apify Actor, programs identified from those pages.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import config from "../config/institutions.json" with { type: "json" };
import { serp } from "./lib/brightdata.ts";

/** Upserts the configured institutions and their main campuses. Setting stays unclassified until GeoNames evidence exists. */
export const seedInstitutions = internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    for (const inst of config.institutions) {
      const existing = await ctx.db.query("institutions").withIndex("by_slug", (q) => q.eq("slug", inst.slug)).unique();
      const fields = { slug: inst.slug, name: inst.name, country: inst.country as "US" | "GB", domains: inst.domains };
      const id = existing ? (await ctx.db.patch(existing._id, fields), existing._id) : await ctx.db.insert("institutions", { ...fields, coverageStatus: "collecting" });
      if (!existing) created++;
      const campus = (await ctx.db.query("campuses").withIndex("by_institution", (q) => q.eq("institutionId", id)).collect())[0];
      if (!campus) await ctx.db.insert("campuses", { institutionId: id, name: inst.campus.name, address: `${inst.campus.town}, ${inst.campus.admin1}`, settingClass: "unclassified" });
    }
    return { institutions: config.institutions.length, created };
  },
});

/**
 * Finds official program pages for each institution and major with the SERP zone and starts one
 * Actor run over them (depth 0). Fails visibly if Bright Data is not configured (BD-1).
 */
export const discoverPrograms = internalAction({
  args: { slugs: v.optional(v.array(v.string())), perQuery: v.optional(v.number()) },
  handler: async (ctx, { slugs, perQuery }): Promise<{ queries: number; found: number; urls: number; apifyRunId: string; missing: string[] }> => {
    const take = perQuery ?? 3;
    const log: { slug: string; major: string; ok: boolean; attempts: number; links: string[]; error?: string }[] = [];
    const jobs = config.institutions.filter((i) => !slugs || slugs.includes(i.slug))
      .flatMap((inst) => Object.entries(config.majors).map(([major, m]) => ({ inst, major, m })));
    // A few at a time: each SERP call can take 10–60 s.
    for (let i = 0; i < jobs.length; i += 4) {
      await Promise.all(jobs.slice(i, i + 4).map(async ({ inst, major, m }) => {
        const query = `site:${inst.domains[0]} ${inst.country === "GB" ? m.searchGB : m.searchUS}`;
        const r = await serp(query, inst.country as "US" | "GB");
        const own = r.links.filter((l) => inst.domains.some((d) => new URL(l).hostname === d || new URL(l).hostname.endsWith("." + d)));
        log.push({ slug: inst.slug, major, ok: r.ok && own.length > 0, attempts: r.attempts, links: own.slice(0, take), error: r.error });
      }));
    }
    const urls = [...new Set(log.flatMap((l) => l.links))];
    await ctx.runMutation(internal.catalog.recordDiscovery, { log });
    if (!urls.length) throw new Error("Program discovery found no official pages; see actionHistory for each query");
    const run: { apifyRunId: string } = await ctx.runAction(internal.ingestion.startRun, { startUrls: urls, label: "program pages", maxDepth: 0, maxPages: urls.length });
    return { queries: log.length, found: log.filter((l) => l.ok).length, urls: urls.length, apifyRunId: run.apifyRunId, missing: log.filter((l) => !l.ok).map((l) => `${l.slug}/${l.major}: ${l.error ?? "none on own domain"}`) };
  },
});

export const recordDiscovery = internalMutation({
  args: { log: v.any() },
  handler: async (ctx, { log }) => {
    await ctx.db.insert("actionHistory", { actor: "system", action: "program_discovery", detail: log, at: Date.now() });
  },
});

// ---------------------------------------------------------------------------------------------
// Programs and published facts

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { degreeKey, identifyProgram } from "./lib/catalog/programs.ts";

type Inst = (typeof config.institutions)[number] & { otherCampusMarkers?: string[] };
const onDomain = (host: string, domains: string[]) => domains.some((d) => host === d || host.endsWith("." + d));

async function institutionFor(ctx: MutationCtx, host: string) {
  const conf = (config.institutions as Inst[]).find((i) => onDomain(host, i.domains));
  if (!conf) return null;
  const doc = await ctx.db.query("institutions").withIndex("by_slug", (q) => q.eq("slug", conf.slug)).unique();
  return doc ? { conf, doc } : null;
}

/** Creates or updates programs from collected pages whose title names a bachelor's degree in a configured major. */
export const identifyPrograms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sources = (await ctx.db.query("sources").collect()).filter((s) => (s.status === "ok" || s.status === "changed") && s.title);
    let created = 0, updated = 0;
    for (const src of sources) {
      const inst = await institutionFor(ctx, src.domain);
      if (!inst) continue;
      const match = identifyProgram({ title: src.title!, url: src.url }, config.majors, inst.conf.otherCampusMarkers ?? []);
      if (!match) continue;
      const campus = (await ctx.db.query("campuses").withIndex("by_institution", (q) => q.eq("institutionId", inst.doc._id)).collect())[0];
      // Same program on several pages (catalog and department site): one record per
      // institution + subject + degree family for single-subject programs, per name for joint ones.
      const existing = (await ctx.db.query("programs").withIndex("by_institution", (q) => q.eq("institutionId", inst.doc._id)).collect())
        .find((p) => match.joint
          ? p.name.toLowerCase() === match.name.toLowerCase()
          : !p.joint && p.taxonomyCode === match.major && degreeKey(p.degree === "not stated" ? null : p.degree) === degreeKey(match.degree));
      // The same program can have a page per entry year; keep the latest year.
      if (existing && ((existing.entryYear ?? 0) > (match.entryYear ?? 0) || existing.sourceId === src._id)) continue;
      // Between two pages of the same entry year, keep the first one found (stable).
      if (existing && (existing.entryYear ?? 0) === (match.entryYear ?? 0)) continue;
      const evidenceId = await ctx.db.insert("evidence", { sourceId: src._id, excerpt: src.title!, location: "page title" });
      const fields = {
        institutionId: inst.doc._id, campusId: campus?._id, name: match.name, degree: match.degree ?? "not stated",
        taxonomyCode: match.major, officialUrl: src.finalUrl ?? src.url, joint: match.joint, entryYear: match.entryYear ?? undefined,
        sourceId: src._id, evidenceId, status: (match.degree ? "verified" : "unverified") as "verified" | "unverified",
      };
      if (existing) {
        await ctx.db.patch(existing._id, { ...fields, version: existing.version + 1 });
        updated++;
      } else {
        await ctx.db.insert("programs", { ...fields, version: 1 });
        created++;
      }
    }
    return { created, updated };
  },
});

type CostFields = { amount: number; currency: string; itemType: string | null; period: string; applicantCategory: string; academicYear: string | null; label: string | null };
/** A row label that names a particular course ("BSc Economics and Politics", "MArch Year 1"). */
const namesACourse = (label: string | null) => !!label && /\b(BSc|BA|BS|B\.S\.|B\.A\.|BEng|MEng|MSci|MChem|MPharm(acy)?|MArch|MComp|LLB|MBChB|BAEcon)\b/.test(label);
const subjectOf = (major: string | undefined) => (major ? config.majors[major as keyof typeof config.majors]?.match[0] : undefined);

/** Which programs a cost row names: its label must contain the program's subject. */
function programsNamedBy(label: string | null, programs: Doc<"programs">[]) {
  if (!label) return [];
  const l = label.toLowerCase();
  return programs.filter((p) => {
    const subj = subjectOf(p.taxonomyCode);
    if (!subj || !l.includes(subj)) return false;
    // "BSc Economics and Politics" names the joint program, not the single-subject one.
    return p.joint ? l.includes(p.name.toLowerCase().replace(/\b(bsc|ba|bs|hons)\b/g, "").trim()) : !/\b(and|with|&)\b/.test(l.replace(subj, ""));
  });
}

/**
 * Publishes ready candidates as requirements, cost items and milestones, scoped to a program when
 * the fact is on the program's own page or its row names the program, otherwise to the institution.
 * Institution-wide tuition is published only when the institution's pages give one amount per
 * academic year; several amounts (subject bands) stay unpublished, so programs show "needs confirmation".
 * Idempotent; facts whose candidate disappeared (re-extraction) are removed.
 */
export const publishFacts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts = { requirements: 0, costItems: 0, milestones: 0, removed: 0, withheldAmbiguousTuition: 0, withheldConflicting: 0, duplicates: 0, otherCourse: 0 };
    for (const table of ["requirements", "costItems", "milestones"] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        if (!row.candidateId) continue;
        const c = await ctx.db.get(row.candidateId);
        if (!c || c.status !== "ready") { await ctx.db.delete(row._id); counts.removed++; }
      }
    }
    // Candidates live on subdomains (admissions.msu.edu), so group by suffix after one read.
    const allReady = (await ctx.db.query("candidates").collect()).filter((c) => c.status === "ready" && c.kind !== "grade_policy");
    for (const instDoc of await ctx.db.query("institutions").collect()) {
      const programs = await ctx.db.query("programs").withIndex("by_institution", (q) => q.eq("institutionId", instDoc._id)).collect();
      const bySource = new Map(programs.filter((p) => p.sourceId).map((p) => [p.sourceId as Id<"sources">, p]));
      const ready = allReady.filter((c) => onDomain(c.domain, instDoc.domains));
      // Conflicting values for one scope are withheld; identical values are published once.
      const scopeKey = (c: Doc<"candidates">) => (bySource.get(c.sourceId)?._id ?? "institution") as string;
      const langScores = new Map<string, Set<number>>();
      for (const c of ready.filter((c) => c.kind === "language")) {
        const f = c.fields as { test: string; score: number };
        const k = `${scopeKey(c)}:${f.test}`;
        langScores.set(k, (langScores.get(k) ?? new Set()).add(f.score));
      }
      const seen = new Set<string>();
      const instTuition = new Map<string, Set<number>>();
      for (const c of ready.filter((c) => c.kind === "cost")) {
        const f = c.fields as CostFields;
        if (f.itemType === "tuition" && !bySource.has(c.sourceId) && programsNamedBy(f.label, programs).length === 0 && !namesACourse(f.label)) {
          const k = `${f.currency}:${f.academicYear}`;
          instTuition.set(k, (instTuition.get(k) ?? new Set()).add(f.amount));
        }
      }
      for (const c of ready) {
        if (await ctx.db.query("costItems").withIndex("by_candidate", (q) => q.eq("candidateId", c._id)).first()) continue;
        if (await ctx.db.query("requirements").withIndex("by_candidate", (q) => q.eq("candidateId", c._id)).first()) continue;
        if (await ctx.db.query("milestones").withIndex("by_candidate", (q) => q.eq("candidateId", c._id)).first()) continue;
        const onPage = bySource.get(c.sourceId);
        const f0 = c.fields as Record<string, unknown>;
        if (c.kind === "language") {
          const k = `${scopeKey(c)}:${f0.test}`;
          if ((langScores.get(k)?.size ?? 0) > 1) { counts.withheldConflicting++; continue; }
          if (seen.has(`lang:${k}`)) { counts.duplicates++; continue; }
          seen.add(`lang:${k}`);
        }
        const dupKey = c.kind === "cost" ? `cost:${scopeKey(c)}:${f0.label}:${f0.amount}:${f0.academicYear}` : c.kind === "milestone" ? `ms:${scopeKey(c)}:${f0.dateStart ?? f0.dateText}:${f0.round ?? f0.cue}:${f0.scholarship}` : null;
        if (dupKey) {
          if (seen.has(dupKey)) { counts.duplicates++; continue; }
          seen.add(dupKey);
        }
        const evidenceId = await ctx.db.insert("evidence", { sourceId: c.sourceId, excerpt: c.evidence, location: `line ${c.line}`, extractionRunId: c.extractionRunId });
        const targets: (Id<"programs"> | undefined)[] = onPage ? [onPage._id] : [undefined];
        if (c.kind === "cost") {
          const f = c.fields as CostFields;
          const named = onPage ? [] : programsNamedBy(f.label, programs);
          if (named.length) targets.splice(0, 1, ...named.map((p) => p._id));
          else if (!onPage && namesACourse(f.label)) {
            // The row is about a specific course we have no program for: not institution-wide.
            await ctx.db.delete(evidenceId);
            counts.otherCourse++;
            continue;
          }
          else if (!onPage && f.itemType === "tuition" && (instTuition.get(`${f.currency}:${f.academicYear}`)?.size ?? 0) > 1) {
            await ctx.db.delete(evidenceId);
            counts.withheldAmbiguousTuition++;
            continue;
          }
          for (const programId of targets) {
            await ctx.db.insert("costItems", {
              institutionId: instDoc._id, programId, candidateId: c._id, scope: programId ? "program" : "institution",
              kind: f.itemType === "tuition" ? "tuition" : f.itemType === "mandatory_fee" ? "fee" : f.itemType === "housing_estimate" ? "housing" : "living",
              amount: f.amount, currency: f.currency, period: f.period as "annual", applicantCategory: f.applicantCategory,
              evidenceId, academicYear: f.academicYear ?? undefined, inclusions: f.label ?? undefined,
            });
            counts.costItems++;
          }
        } else if (c.kind === "language") {
          const f = c.fields as { test: string; score: number; mayVary: boolean };
          await ctx.db.insert("requirements", {
            institutionId: instDoc._id, programId: targets[0], candidateId: c._id, scope: targets[0] ? "program" : "institution",
            type: "language", text: `${f.test === "ielts" ? "IELTS" : f.test === "toefl_ibt" ? "TOEFL iBT" : "Duolingo English Test"} ${f.score}${f.mayVary ? " (some courses may require more)" : ""}`,
            threshold: String(f.score), scale: f.test, evidenceId, verification: "verified", version: 1,
          });
          counts.requirements++;
        } else if (c.kind === "milestone") {
          const f = c.fields as { dateText: string; dateStart: string | null; cutoffTime: string | null; timezone: string | null; round: string | null; cue: string; scholarship: boolean };
          await ctx.db.insert("milestones", {
            institutionId: instDoc._id, programId: targets[0], candidateId: c._id, scope: targets[0] ? "program" : "institution",
            scholarship: f.scholarship, category: f.scholarship ? "scholarship" : (f.round ?? f.cue).toLowerCase(), officialName: c.evidence.slice(0, 200),
            dateStart: f.dateStart ?? undefined, dateType: "verified_hard_deadline", publishedTimezone: f.timezone ?? undefined,
            cutoffTime: f.cutoffTime ?? undefined, originalWording: c.evidence, mandatoryState: "unknown", evidenceId, verification: "verified", version: 1,
          });
          counts.milestones++;
        }
      }
    }
    return counts;
  },
});

/** Removes all published facts (and their evidence rows) so publishFacts can rebuild them. Admin use only. */
export const unpublishAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    let removed = 0;
    for (const table of ["requirements", "costItems", "milestones"] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        if (!row.candidateId) continue;
        if (row.evidenceId) await ctx.db.delete(row.evidenceId);
        await ctx.db.delete(row._id);
        removed++;
      }
    }
    return { removed };
  },
});

// ---------------------------------------------------------------------------------------------
// Program view: program facts first, institution-wide facts otherwise, unknowns stated.

import { internalQuery, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/access";

async function assemble(ctx: QueryCtx, p: Doc<"programs">) {
  const inst = (await ctx.db.get(p.institutionId))!;
  const campus = p.campusId ? await ctx.db.get(p.campusId) : null;
  const wide = <R extends { scope?: "institution" | "program" }>(rows: R[]) => rows.filter((r) => r.scope === "institution");
  const costRows = [
    ...(await ctx.db.query("costItems").withIndex("by_program", (q) => q.eq("programId", p._id)).collect()),
    ...wide(await ctx.db.query("costItems").withIndex("by_institution", (q) => q.eq("institutionId", inst._id)).collect()),
  ];
  const reqRows = [
    ...(await ctx.db.query("requirements").withIndex("by_program", (q) => q.eq("programId", p._id)).collect()),
    ...wide(await ctx.db.query("requirements").withIndex("by_institution", (q) => q.eq("institutionId", inst._id)).collect()),
  ];
  const msRows = [
    ...(await ctx.db.query("milestones").withIndex("by_program", (q) => q.eq("programId", p._id)).collect()),
    ...wide(await ctx.db.query("milestones").withIndex("by_institution", (q) => q.eq("institutionId", inst._id)).collect()),
  ];
  const withSource = async (evidenceId: Id<"evidence"> | undefined) => {
    const ev = evidenceId ? await ctx.db.get(evidenceId) : null;
    const src = ev ? await ctx.db.get(ev.sourceId) : null;
    return { excerpt: ev?.excerpt ?? null, sourceUrl: src?.finalUrl ?? src?.url ?? null, retrievedAt: src?.retrievedAt ?? null, fetchMethod: src?.fetchMethod ?? null };
  };
  const costs = await Promise.all(costRows.map(async (c) => ({
    kind: c.kind, amount: c.amount ?? null, currency: c.currency ?? null, period: c.period, academicYear: c.academicYear ?? null,
    scope: c.scope, label: c.inclusions ?? null, ...(await withSource(c.evidenceId)),
  })));
  const requirements = await Promise.all(reqRows.map(async (r) => ({ type: r.type, text: r.text, scope: r.scope, ...(await withSource(r.evidenceId)) })));
  const milestones = await Promise.all(msRows.map(async (m) => ({
    category: m.category, dateStart: m.dateStart ?? null, cutoffTime: m.cutoffTime ?? null, timezone: m.publishedTimezone ?? null,
    scholarship: m.scholarship ?? false, scope: m.scope, ...(await withSource(m.evidenceId)),
  })));
  const tuition = costs.filter((c) => c.kind === "tuition");
  const unknowns: string[] = [];
  if (!tuition.length) unknowns.push("international tuition");
  if (!costs.some((c) => c.kind === "living" || c.kind === "housing")) unknowns.push("living costs");
  if (!requirements.some((r) => r.type === "language")) unknowns.push("English language minimum");
  if (!milestones.some((m) => !m.scholarship)) unknowns.push("application deadline");
  unknowns.push("grade requirement for Indonesian students");
  const source = p.evidenceId ? await withSource(p.evidenceId) : null;
  return {
    id: p._id, name: p.name, degree: p.degree, major: p.taxonomyCode ?? null, joint: p.joint ?? false, entryYear: p.entryYear ?? null,
    officialUrl: p.officialUrl ?? null, status: p.status,
    institution: { id: inst._id, name: inst.name, country: inst.country },
    campus: campus ? { name: campus.name ?? null, settingClass: campus.settingClass } : null,
    costs, requirements, milestones, unknowns, programSource: source,
  };
}

/** Any signed-in user: the catalog is public information (spec 3.1). */
export const listPrograms = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return Promise.all((await ctx.db.query("programs").collect()).map((p) => assemble(ctx, p)));
  },
});

export const reviewPrograms = internalQuery({
  args: {},
  handler: async (ctx) => Promise.all((await ctx.db.query("programs").collect()).map((p) => assemble(ctx, p))),
});

/** Development reset: removes programs and published facts so both can be rebuilt from sources. */
export const resetPrograms = internalMutation({
  args: {},
  handler: async (ctx) => {
    let programs = 0;
    for (const p of await ctx.db.query("programs").collect()) {
      if (p.evidenceId) await ctx.db.delete(p.evidenceId);
      await ctx.db.delete(p._id);
      programs++;
    }
    return { programs };
  },
});

/** After extraction: rebuild programs from new pages, then republish facts. */
export const refresh = internalAction({
  args: {},
  handler: async (ctx): Promise<{ programs: unknown; facts: unknown }> => {
    const programs = await ctx.runMutation(internal.catalog.identifyPrograms, {});
    const facts = await ctx.runMutation(internal.catalog.publishFacts, {});
    return { programs, facts };
  },
});
