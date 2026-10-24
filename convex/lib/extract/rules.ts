// Rule-based extraction (spec 6.3 step 6, BT-1). Deterministic pattern rules over the cleaned page
// text stored by the crawler. Every candidate carries a verbatim excerpt from that text. A candidate
// is "ready" only when nothing about it has to be guessed; otherwise it is "needs_confirmation" with
// the reasons. Page text is data: nothing in it changes what these rules do.

export const RULES_VERSION = "rules-2026-10-24.7";

export type Category = "international" | "out_of_state" | "domestic" | "unknown";
export type ItemType = "tuition" | "mandatory_fee" | "living_estimate" | "housing_estimate";
export type Period = "annual" | "term" | "total" | "unknown";

type Base = { evidence: string; line: number; status: "ready" | "needs_confirmation"; reasons: string[] };
export type CostCandidate = Base & {
  kind: "cost"; amount: number; currency: "USD" | "GBP"; itemType: ItemType | null; period: Period;
  applicantCategory: Category; academicYear: string | null; label: string | null;
};
export type LanguageCandidate = Base & { kind: "language"; test: "ielts" | "toefl_ibt" | "duolingo"; score: number; mayVary: boolean };
export type GradeCandidate = Base & { kind: "grade_policy"; qualification: string; threshold: string; scale: string | null; foundationMentioned: boolean };
export type MilestoneCandidate = Base & {
  kind: "milestone"; dateText: string; dateStart: string | null; cutoffTime: string | null; timezone: string | null; round: string | null; cue: string; scholarship: boolean; entryYear: number | null;
};
export type Candidate = CostCandidate | LanguageCandidate | GradeCandidate | MilestoneCandidate;

const MONEY = /(US\$|\$|£|USD\s?|GBP\s?)\s?(\d{1,3}(?:,\d{3})+|\d{3,6})(?:\.\d{2})?(?!\d)/g;
const INTL = /\b(international|overseas|non[- ]?uk)\b/i;
// US rate for students from other states. Not assumed to be the international rate.
const OUT_OF_STATE = /\b(non[- ]?resident|non[- ]?pa resident|out[- ]of[- ]state|nonresident)\b/i;
const DOMESTIC = /\b(home (fee )?(status|students?)|fees for home|in[- ]state|pa resident|state resident|uk students?)\b/i;
const YEAR_RANGE = /\b(20\d\d)\s?[/–-]\s?(20)?(\d\d)\b/;

function category(text: string | null | undefined): Category {
  if (!text) return "unknown";
  if (INTL.test(text)) return "international";
  // A table header that is just "Home" or "UK" means the domestic rate.
  if (/^(home|uk|home\s*\/\s*uk|home \(uk\)|england|scotland)$/i.test(text.trim())) return "domestic";
  // "Non-PA Resident" contains "PA Resident": test out-of-state before domestic.
  if (OUT_OF_STATE.test(text)) return "out_of_state";
  if (DOMESTIC.test(text)) return "domestic";
  return "unknown";
}

function itemType(text: string): ItemType | null {
  const t = text.toLowerCase();
  if (/\btotal\b|cost of attendance|saving|differential|discount|scholarship|waiver|reduction|deposit|after aid|average|net price|median|loan|repay|earning|salary|income|threshold|worth|award/.test(t)) return null;
  if (/housing|accommodation|residence hall|room\b/.test(t)) return "housing_estimate";
  if (/meal|food|living|personal|books|transport|miscellaneous/.test(t)) return "living_estimate";
  if (/tuition|course fee|annual fee|\bband \d/.test(t)) return "tuition";
  if (/\bfees?\b/.test(t)) return "mandatory_fee";
  return null;
}

function period(text: string): Period {
  const t = text.toLowerCase();
  if (/per credit|credit hour|per module/.test(t) && !/two semesters|academic year/.test(t)) return "unknown";
  // A cost stated for a named academic year ("Estimated 2026-27 undergraduate cost") is per year.
  if (/two semesters|both semesters|per academic year|for the academic year/.test(t) || (/\b20\d\d\s?[-/–]\s?\d{2}\b/.test(t) && /cost|tuition|fees?/.test(t))) return "annual";
  if (/per (term|semester)|each (term|semester)/.test(t)) return "term";
  if (/annual|per year|a year|each year|yearly|per academic year|\/\s?year|one academic year/.test(t)) return "annual";
  if (/\btotal\b|whole (course|degree)/.test(t)) return "total";
  return "unknown";
}

