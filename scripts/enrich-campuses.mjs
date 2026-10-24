// Campus setting and climate evidence (spec DISC-002 and 5.3.1).
// 1. GeoNames cities1000 (CC BY 4.0): the configured campus town's population and coordinates.
// 2. Open-Meteo historical weather (CC BY 4.0): daily mean temperature 2015–2024 → annual mean and
//    coldest calendar-month mean.
// Classification happens in Convex with config/setting.json and config/climate.json.
// Usage: node scripts/enrich-campuses.mjs <work-dir>
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import config from "../config/institutions.json" with { type: "json" };

const work = process.argv[2];
if (!work) throw new Error("Usage: node scripts/enrich-campuses.mjs <work-dir>");
const zip = path.join(work, "cities1000.zip"), txt = path.join(work, "cities1000.txt");
if (!existsSync(txt)) {
  execFileSync("curl", ["-sSf", "-o", zip, "https://download.geonames.org/export/dump/cities1000.zip"]);
  execFileSync("unzip", ["-o", "-q", zip, "-d", work]);
}
const dataset = `GeoNames cities1000, downloaded ${statSync(txt).mtime.toISOString().slice(0, 10)}`;
const rows = readFileSync(txt, "utf8").split("\n").map((l) => l.split("\t"));
// Columns: 0 id, 1 name, 2 asciiname, 4 lat, 5 lng, 8 country, 10 admin1, 14 population
function town(name, country, admin1) {
  const hits = rows.filter((r) => r[8] === country && r[10] === admin1 && (r[1] === name || r[2] === name));
  return hits.sort((a, b) => Number(b[14]) - Number(a[14]))[0];
}

async function climate(lat, lng) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=2015-01-01&end_date=2024-12-31&daily=temperature_2m_mean&timezone=UTC`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (res.ok) {
      const d = await res.json();
      const byMonth = Array.from({ length: 12 }, () => []);
      const all = [];
      d.daily.time.forEach((t, i) => {
        const v = d.daily.temperature_2m_mean[i];
        if (v == null) return;
        all.push(v);
        byMonth[Number(t.slice(5, 7)) - 1].push(v);
      });
      const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
      return { annualMeanC: +mean(all).toFixed(2), coldestMonthMeanC: +Math.min(...byMonth.map(mean)).toFixed(2), period: "2015-01-01 to 2024-12-31", source: "Open-Meteo historical weather (ERA5), CC BY 4.0" };
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  return null;
}

for (const inst of config.institutions) {
  const gn = inst.campus.admin1 === "ENG" ? "ENG" : inst.campus.admin1;
  const r = town(inst.campus.town, inst.country, gn);
  if (!r) { console.log(`${inst.slug}: ${inst.campus.town} not found in GeoNames`); continue; }
  const settlement = { name: r[1], geonameId: Number(r[0]), population: Number(r[14]), lat: Number(r[4]), lng: Number(r[5]), dataset };
  const c = await climate(settlement.lat, settlement.lng);
  const out = execFileSync("npx", ["convex", "run", "catalog:setCampusEnvironment", JSON.stringify({ slug: inst.slug, settlement, ...(c ? { climate: c } : {}) })], { stdio: ["ignore", "pipe", "ignore"] }).toString();
  const res = JSON.parse(out);
  console.log(`${inst.slug.padEnd(13)} ${settlement.name.padEnd(14)} pop ${String(settlement.population).padStart(8)} → ${res.setting.padEnd(12)} climate ${c ? `${c.annualMeanC}°C / coldest ${c.coldestMonthMeanC}°C → ${res.climate}` : "unavailable"}`);
}
