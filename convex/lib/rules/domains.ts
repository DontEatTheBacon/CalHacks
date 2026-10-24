// Official-source allowlist (spec 8.2 rule 7, BD-3). Suffix match on whole labels.
import config from "../../../config/domains.json" with { type: "json" };

const all = [...config.US, ...config.GB];

export function isAllowedUrl(raw: string, allow: string[] = all): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return false; // raw IPs
  return allow.some((d) => host === d || host.endsWith("." + d));
}
