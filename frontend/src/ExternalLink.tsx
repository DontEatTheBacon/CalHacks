import { linkHost } from './format'
import type { ResourceLink } from './toolTypes'

// Opens a ResourceLink in a new tab, labelled with its site; renders nothing for missing or non-http links.
export function ExternalLink({ link, className }: { link: ResourceLink | null | undefined; className: string }) {
  const host = linkHost(link?.url)
  if (!link || !host) return null
  return (
    <a className={className} href={link.url} target="_blank" rel="noopener noreferrer">
      {host} ↗
    </a>
  )
}
