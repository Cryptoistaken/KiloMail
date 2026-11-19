/**
 * kilomail.tech is the landing page; app.kilomail.tech is the inbox.
 * Dev and Vercel previews keep both in one origin so nothing has to be configured there.
 */
export type SiteMode = 'app' | 'site' | 'dev'

export function siteMode(): SiteMode {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return 'dev'
  if (host.startsWith('app.')) return 'app'
  if (host.endsWith('.vercel.app') || host.endsWith('.pages.dev')) return 'dev'
  return 'site'
}

/** The canonical app origin, or null when this already is the app / a single-origin dev host. */
export function appUrl(path = '/'): string | null {
  if (siteMode() !== 'site') return null
  return `https://app.${window.location.hostname.replace(/^www\./, '')}${path}`
}

/** The landing page, for the logo inside the app. Null means stay in this origin. */
export function siteUrl(): string | null {
  if (siteMode() !== 'app') return null
  return `https://${window.location.hostname.replace(/^app\./, '')}`
}

/**
 * Where the inbox really lives today.
 *
 * app.kilomail.tech has to be added to the Pages project before it answers, so the subdomain is
 * probed once instead of assumed: until it exists everything stays on this origin rather than
 * sending a click (or an agent's curl) to a host that does not resolve.
 */
let resolved: string | null = null

export function appBase(): string {
  return resolved ?? window.location.origin
}

export async function resolveAppBase(): Promise<string> {
  const url = appUrl('/')
  if (!url) {
    resolved = window.location.origin
    return resolved
  }
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
    resolved = url.replace(/\/+$/, '')
  } catch {
    resolved = window.location.origin
  }
  return resolved
}
