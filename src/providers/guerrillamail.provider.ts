import type { ProviderPlugin } from "./types"
import type { MessageFull } from "@/lib/types"
import { generateUsername } from "@/lib/names"

const BASE     = "https://kilomail.vercel.app"
const UPSTREAM = "https://api.guerrillamail.com/ajax.php"
const POLL_MS  = 5_000

// Guerrilla Mail is session based: a sid_token owns exactly one address, so the token has to be
// kept per address or the inbox is lost on refresh. Keyed by the full address, value is
// { sid_token, email }.
const STORE = (email: string) => `guerrillamail:${email.toLowerCase()}`

interface GmSession { sid_token: string; email: string }

function readSession(email: string): GmSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE(email)) ?? "null")
    return s?.sid_token ? s as GmSession : null
  } catch { return null }
}

function saveSession(s: GmSession) {
  try { localStorage.setItem(STORE(s.email), JSON.stringify(s)) } catch { /* ignore */ }
}

function clearSession(email: string) {
  try { localStorage.removeItem(STORE(email)) } catch { /* ignore */ }
}

function split(email: string): { user: string; site: string } {
  const [user, site = "guerrillamail.com"] = email.toLowerCase().split("@")
  return { user, site }
}

const url = (site: string, params: string) =>
  `${UPSTREAM}?${params}&lang=en&site=${encodeURIComponent(site)}`

/**
 * Guarantees a live session for `email`.
 *
 * customUsername is true here, so the user may type their own local part (header edit box, or a
 * full "name@grr.la"). In that case no sid_token exists yet, so we open a session with
 * get_email_address and then call set_email_user to claim that exact local part before storing it.
 * The domain is always the site we opened the session for: Guerrilla Mail accepts mail at
 * <local>@<site>, but its AJAX API reports every email_addr as "@guerrillamailblock.com", which is
 * why the returned address is ignored in favour of the requested one.
 */
async function ensureSession(email: string): Promise<GmSession | null> {
  const addr   = email.toLowerCase()
  const cached = readSession(addr)
  if (cached) return cached

  const { user, site } = split(addr)

  const created = await fetch(url(site, "f=get_email_address"))
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
  const sid = created?.sid_token as string | undefined
  if (!sid) return null

  const claimed = await fetch(
    url(site, `f=set_email_user&email_user=${encodeURIComponent(user)}&sid_token=${encodeURIComponent(sid)}`),
  ).then(r => (r.ok ? r.json() : null)).catch(() => null)
  if (!claimed?.email_addr) return null

  const session = { sid_token: sid, email: addr }
  saveSession(session)
  return session
}

// One call through our edge proxy. A 401 means the stored sid_token expired, so the session is
// rebuilt once and the request replayed rather than leaving the inbox permanently empty.
async function proxy(email: string, action: string, extra = "", method = "GET"): Promise<Response | null> {
  let s = await ensureSession(email)
  if (!s) return null

  const { site } = split(email)
  const call = (sid: string) =>
    `${BASE}/api/providers/guerrillamail?action=${action}` +
    `&site=${encodeURIComponent(site)}` +
    `&sid_token=${encodeURIComponent(sid)}${extra}`

  let res = await fetch(call(s.sid_token), { method })
  if (res.status === 401) {
    clearSession(email)
    s = await ensureSession(email)
    if (!s) return null
    res = await fetch(call(s.sid_token), { method })
  }
  return res
}

export default {
  id:      "guerrillamail",
  name:    "Guerrilla Mail",
  domains: ["guerrillamail.com", "sharklasers.com", "grr.la", "spam4.me"],
  enabled: true,
  customUsername: true,

  async createEmail(domain) {
    const email = `${generateUsername().toLowerCase()}@${domain.toLowerCase()}`
    if (!(await ensureSession(email))) throw new Error("Guerrilla Mail: could not open a session")
    return email
  },

  async fetchInbox(email) {
    const res = await proxy(email, "inbox")
    if (!res?.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  streamInbox(email, onUpdate, onStatusChange) {
    let active = true

    const poll = async () => {
      if (!active) return
      try {
        const res = await proxy(email, "inbox")
        if (!res?.ok) throw new Error("fetch failed")
        const data = await res.json()
        onUpdate(Array.isArray(data) ? data : [])
        onStatusChange(true)
      } catch { onStatusChange(false) }
      if (active) setTimeout(poll, POLL_MS)
    }

    poll()
    return () => { active = false }
  },

  async fetchMessage(email, meta) {
    const res = await proxy(email, "read", `&id=${encodeURIComponent(meta.id)}`)
    if (!res?.ok) return null
    return res.json() as Promise<MessageFull>
  },

  async deleteMessage(email, id) {
    await proxy(email, "delete", `&id=${encodeURIComponent(id)}`, "DELETE")
  },
} satisfies ProviderPlugin
