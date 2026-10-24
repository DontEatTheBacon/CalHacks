export const usd = (amount: number | null) =>
  amount == null
    ? 'an unknown amount'
    : `$${amount.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`

// An amount in any currency, e.g. money(9052000, 'INR') -> '₹90,52,000' style output for the locale.
export const money = (amount: number, currency: string, digits = 0) =>
  amount.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: digits })

// '2026-12-01' -> a local Date at midnight
export function parseDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// '2026-12-01' -> 'Dec 1, 2026'
export function formatDate(iso: string) {
  return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const today = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export const monthLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const SEASONS: Record<string, number> = { spring: 0, winter: 0, summer: 5, fall: 7, autumn: 7 }

// 'February 2027' or 'Fall 2027' -> the first day of that month; null if it can't be read.
export function parseTerm(term: string): Date | null {
  const match = term.trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/)
  if (!match) return null
  const month = match[1] in SEASONS ? SEASONS[match[1]] : MONTHS.indexOf(match[1].slice(0, 3))
  return month < 0 ? null : new Date(Number(match[2]), month, 1)
}

// Only http(s) links from the agent are shown; returns the hostname to use as link text.
export function linkHost(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

// 0.75 -> '45 min', 2.5 -> '2.5 hours'
export const duration = (hours: number) =>
  hours < 1 ? `${Math.round(hours * 60)} min` : `${Math.round(hours * 10) / 10} hours`

export const list =(items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
