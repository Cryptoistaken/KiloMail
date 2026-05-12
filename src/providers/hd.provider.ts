// ── HD (hotmail9) provider ────────────────────────────────────────────────
//
// Domains:   tenwmail.com, clowtmail.com
// Backend:   hotmail9.com API, proxied via api/providers/hd.ts
// Transport: polling every 5 s (no SSE available)
// Delete:    NO (hotmail9 has no delete API — removes from local state only)
// Names:     random adjective+noun+number (same as kilolabs)

import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"

const BASE = "https://kilomail.vercel.app"
const POLL_MS = 5000

export default {
  id:      "hd",
  name:    "Hotmail9",
  domains: ["tenwmail.com", "clowtmail.com"],
  enabled: true,

  async fetchInbox(email) {
    const res = await fetch(
      `${BASE}/api/providers/hd?action=inbox&email=${encodeURIComponent(email)}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  streamInbox(email, onUpdate, onStatusChange) {
    let active = true

    const poll = async () => {
      if (!active) return
      try {
        const msgs = await this.fetchInbox(email)
        onUpdate(msgs)
        onStatusChange(true)
      } catch {
        onStatusChange(false)
      }
      if (active) setTimeout(poll, POLL_MS)
    }

    poll()
    return () => { active = false }
  },

  async fetchMessage(email, meta) {
    const time = Math.floor(new Date(meta.receivedAt).getTime() / 1000)
    const res = await fetch(
      `${BASE}/api/providers/hd?action=read` +
      `&email=${encodeURIComponent(email)}` +
      `&emlid=${encodeURIComponent(meta.id)}` +
      `&time=${time}`
    )
    if (!res.ok) return null
    return res.json() as Promise<MessageFull>
  },

  // No deleteMessage — hotmail9 has no delete API.
  // App.tsx removes from local state only when deleteMessage is undefined.
} satisfies ProviderPlugin