const HAS_MONEY = /(US\$|\$|£|USD\s?|GBP\s?)\s?\d/;
const isHeading = (line: string) => line.length <= 120 && !HAS_MONEY.test(line) && !/[.!]$/.test(line) && !line.includes(" | ");
const cells = (line: string) => line.split(" | ").map((c) => c.trim());

function money(line: string) {
  const out: { amount: number; currency: "USD" | "GBP"; index: number; raw: string }[] = [];
  MONEY.lastIndex = 0;
  for (const m of line.matchAll(MONEY)) {
    const amount = Number(m[2]!.replace(/,/g, ""));
    if (amount < 100) continue;
    out.push({ amount, currency: m[1]!.includes("£") || m[1]!.startsWith("GBP") ? "GBP" : "USD", index: m.index!, raw: m[0] });
  }
  return out;
}

/** Column headers for a table row: the nearest earlier pipe row without money, or the run of short lines just above. */
function columnHeaders(lines: string[], i: number, width: number): string[] | null {
  for (let k = i - 1; k >= Math.max(0, i - 12); k--) {
    const l = lines[k]!;
    if (l.includes(" | ") && money(l).length === 0) {
      const c = cells(l);
      return c.length === width ? c : c.length === width - 1 ? ["", ...c] : null;
    }
    if (!l.includes(" | ")) {
      // Penn State style: "PA Resident" / "Non-PA Resident" on separate lines above the table.
      const run: string[] = [];
      for (let j = k; j >= Math.max(0, k - (width - 2)); j--) if (!lines[j]!.includes(" | ") && lines[j]!.length < 40) run.unshift(lines[j]!);
      if (run.length === width - 1) return ["", ...run];
      return null;
    }
  }
  return null;
}

/** Category set by the most recent heading that names one (e.g. "Fees for overseas students"). */
function sectionCategory(lines: string[], i: number): { cat: Category; heading: string | null } {
  for (let k = i - 1; k >= 0; k--) {
    const l = lines[k]!;
    if (!isHeading(l)) continue;
    const c = category(l);
    if (c !== "unknown") return { cat: c, heading: l };
  }
  return { cat: "unknown", heading: null };
}

function nearbyHeadings(lines: string[], i: number, n = 12): string[] {
  const out: string[] = [];
  for (let k = i - 1; k >= 0 && out.length < n; k--) if (isHeading(lines[k]!)) out.push(lines[k]!);
  return out;
}


