export const usd = (amount: number | null) => (amount == null ? 'an unknown amount' : `$${amount.toLocaleString()}`)

// '2026-12-01' -> 'Dec 1, 2026'
export function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
