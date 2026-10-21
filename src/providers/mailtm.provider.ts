import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"

const BASE     = "https://kilomail.vercel.app"
const POLL_MS  = 5_000
const DOMAIN   = "maxxspace.com"   // the only active mail.tm domain (GET /domains)
const KEY      = "mailtm:"         // localStorage: KEY + address -> { address, token }

interface Session { address: string; token: string }

// mail.tm accounts are created by the API, so the address only exists after createEmail().
// The bearer token identifies the mailbox for every later call - the password is used once,
// on create, and is deliberately not kept.
function loadSession(email: string): Session | null {
  try {
    const raw = localStorage.getItem(KEY + email.toLowerCase())
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<Session>
    if (!s.token) return null
    return { address: s.address ?? email, token: s.token }
  } catch { return null }
}

function saveSession(address: string, token: string) {
  try { localStorage.setItem(KEY + address.toLowerCase(), JSON.stringify({ address, token })) } catch { /* private mode */ }
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, b => b.toString(16).padStart(2, "0")).join("")
}

export default {
  id:      "mailtm",
  name:    "mail.tm",
  domains: [DOMAIN],
  // mail.tm answers 500 to /accounts from Vercel's egress IPs (works from a home IP), so account
  // creation fails in production. Re-enable if that changes.
  enabled: false,
  // Addresses only exist once the API makes the account - there is no local part to type.
  customUsername: false,

  async createEmail(domain) {
    const address  = `km${randomHex(6)}@${domain || DOMAIN}`
    const password = randomHex(16)
    const res = await fetch(`${BASE}/api/providers/mailtm?action=create`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ address, password }),
    })
    if (!res.ok) throw new Error(`mail.tm: create failed (${res.status})`)
    const data  = await res.json() as { address?: string; token?: string }
    const real  = data.address || address
    const token = data.token || ""
    if (!token) throw new Error("mail.tm: create returned no token")
    saveSession(real, token)
    return real
  },

  async fetchInbox(email) {
    const s = loadSession(email)
    if (!s) return []
    const res = await fetch(`${BASE}/api/providers/mailtm?action=inbox`, {
      headers: { Authorization: `Bearer ${s.token}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []) as MessageMeta[]
  },

  // Polling stream - mail.tm has no push API and EventSource cannot send an auth header.
  streamInbox(email, onUpdate, onStatusChange) {
    const s = loadSession(email)
    if (!s) { onStatusChange(false); return () => {} }
    let active = true
    const poll = async () => {
      if (!active) return
      try {
        const res = await fetch(`${BASE}/api/providers/mailtm?action=inbox`, {
          headers: { Authorization: `Bearer ${s.token}` },
        })
        if (!res.ok) throw new Error(`inbox ${res.status}`)
        const data = await res.json()
        onUpdate((Array.isArray(data) ? data : []) as MessageMeta[])
        onStatusChange(true)
      } catch { onStatusChange(false) }
      if (active) setTimeout(poll, POLL_MS)
    }
    poll()
    return () => { active = false }
  },

  async fetchMessage(email, meta) {
    const s = loadSession(email)
    if (!s) return null
    const res = await fetch(
      `${BASE}/api/providers/mailtm?action=read&id=${encodeURIComponent(meta.id)}`,
      { headers: { Authorization: `Bearer ${s.token}` } },
    )
    if (!res.ok) return null
    return res.json() as Promise<MessageFull>
  },

  async deleteMessage(email, id) {
    const s = loadSession(email)
    if (!s) return
    await fetch(
      `${BASE}/api/providers/mailtm?action=delete&id=${encodeURIComponent(id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${s.token}` } },
    )
  },
} satisfies ProviderPlugin
