// ── KiloLabs provider ─────────────────────────────────────────────────────
//
// Own domain: kilolabs.space
// Backend:    Cloudflare Worker → Upstash Redis
// Transport:  SSE  (api/inbox/[email]/stream)
// Delete:     YES  (api/inbox/[email]/[id]  DELETE)
// Names:      random adjective+noun+number

import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"

const BASE = "https://kilomail.vercel.app"

const ADJS  = ["swift","quiet","clever","bright","bold","crisp","sleek","dark","prime","noble"]
const NOUNS = ["fox","wolf","hawk","bear","lynx","crane","raven","shark","viper","eagle"]

export default {
  id:      "kilolabs",
  name:    "KiloLabs",
  domains: ["kilolabs.space"],
  enabled: true,

  generateUsername() {
    const a = ADJS[Math.floor(Math.random()  * ADJS.length)]
    const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    return `${a}${n}${Math.floor(Math.random() * 900) + 100}`
  },

  async fetchInbox(email) {
    const res = await fetch(`${BASE}/api/inbox/${encodeURIComponent(email)}`)
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  streamInbox(email, onUpdate, onStatusChange) {
    const es = new EventSource(`${BASE}/api/inbox/${encodeURIComponent(email)}/stream`)
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
      `${BASE}/api/inbox/${encodeURIComponent(email)}/${encodeURIComponent(meta.id)}`
    )
    if (!res.ok) return null
    return res.json() as Promise<MessageFull>
  },

  async deleteMessage(email, id) {
    await fetch(
      `${BASE}/api/inbox/${encodeURIComponent(email)}/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    )
  },
} satisfies ProviderPlugin
