import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"
import { generateUsername } from "@/lib/names"

const BASE    = "https://kilomail.vercel.app"
const POLL_MS = 5_000

const DOMAINS = [
  "yzcalo.com", "lnovic.com", "olipii.com", "ooynib.com",
  "ruutukf.com", "tanpony.com", "gmeenramy.com",
]

// temp-mail.io has no per-message delete route (404 upstream) - only a whole-address delete that
// needs the create token - so deleteMessage stays undefined and the UI hides the button.
// Nothing is stored in localStorage: list/read answer for any existing address without a token.
// The edge function creates the address on first fetch when it does not exist yet, which is what
// lets a hand-typed local part work. customUsername stays true so that typed name stays editable.
// (App.tsx leaves createEmail providers out of the custom-address domain dropdown, so these domains
// are reached through "New random inbox" -> createEmail, or by editing the name of an existing one.)
export default {
  id:      "tempmailio",
  name:    "temp-mail.io",
  domains: DOMAINS,
  enabled: true,
  customUsername: true,

  generateUsername() { return generateUsername() },

  async createEmail(domain) {
    const d    = domain || DOMAINS[0]
    const name = generateUsername()
    const res  = await fetch(
      `${BASE}/api/providers/tempmailio?action=create&domain=${encodeURIComponent(d)}&name=${encodeURIComponent(name)}`,
      { method: "POST" },
    )
    if (!res.ok) throw new Error(`temp-mail.io: create failed (${res.status})`)
    const data = await res.json() as { email?: string }
    if (!data.email) throw new Error("temp-mail.io: create returned no address")
    return data.email
  },

  async fetchInbox(email) {
    const res = await fetch(
      `${BASE}/api/providers/tempmailio?action=inbox&email=${encodeURIComponent(email)}`,
    )
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []) as MessageMeta[]
  },

  // Polling stream - upstream has no push API.
  streamInbox(email, onUpdate, onStatusChange) {
    let active = true
    const poll = async () => {
      if (!active) return
      try {
        const res = await fetch(
          `${BASE}/api/providers/tempmailio?action=inbox&email=${encodeURIComponent(email)}`,
        )
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
    const res = await fetch(
      `${BASE}/api/providers/tempmailio?action=read&email=${encodeURIComponent(email)}&id=${encodeURIComponent(meta.id)}`,
    )
    if (!res.ok) return null
    return res.json() as Promise<MessageFull>
  },
} satisfies ProviderPlugin