const NOT_STANDARD = /placement|study abroad|exchange|foundation|pre-?sessional|part[- ]time|postgraduate|master['’]?s|\bphd\b|research|per credit|summer|online/i;
const EXTRA = /printing|photocopying|stationery|equipment|field ?trips?|trips? and visits|binding|subscription|graduation/i;
const STANDARD = /tuition|fees for (overseas|international)|\bband \d|undergraduate/i;
/** Generic table column headers carry no scope. */
const COLUMN_HEADER = /^(course|courses|annual fee|fees?|amount|cost|type of placement|programme|program|subject|level)$/i;
/** A line directly above an amount is that row's label, not a section heading. */
const isRowLabel = (lines: string[], k: number) => k + 1 < lines.length && money(lines[k + 1]!).length > 0 && !lines[k + 1]!.includes(" | ");

/**
 * Whether this amount belongs to something other than standard full-time first-degree tuition
 * (placement year, foundation, part-time, postgraduate…). The row label decides first; otherwise
 * the most recent section heading that sets a scope.
 */
function scopeExclusion(lines: string[], i: number, label: string | null): string | null {
  if (label && NOT_STANDARD.test(label)) return label;
  for (let k = i - 1; k >= 0; k--) {
    const l = lines[k]!;
    if (!isHeading(l) || isRowLabel(lines, k) || l === label || COLUMN_HEADER.test(l)) continue;
    if (NOT_STANDARD.test(l)) return l;
    if (STANDARD.test(l)) return null;
  }
  return null;
}


/** An amount-only line ("£31,700 |"): the amount is the whole content. */
const amountOnly = (line: string) => {
  const t = line.replace(/\s*\|\s*$/, "").replace(/\s+\d$/, "").trim();
  const m = money(t);
  return m.length === 1 && t === m[0]!.raw.trim();
};

/**
 * Vertical table: N header lines followed by N amount-only lines ("Home |", "International |",
 * "£10,050 |", "£31,700 |"). Returns the header for the amount at line i, matched by position.
 */
function verticalHeader(lines: string[], i: number): string | null {
  if (!amountOnly(lines[i]!)) return null;
  let s = i, e = i;
  while (s > 0 && amountOnly(lines[s - 1]!)) s--;
  while (e + 1 < lines.length && amountOnly(lines[e + 1]!)) e++;
  const n = e - s + 1;
  if (n < 2 || s - n < 0) return null;
  const heads = lines.slice(s - n, s);
  if (heads.some((h) => money(h).length || h.length > 60)) return null;
  return heads[i - s]!.replace(/\s*\|\s*$/, "").trim();
}

function costs(lines: string[]): CostCandidate[] {
  const out: CostCandidate[] = [];
  // Fallback: an academic year stated near the top of the page ("…in the 2027/28 academic year").
  const pageYear = lines.slice(0, 15).map((l) => l.match(YEAR_RANGE)).find(Boolean) ?? null;
  lines.forEach((line, i) => {
    const found = money(line);
    if (!found.length) return;
    const headings = nearbyHeadings(lines, i);
    const section = sectionCategory(lines, i);
    const yearMatch = [line, ...headings].map((h) => h.match(YEAR_RANGE)).find(Boolean);
    const ym = yearMatch ?? pageYear;
    const academicYear = ym ? `${ym[1]}/${ym[3]}` : null;
    const pipe = line.includes(" | ") ? cells(line) : null;
    const headers = pipe ? columnHeaders(lines, i, pipe.length) : null;
    // Label: first table cell, or the text before the amount, or the line above a bare amount.
    const before = line.slice(0, found[0]!.index).replace(/[:\-–|]\s*$/, "").trim();
    const vertical = verticalHeader(lines, i);
    const label = vertical ?? (pipe ? pipe[0]! : before.length > 2 ? before : i > 0 && !money(lines[i - 1]!).length ? lines[i - 1]! : null);

    const isTotal = /\btotal\b|cost of attendance|saving|differential|discount|scholarship|waiver|reduction|deposit|after aid|average|net price|median|loan|repay|earning|salary|income|threshold|worth|award/i.test(`${label ?? ""} ${line}`);
    // Nearest heading that states a cost type / period; the row itself wins over headings.
    const typeFromHeadings = headings.map(itemType).find(Boolean) ?? null;
    const periodFromHeadings = headings.map(period).find((p) => p !== "unknown") ?? "unknown";
    const special = scopeExclusion(lines, i, label);
    found.forEach((m) => {
      const reasons: string[] = [];
      const header = pipe && headers ? headers[pipe.findIndex((c) => c.includes(m.raw.trim()))] ?? null : null;
      const cat = [header, label].map(category).find((c) => c !== "unknown") ?? section.cat;
      const ctx = [label ?? "", header ?? "", ...headings, line].join(" \n ");
      // A row that is a course extra (printing, trips…) never inherits a cost type from its heading.
      const type = isTotal || EXTRA.test(`${label ?? ""} ${line}`) ? null : itemType([label ?? "", line].join(" ")) ?? typeFromHeadings;
      const ownPeriod = period([line, label ?? "", header ?? ""].join(" "));
      const per = ownPeriod !== "unknown" ? ownPeriod : periodFromHeadings;
      if (special) reasons.push(`listed under "${special.slice(0, 60)}", not standard first-year undergraduate tuition`);
      if (cat === "unknown") reasons.push("page does not say whether this applies to international students");
      if (cat === "domestic") reasons.push("applies to home or in-state students, not international applicants");
      if (cat === "out_of_state") reasons.push("US out-of-state rate; the page does not say international students pay it");
      if (!type) reasons.push(isTotal ? "total, saving, discount, loan or salary figure, not a single cost item" : "cost type unclear or a course extra");
      if (type === "mandatory_fee" && m.amount >= 5000) reasons.push("large amount labelled only as a fee; it may be tuition for some courses");
      if (per === "unknown") reasons.push(/per credit|credit hour/i.test(`${line} ${label ?? ""} ${headings[0] ?? ""}`) ? "priced per credit; needs a credit count" : "period (per year, term or total) not stated");
      if (pipe && !headers && found.length > 1) reasons.push("table columns could not be matched to headers");
      out.push({
        kind: "cost", amount: m.amount, currency: m.currency, itemType: type, period: per, applicantCategory: cat,
        academicYear, label, evidence: line, line: i, status: reasons.length ? "needs_confirmation" : "ready", reasons,
      });
    });
  });
  return out;
}

// Split after . ! ? unless the period ends an abbreviation such as "p.m." or "e.g.".
const sentences = (line: string) =>
  line.split(/(?<=[.!?])(?<!\b(?:[ap]\.m|e\.g|i\.e|etc|approx|St|Dr|No|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.)\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim()).filter(Boolean);

function language(lines: string[]): LanguageCandidate[] {
  const out: LanguageCandidate[] = [];
  const tests = [
    { test: "ielts" as const, re: /\bIELTS\b(?:\s+Academic)?[^.\n]{0,60}?\b([4-9](?:\.[05])?)\b/i, min: 4, max: 9 },
    { test: "toefl_ibt" as const, re: /\bTOEFL\b(?:\s+iBT)?[^.\n]{0,60}?\b(\d{2,3})\b/i, min: 40, max: 120 },
    { test: "duolingo" as const, re: /\bDuolingo\b(?:\s+English Test)?[^.\n]{0,60}?\b(\d{2,3})\b/i, min: 60, max: 160 },
  ];
  lines.forEach((line, i) => {
    for (const s of sentences(line)) {
      for (const t of tests) {
        const m = s.match(t.re);
        if (!m) continue;
        const score = Number(m[1]);
        if (!(score >= t.min && score <= t.max)) continue;
        const reasons: string[] = [];
        if (!/minimum|at least|overall|required|accept|score of|or above|or higher|equivalent/i.test(s)) reasons.push("sentence does not say this is a minimum requirement");
        // The caveat is often in the next sentence of the same paragraph.
        const mayVary = /may require|some (departments|courses|programmes|programs)|vary|depend|higher score/i.test(line);
        out.push({ kind: "language", test: t.test, score, mayVary, evidence: s, line: i, status: reasons.length ? "needs_confirmation" : "ready", reasons });
      }
    }
  });
  return out;
}

function gradePolicy(lines: string[]): GradeCandidate[] {
  const out: GradeCandidate[] = [];
  lines.forEach((line, i) => {
    const INDO = /\b(Indonesia\w*|SMA|Sekolah Menengah|Senior High School)\b/;
    if (!INDO.test(line)) return;
    for (const s of sentences(line)) {
      if (!INDO.test(s) && !/\b(entry|requ\w*ments?|range)\b/i.test(s)) continue;
      const m = s.match(/\b(\d{2}(?:\.\d)?)\s?(?:-|–|to)\s?(\d{2,3}(?:\.\d)?)\b|\b(\d{2}(?:\.\d)?)\s?(%|\/\s?100|out of 100)|\b(?:average|overall|minimum)(?: of)?\s+(\d{2}(?:\.\d)?)\b/);
      if (!m) continue;
      const threshold = m[1] ? `${m[1]}-${m[2]}` : m[3] ? `${m[3]}${m[4]!.startsWith("%") ? "%" : ""}` : m[5]!;
      const reasons: string[] = [];
      if (m[1]) reasons.push("a range is published; the threshold for a specific course needs confirmation");
      if (!INDO.test(s)) reasons.push("the sentence relies on the surrounding text for the qualification");
      if (/\balso\b/i.test(s)) reasons.push("condition continues from the previous sentence");
      if (/garuda|certain schools|specific schools|selected schools/i.test(s)) reasons.push("applies only to some schools");
      if (/faculty of|courses within|excluding|\bonly\b|courses in|for entry to/i.test(s)) reasons.push("applies only to some courses");
      if (/\b(AST|aptitude)\b/i.test(s)) reasons.push("tied to another test (AST)");
      if (/foundation/i.test(s)) reasons.push("a foundation route is mentioned");
      out.push({
        kind: "grade_policy", qualification: /SMA|Senior High School/.test(s) ? "Indonesian Senior High School Diploma (SMA)" : "Indonesian qualification",
        threshold, scale: m[4] || /%|\/\s?100/.test(s) || Number(m[1] ?? m[3] ?? m[5]) > 10 ? "0-100" : null,
        foundationMentioned: /foundation/i.test(s), evidence: s, line: i, status: reasons.length ? "needs_confirmation" : "ready", reasons,
      });
    }
  });
  return out;
}

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec";
const DATE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\.?(?:,?\\s+(20\\d\\d))?\\b|\\b(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d\\d))?\\b`, "gi");
const DEADLINE = /\b(deadline|due(?! to\b)|apply by|applications? (close|closes|must be (received|submitted))|closing date|submit(ted)? by|no later than|priority date|early action|early decision|regular decision|restrictive early action|equal consideration)\b/i;
const POSTGRAD = /master['’]?s|postgraduate|\bphd\b|doctoral|\bMBA\b|\bPGT\b|\bPGR\b/i;
const MONTH_NUM: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function milestones(lines: string[], asOf: string | null): MilestoneCandidate[] {
  const out: MilestoneCandidate[] = [];
  lines.forEach((line, i) => {
    for (const s of sentences(line)) {
      const cue = s.match(DEADLINE);
      if (!cue) continue;
      DATE.lastIndex = 0;
      for (const m of s.matchAll(DATE)) {
        const day = Number(m[1] ?? m[5]);
        const month = MONTH_NUM[(m[2] ?? m[4])!.slice(0, 3).toLowerCase()]!;
        const year = m[3] ?? m[6] ?? null;
        if (!(day >= 1 && day <= 31)) continue;
        const reasons: string[] = [];
        if (!year) reasons.push("no year published with the date");
        const iso = year ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
        if (iso && asOf && iso < asOf) reasons.push("date had already passed when the page was retrieved (earlier admissions cycle?)");
        if (new RegExp(`\\bbetween\\s+(?:the\\s+)?${m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(s)) reasons.push("start of a date range, not a deadline");
        if (/\b(spring|winter|summer|january)\s+(?:20\d\d\s+)?(term|semester|intake|entry|start|admission)\b/i.test(s)) reasons.push("applies to a spring, winter or summer start");
        const nearby = lines.slice(Math.max(0, i - 8), i).filter((l) => isHeading(l)).join(" ");
        if (POSTGRAD.test(s) || POSTGRAD.test(nearby)) reasons.push("applies to postgraduate study");
        if (/medicine|dentistry|veterinary|oxford|cambridge|nursing|midwifery|architecture/i.test(s)) reasons.push("applies only to some courses");
        if (/transfer|graduate admission/i.test(s)) reasons.push("applies to transfer or graduate applicants");
        const entry = s.match(/\b(?:starting in\s+|start(?:ing)?\s+(?:in\s+)?(?:september|autumn|fall)\s+)(20\d\d)\b|\b(20\d\d) entry\b/i);
        const entryYear = entry ? Number(entry[1] ?? entry[2]) : null;
        if (entryYear && year && Number(year) > entryYear) reasons.push(`the page says this is for ${entryYear} entry, but the date is later than that entry year (contradictory or outdated page)`);
        const round = s.match(/\b(restrictive early action|early action|early decision (?:I{1,2}|1|2)?|regular decision|equal consideration)\b/i)?.[0] ?? null;
        const time = s.match(/\b\d{1,2}(?::\d{2})?\s?(?:a\.m\.|p\.m\.|am\b|pm\b)|\b\d{1,2}:\d{2}\b/i)?.[0] ?? null;
        const tz = s.match(/\b(ET|EST|EDT|CT|CST|PT|PST|GMT|BST|UK time|Eastern Time|Central Time|Pacific Time)\b/)?.[0] ?? null;
        out.push({
          kind: "milestone", dateText: m[0], dateStart: iso,
          cutoffTime: time, timezone: tz, round, cue: cue[0], scholarship: /scholarship|award|bursary|grant/i.test(s), entryYear, evidence: s, line: i,
          status: reasons.length ? "needs_confirmation" : "ready", reasons,
        });
      }
    }
  });
  return out;
}

