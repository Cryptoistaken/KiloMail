/**
 * kilomail.tech is the landing page; app.kilomail.tech is the inbox.
 * Dev and Vercel previews keep both in one origin so nothing has to be configured there.
 */
export type SiteMode = 'app' | 'site' | 'dev'

export function siteMode(): SiteMode {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return 'dev'
  if (host.startsWith('app.')) return 'app'
  if (host.endsWith('.vercel.app')) return 'dev'
  return 'site'
}

/** Where "open the inbox" goes from the landing page. Null means stay in this origin. */
export function appUrl(path = '/'): string | null {
  const mode = siteMode()
  if (mode !== 'site') return null
  return `https://app.${window.location.hostname.replace(/^www\./, '')}${path}`
}

/** The landing page, for the logo inside the app. Null means stay in this origin. */
export function siteUrl(): string | null {
  if (siteMode() !== 'app') return null
  return `https://${window.location.hostname.replace(/^app\./, '')}`
}
