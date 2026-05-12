import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"

const BASE = "https://kilomail.vercel.app"

const TMAILOR_DOMAINS = new Set([
  "haibabon.com", "kemail.uk", "meocon.org", "tiksofi.uk", "pippoc.com", "picdirect.net",
])

export default {
  id:      "tmailor",
  name:    "TMailor",
  domains: ["tmailor.com"],
  enabled: true,

  matchDomain(email: string): boolean {
    return TMAILOR_DOMAINS.has(email.split("@")[1] ?? "")
  },

  async createEmail(_domain: string): Promise<string> {
    const res = await fetch(`${BASE}/api/providers/tmailor?action=newemail`)
    if (!res.ok) throw new Error("createEmail failed")
    const d = await res.json()
    return d.email as string
  },

  async fetchInbox(email) {
    const res = await fetch(
      `${BASE}/api/providers/tmailor?action=inbox&email=${encodeURIComponent(email)}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  streamInbox(email, onUpdate, onStatusChange) {
    const es = new EventSource(
      `${BASE}/api/providers/tmailor?action=stream&email=${encodeURIComponent(email)}`
    )
    es.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === "connected") onStatusChange(true)
      if (d.type === "update")    onUpdate(d.messages as MessageMeta[])
    }
    es.onerror = () => onStatusChange(false)
    return () => es.close()
  },

  async fetchMessage(email, meta) {
    const res = await fetch(
      `${BASE}/api/providers/tmailor?action=read` +
      `&email=${encodeURIComponent(email)}` +
      `&id=${encodeURIComponent(meta.id)}`
    )
    if (!res.ok) return null
    return res.json() as Promise<MessageFull>
  },
} satisfies ProviderPlugin
