/**
 * How long ago, counted in the browser instead of taken from the API, so it can keep ticking.
 * Seconds for the first minute - the window that matters when a code is on its way - then
 * minutes, hours, days.
 */
export function agoLabel(ms: number, now: number, style: 'short' | 'long' = 'short'): string {
  const secs = Math.max(0, Math.floor((now - ms) / 1000))
  const [value, unit] =
    secs < 60 ? [secs, 'second'] :
    secs < 3600 ? [Math.floor(secs / 60), 'minute'] :
    secs < 86400 ? [Math.floor(secs / 3600), 'hour'] :
    [Math.floor(secs / 86400), 'day']
  return style === 'short'
    ? `${value}${unit[0]} ago`                      // 9s ago · 5m ago · 3h ago · 2d ago
    : `${value} ${unit}${value === 1 ? '' : 's'} ago` // 9 seconds ago · 5 minutes ago
}

/** When a mail arrived, or null if the provider gave us nothing we can parse. */
export function receivedMs(m: { receivedAt?: string }): number | null {
  const t = m.receivedAt ? Date.parse(m.receivedAt) : NaN
  return Number.isFinite(t) ? t : null
}

const AGO_RE = /(\d+)\s*(s|m|h|d)/i
const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

/** "44s ago" -> 44000. */
export function parseAgoMs(text?: string): number | null {
  const m = AGO_RE.exec(text || '')
  if (!m) return null
  return Number(m[1]) * UNIT_MS[m[2].toLowerCase()]
}

/**
 * When a mail arrived, in this browser's clock. Call it once, the moment a payload lands, and keep
 * the number - the API's own relative age is only true at that instant.
 *
 * The server's absolute stamp can sit ahead of the machine's clock (measured ~40-80s, which froze
 * just-arrived mail at "0s ago"), while its relative "44s ago" is right, so that is what the
 * arrival time is anchored to.
 */
export function arrivalOf(m: { timeAgo?: string; receivedAt?: string }): number {
  const ago = parseAgoMs(m.timeAgo)
  const at = ago !== null ? Date.now() - ago : Date.parse(m.receivedAt ?? '')
  return Number.isFinite(at) ? at : Date.now()
}
