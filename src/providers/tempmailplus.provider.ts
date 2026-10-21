import type { ProviderPlugin } from "./types"
import type { MessageFull } from "@/lib/types"
import { generateUsername } from "@/lib/names"

const BASE    = "https://kilomail.vercel.app"
const POLL_MS = 5_000

export default {
  id:      "tempmailplus",
  name:    "tempmail.plus",
  domains: ["mailto.plus", "fexbox.org", "fexpost.com", "fextemp.com", "merepost.com"],
  enabled: true,
  // any local part works, no inbox creation step
  customUsername: true,

  generateUsername() { return generateUsername() },

  async fetchInbox(email) {
    const res = await fetch(
      `${BASE}/api/providers/tempmailplus?action=inbox&email=${encodeURIComponent(email)}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  // tempmail.plus has no push API - poll with a recursive timeout
  streamInbox(email, onUpdate, onStatusChange) {
    let active = true
    const poll = async () => {
      if (!active) return
      try {
        const res = await fetch(
          `${BASE}/api/providers/tempmailplus?action=inbox&email=${encodeURIComponent(email)}`
        )
        if (!res.ok) throw new Error("fetch failed")
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
    const res = await fetch(
      `${BASE}/api/providers/tempmailplus?action=read&email=${encodeURIComponent(email)}&id=${encodeURIComponent(meta.id)}`
    )
    if (!res.ok) return null
    return res.json() as Promise<MessageFull>
  },

  async deleteMessage(email, id) {
    await fetch(
      `${BASE}/api/providers/tempmailplus?action=delete&email=${encodeURIComponent(email)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    )
  },
} satisfies ProviderPlugin
