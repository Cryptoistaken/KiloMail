import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"
import { generateUsername } from "@/lib/names"

const BASE = "https://kilomail.vercel.app"

export default {
  id:      "edu",
  name:    "EduMail",
  domains: ["iunp.edu.rs", "warsawuni.edu.pl"],
  enabled: true,

  generateUsername() { return generateUsername() },

  async fetchInbox(email) {
    const res = await fetch(
      `${BASE}/api/providers/edu?action=inbox&email=${encodeURIComponent(email)}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  streamInbox(email, onUpdate, onStatusChange) {
    const es = new EventSource(
      `${BASE}/api/providers/edu?action=stream&email=${encodeURIComponent(email)}`
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
      `${BASE}/api/providers/edu?action=read` +
      `&email=${encodeURIComponent(email)}` +
      `&uid=${encodeURIComponent(meta.id)}`
    )
    if (!res.ok) return null
    return res.json() as Promise<MessageFull>
  },

} satisfies ProviderPlugin
