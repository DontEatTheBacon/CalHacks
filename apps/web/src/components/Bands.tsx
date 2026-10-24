import type { DiscoverStrings } from "@/lib/discoverStrings";

type Bands = { major: string; academic: string; budget: string; climate: string };
const GOOD = new Set(["direct", "meets", "within", "match"]);
const BAD = new Set(["below", "over", "mismatch"]);

/** The four band chips (major, academic, budget, climate). Unknown values get their own neutral style. */
export function BandChips({ bands, s }: { bands: Bands; s: DiscoverStrings }) {
  const entries = (["major", "academic", "budget", "climate"] as const).map((k) => [k, bands[k]] as const);
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {entries.map(([k, v]) => (
        <li key={k} className={`rounded-full px-2.5 py-1 ${GOOD.has(v) ? "bg-emerald-100 text-emerald-900" : BAD.has(v) ? "bg-red-100 text-red-900" : v === "unknown" || v === "needs_confirmation" ? "border border-dashed border-stone-400 text-stone-700" : "bg-amber-100 text-amber-900"}`}>
          {(s.bands[k] as Record<string, string>)[v] ?? v}
        </li>
      ))}
    </ul>
  );
}

export function money(amount: number | null, currency: string | null, locale: string) {
  if (amount == null || !currency) return "—";
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
