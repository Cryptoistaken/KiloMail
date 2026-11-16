export interface MessageMeta {
  id: string
  from: string
  /** The display name the sender set, e.g. "KERNEL". Empty for older mail captured before
   *  the worker started reading the header instead of the envelope address. */
  fromName?: string
  subject: string
  receivedAt: string
  read: boolean
  timeAgo: string
}

export interface MessageFull extends MessageMeta {
  read: boolean
  text: string
  html: string
  /** Header details for the "details" popover. All of these are empty on mail stored before
   *  the worker started keeping them (i.e. anything already sitting in an inbox). */
  to?: string
  replyTo?: string
  date?: string
  mailedBy?: string
  signedBy?: string
  encryption?: string
}

export type Panel = "inbox" | "history"

export const EMAIL_KEY   = "kilomail_current_email"
export const VISITED_KEY = "kilomail_visited"

export function hasVisitedBefore(): boolean {
  try { return !!localStorage.getItem(VISITED_KEY) } catch { return false }
}

export function markVisited() {
  try { localStorage.setItem(VISITED_KEY, "1") } catch {}
}

export function getPersistedEmail(): string | null {
  try { return localStorage.getItem(EMAIL_KEY) ?? null } catch { return null }
}

export function persistInbox(email: string) {
  try { localStorage.setItem(EMAIL_KEY, email) } catch {}
}

export const READ_KEY = "kilomail_read"

/**
 * Which mails have been opened, per inbox. Nothing on the server tracks this - the API reports
 * every mail as unread - so the reader's own state has to live here to survive a reload.
 */
export function loadReadIds(email: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(READ_KEY) || "{}") as Record<string, unknown>
    const list = all?.[email]
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []
  } catch { return [] }
}

export function saveReadIds(email: string, ids: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(READ_KEY) || "{}") as Record<string, unknown>
    all[email] = ids.slice(-300) // newest last: old ids fall off once an inbox gets long
    localStorage.setItem(READ_KEY, JSON.stringify(all))
  } catch {}
}
