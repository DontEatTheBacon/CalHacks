import taxonomy from "../../../config/taxonomy.json" with { type: "json" };
import type { MajorBand } from "./types.ts";

type Fields = Record<string, { related: string[] }>;
const fields = taxonomy.fields as Fields;

/** Direct = in the student's chosen majors; Related = linked in config/taxonomy.json (either direction). */
export function majorRelevance(programCode: string | null | undefined, studentMajors: string[]): MajorBand {
  if (!programCode || !(programCode in fields)) return programCode ? "other" : "unknown";
  if (studentMajors.includes(programCode)) return "direct";
  const related = (a: string, b: string) => fields[a]?.related.includes(b) ?? false;
  return studentMajors.some((m) => related(m, programCode) || related(programCode, m)) ? "related" : "other";
}
