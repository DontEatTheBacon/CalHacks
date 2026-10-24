import { linkHost } from './format'
import type { ResourceLink } from './toolTypes'

// Opens a ResourceLink in a new tab, labelled with its label or site; renders nothing for missing or non-http links.
export function ExternalLink({ link, className }: { link: ResourceLink | null | undefined; className: string }) {
  const host = linkHost(link?.url)
  if (!link || !host) return null
  return (
    <a className={className} href={link.url} title={link.url} target="_blank" rel="noopener noreferrer">
      {link.label ?? host} ↗
      {link.official && <span className="link-official"> · Official</span>}
    </a>
  )
}
