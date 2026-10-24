// Program identification from a collected page (DATA-001). A page becomes a program only when its
// title names the major and a bachelor's degree for the institution's configured campus. Listing
// pages, foundation/transfer variants and other campuses are not programs.

export type ProgramMatch = {
  major: string; name: string; degree: string | null; joint: boolean; entryYear: number | null; reasons: string[];
};

const DEGREE = /\b(B\.?S\.?C?S?|B\.?Sc\.?|B\.?A\.?(?:Econ)?|BAEcon|A\.?B\.?|Bachelor(?:'s)?(?: of (?:Science|Arts))?|(?:BSc )?\(?Hons\)?)\b/;
const NOT_A_PROGRAM = /\b(foundation year|with a foundation|transfer|modified|minor|certificate|online|graduate|master'?s|\bM\.?S\.?c?\b|\bPhD\b|courses|programs|programmes|degree program options|blended|rankings?|department|school of|college of|home|guide|bulletins?|catalog)\b/i;

function titleHead(title: string): string {
  return title.replace(/&vert;/g, "|").split(/\s+(?:\||<|–|-)\s+/)[0]!.trim();
}

/** Degree family used to merge pages about the same program: "B.S.", "BS", "BSCS" are all BS. */
export function degreeKey(degree: string | null): string {
  if (!degree) return "?";
  const d = degree.toUpperCase().replace(/[^A-Z]/g, "");
  if (/^BSC?S?$/.test(d) || d.startsWith("BACHELOROFSCIENCE")) return d === "BSC" ? "BSC" : "BS";
  if (d === "BAECON") return "BAECON";
  if (/^(BA|AB|BACHELOROFARTS)$/.test(d)) return "BA";
  return d;
}

export function identifyProgram(
  page: { title: string | null; url: string },
  majors: Record<string, { match: string[] }>,
  otherCampusMarkers: string[] = [],
): ProgramMatch | null {
  if (!page.title) return null;
  const head = titleHead(page.title);
  // All-capital aliases ("CS") are matched case-sensitively so "cs" inside words never counts.
  const matches = (p: string) => new RegExp(`\\b${p}s?\\b`, p === p.toUpperCase() ? "" : "i").test(head);
  const major = Object.entries(majors).find(([, m]) => m.match.some(matches))?.[0];
  if (!major) return null;
  const whole = `${page.title} ${page.url}`.toLowerCase();
  if (otherCampusMarkers.some((m) => whole.includes(m))) return null;
  const degree = head.match(DEGREE)?.[0]?.replace(/[().]/g, "").replace(/\s+/g, " ").trim() ?? null;
  // Listing pages ("Economics courses") and variants are not programs; a degree token in the
  // title does not rescue "… with a Foundation Year BSc" or "(Transfer)".
  if (NOT_A_PROGRAM.test(head)) return null;
  const isMajorPage = /\bmajor\b/i.test(head);
  if (!degree && !isMajorPage) return null;
  const subject = majors[major]!.match[0]!;
  // Bracketed parts name a college, campus, UCAS code or entry year, never a second subject.
  const stripped = head.replace(new RegExp(DEGREE.source, "g"), " ").replace(/\([^)]*\)/g, " ").toLowerCase()
    .replace(/\b(major|cs|hons|boston|degree|in|or|ba)\b/g, " ").replace(/[,().&]/g, " ").replace(/\s+/g, " ").trim();
  // Nothing left but the subject (or nothing at all, e.g. "CS Major") means single-subject.
  const joint = stripped !== "" && !new RegExp(`^${subject}s?$`).test(stripped);
  const year = page.url.match(/(?:undergraduate-|courses\/|\/)(20\d\d)(?:\/|$)/)?.[1];
  const reasons: string[] = [];
  if (!degree) reasons.push("degree type not stated in the page title");
  return { major, name: head, degree, joint, entryYear: year ? Number(year) : null, reasons };
}
