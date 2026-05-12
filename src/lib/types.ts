// ── Shared message types ───────────────────────────────────────────────────
//
// These are the only types the core app cares about.
// Provider-specific logic lives in src/providers/*.provider.ts

export interface MessageMeta {
  id: string
  from: string
  subject: string
  receivedAt: string
  read: boolean
  timeAgo: string
}

export interface MessageFull extends MessageMeta {
  read: boolean
  text: string
  html: string
}

export type Panel = "inbox" | "history"

// ── App-level constants ────────────────────────────────────────────────────

export const BASE        = "https://kilomail.vercel.app"
export const DOMAIN      = "kilolabs.space"
export const EMAIL_KEY   = "kilomail_current_email"
export const VISITED_KEY = "kilomail_visited"

export function hasVisitedBefore(): boolean {
  try { return !!localStorage.getItem(VISITED_KEY) } catch { return false }
}

export function markVisited() {
  try { localStorage.setItem(VISITED_KEY, "1") } catch {}
}

/** Returns the persisted email, or null if not set / domain no longer exists. */
export function getPersistedEmail(): string | null {
  try { return localStorage.getItem(EMAIL_KEY) ?? null } catch { return null }
}

export function persistInbox(email: string) {
  try { localStorage.setItem(EMAIL_KEY, email) } catch {}
}
