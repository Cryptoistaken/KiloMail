// ── Shared types ───────────────────────────────────────────────────────────

export interface MessageMeta {
  id: string
  from: string
  subject: string
  receivedAt: string
  read: boolean
  timeAgo: string
}

export interface MessageFull extends MessageMeta {
  read: true
  text: string
  html: string
}

export type Panel = "inbox" | "history" | "docs"

// ── Inbox helpers ──────────────────────────────────────────────────────────
export const DOMAINS = [
  "kilolabs.space",
  "tenwmail.com",
  "clowtmail.com",
  "iunp.edu.rs",
  "warsawuni.edu.pl",
] as const

export type KiloDomain = typeof DOMAINS[number]

/**
 * HD domains are third-party inboxes accessed via the hotmail9 HTTP API directly.
 * They use polling instead of SSE.
 */
export const HD_DOMAINS: ReadonlySet<string> = new Set([
  "tenwmail.com",
  "clowtmail.com",
])

export function isHDDomain(email: string): boolean {
  return [...HD_DOMAINS].some(d => email.endsWith(`@${d}`))
}

/**
 * EDU domains are third-party inboxes accessed via the getedumail.com API,
 * proxied through /api/edu. They use polling instead of SSE.
 */
export const EDU_DOMAINS: ReadonlySet<string> = new Set([
  "iunp.edu.rs",
  "warsawuni.edu.pl",
])

export function isEduDomain(email: string): boolean {
  return [...EDU_DOMAINS].some(d => email.endsWith(`@${d}`))
}

// ── HM9 direct API ────────────────────────────────────────────────────────
const HM9 = "https://hotmail9.com/view/api"
const HM9_PASS = "Abuhider"
const HM9_TOKEN_KEY = "kilomail_hm9_token"

function hm9DomainHost(email: string): string {
  return email.endsWith("@tenwmail.com") ? "1" : "0"
}