/**
 * All candidates from one page. Deterministic: the same text and retrieval date always give the
 * same result. `asOf` (YYYY-MM-DD, the retrieval date) marks dates already past as not current.
 */
export function extract(text: string, asOf: string | null = null): Candidate[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return [...costs(lines), ...language(lines), ...gradePolicy(lines), ...milestones(lines, asOf)];
}

/**
 * Deterministic validator (spec 8.2). The excerpt must occur verbatim in the source text and the
 * extracted value must occur inside the excerpt. Anything failing is rejected, never repaired.
 */
export function validate(c: Candidate, sourceText: string): { ok: boolean; reason?: string } {
  if (!c.evidence || !sourceText.includes(c.evidence)) return { ok: false, reason: "excerpt not found in source text" };
  if (c.kind === "cost") {
    const forms = [c.amount.toLocaleString("en-US"), String(c.amount)];
    return forms.some((f) => c.evidence.includes(f)) ? { ok: true } : { ok: false, reason: "value not present in excerpt" };
  }
  const valueText =
    c.kind === "language" ? String(c.score) :
    c.kind === "grade_policy" ? c.threshold.replace("%", "").split("-")[0]! :
    c.dateText;
  if (!c.evidence.includes(valueText)) return { ok: false, reason: "value not present in excerpt" };
  return { ok: true };
}
