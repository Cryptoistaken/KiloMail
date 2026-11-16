import type { MessageMeta } from './types'

/** Bulk mailers send through throwaway addresses like
 *  `010001a1dc9047ca-77c8ca90-...-000000@envelope.sup.kernel.sh` or `bounces+123-user@esp.example`.
 *  Those are machine tokens, never meant for a human to read. */
function isMachineLocal(local: string): boolean {
  if (/^bounces?[+.]/i.test(local)) return true
  return /^[0-9a-f]{12,}([-._][0-9a-f]+)*$/i.test(local)
}

/** A display name wrapped around an address, e.g. `KERNEL <mail@kernel.sh>`. */
function embeddedName(from: string): string {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/)
  return m ? m[1].trim() : ''
}

/** The bare address, unwrapping `Name <addr>` if a provider hands us one. */
export function senderAddress(from: string): string {
  const s = (from || '').trim()
  const m = s.match(/<([^>]+)>\s*$/)
  return m ? m[1].trim() : s
}

/** Domain minus subdomains: `envelope.sup.kernel.sh` -> `kernel.sh`. */
export function registrableDomain(domain: string): string {
  const parts = (domain || '').split('.').filter(Boolean)
  return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.')
}

export function senderDomain(from: string): string {
  return registrableDomain(senderAddress(from).split('@')[1] ?? '')
}

type Who = Pick<MessageMeta, 'from'> & Partial<Pick<MessageMeta, 'fromName'>>

/** What to show as the sender. Prefers the real display name the sender set, and falls back to
 *  the sender's domain for machine addresses - otherwise the list is unreadable. */
export function senderLabel(msg: Who): string {
  const from = senderAddress(msg.from)
  const name = (msg.fromName || embeddedName(msg.from) || '').trim()
  if (name) return name
  const [local, domain = ''] = from.split('@')
  if (local && isMachineLocal(local)) return registrableDomain(domain) || domain || from
  return from
}

/** The raw address, only when the label is something friendlier. */
export function senderSecondary(msg: Who): string | null {
  const from = senderAddress(msg.from)
  return senderLabel(msg) === from ? null : from
}