function hm9LoadToken(email: string): string | null {
  try {
    const raw = localStorage.getItem(HM9_TOKEN_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    return obj.email === email ? obj.token : null
  } catch { return null }
}

function hm9StoreToken(email: string, token: string) {
  try { localStorage.setItem(HM9_TOKEN_KEY, JSON.stringify({ email, token })) } catch { /* ignore */ }
}

/** Register (ignore if exists) then login — always returns a fresh token. */
export async function hm9Auth(email: string): Promise<string> {
  const user = email.split("@")[0]
  const host = hm9DomainHost(email)
  // 1. Try register — status 1 = created, status 0 = already exists, both fine
  try {
    await fetch(`${HM9}?type=reg&user=${encodeURIComponent(user)}&password=${encodeURIComponent(HM9_PASS)}&host=${host}`)
  } catch { /* ignore — fall through to login */ }
  // 2. Login to get token
  const res  = await fetch(`${HM9}?type=login&user=${encodeURIComponent(email)}&password=${encodeURIComponent(HM9_PASS)}`)
  const data = await res.json()
  if (data.status !== 1 || !data.token) throw new Error("HM9 login failed")
  hm9StoreToken(email, data.token)
  return data.token as string
}

/** Get-or-refresh token (uses cache, falls back to full auth). */
export async function hm9GetToken(email: string): Promise<string> {
  const cached = hm9LoadToken(email)
  if (cached) return cached
  return hm9Auth(email)
}

export interface HM9Item {
  emlid: string
  time: number
  is_read: number
  from: { display: string; address: string }
  subject: string
}

/** Fetch inbox list from HM9. */
export async function hm9FetchInbox(token: string): Promise<HM9Item[]> {
  const res  = await fetch(`${HM9}?type=message&time=0`, { headers: { authorization: token } })
  const data = await res.json()
  if (data.status !== 1) throw new Error("HM9 inbox error")
  return (data.list ?? []) as HM9Item[]
}

/** Read a single message body from HM9. */
export async function hm9ReadMsg(token: string, emlid: string, time: number) {
  const res = await fetch(`${HM9}?type=read&time=${time}&emlid=${encodeURIComponent(emlid)}`, {
    headers: { authorization: token },
  })
  return res.json()
}

/** Map a raw HM9Item into KiloMail's MessageMeta shape. */
export function hm9MapItem(item: HM9Item): MessageMeta {
  const diff = Math.floor(Date.now() / 1000) - item.time
  let timeAgo: string
  if (diff < 60)    timeAgo = `${diff}s ago`
  else if (diff < 3600)  timeAgo = `${Math.floor(diff / 60)}m ago`
  else if (diff < 86400) timeAgo = `${Math.floor(diff / 3600)}h ago`
  else               timeAgo = `${Math.floor(diff / 86400)}d ago`
  return {
    id:         item.emlid,
    from:       item.from.display || item.from.address,
    subject:    item.subject,
    receivedAt: String(item.time),   // store raw unix int as string (used for read API)
    read:       item.is_read === 1,
    timeAgo,
  }
}

/** Primary domain — used as the default when no domain is specified. */
export const DOMAIN: KiloDomain = "kilolabs.space"
export const BASE = "https://kilomail.vercel.app"
export const EMAIL_KEY = "kilomail_current_email"
export const VISITED_KEY = "kilomail_visited"

/** Returns true if the user has visited before (skip landing page). */
export function hasVisitedBefore(): boolean {
  try { return !!localStorage.getItem(VISITED_KEY) } catch { return false }
}

/** Mark the user as having visited. */
export function markVisited() {
  try { localStorage.setItem(VISITED_KEY, "1") } catch { /* ignore */ }
}

const ADJS = ["swift","quiet","clever","bright","bold","crisp","sleek","dark","prime","noble"]
const NOUNS = ["fox","wolf","hawk","bear","lynx","crane","raven","shark","viper","eagle"]

export function randomUser() {
  const a = ADJS[Math.floor(Math.random() * ADJS.length)]
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${a}${n}${Math.floor(Math.random() * 900) + 100}`
}

// ── EDU professional name generator ──────────────────────────────────────
const EDU_FIRST = [
  "james","john","robert","michael","william","david","richard","joseph","thomas","charles",
  "mary","patricia","jennifer","linda","barbara","elizabeth","susan","jessica","sarah","karen",
  "emily","daniel","matthew","andrew","joshua","christopher","ethan","alexander","ryan","kevin",
  "emma","olivia","sophia","isabella","mia","charlotte","amelia","harper","evelyn","abigail",
]
const EDU_LAST = [
  "smith","johnson","williams","brown","jones","garcia","miller","davis","wilson","taylor",
  "anderson","thomas","jackson","white","harris","martin","thompson","robinson","clark","lewis",
  "walker","hall","allen","young","king","wright","scott","green","baker","adams",
  "nelson","carter","mitchell","perez","roberts","turner","phillips","campbell","parker","evans",
]

/** Generates a realistic professional name for EDU inboxes, e.g. "j.anderson" or "emily.brown" */
function randomEduUser(): string {
  const first = EDU_FIRST[Math.floor(Math.random() * EDU_FIRST.length)]
  const last  = EDU_LAST[Math.floor(Math.random() * EDU_LAST.length)]
  // Pick one of three common academic email formats
  const fmt = Math.floor(Math.random() * 3)
  if (fmt === 0) return `${first}.${last}`           // emily.brown
  if (fmt === 1) return `${first[0]}.${last}`        // e.brown
  return `${first}${last[0].toUpperCase()}${last.slice(1)}` // emilyBrown
}

export function randomInbox(domain: KiloDomain = DOMAIN) {
  const user = isEduDomain(`x@${domain}`) ? randomEduUser() : randomUser()
  return `${user}@${domain}`
}

/** Pick a random domain from the full list (excluding the current one if desired). */
export function randomDomain(exclude?: KiloDomain): KiloDomain {
  const pool = exclude ? DOMAINS.filter(d => d !== exclude) : [...DOMAINS]
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Returns the persisted email from localStorage, or generates + saves a new one. */
export function getOrCreateInbox(): string {
  try {
    const saved = localStorage.getItem(EMAIL_KEY)
    if (saved && DOMAINS.some(d => saved.endsWith(`@${d}`))) return saved
  } catch { /* ignore */ }
  const fresh = randomInbox()
  try { localStorage.setItem(EMAIL_KEY, fresh) } catch { /* ignore */ }
  return fresh
}

/** Saves the current inbox address to localStorage. */
export function persistInbox(email: string) {
  try { localStorage.setItem(EMAIL_KEY, email) } catch { /* ignore */ }
}
