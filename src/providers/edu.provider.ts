// ── EDU provider ──────────────────────────────────────────────────────────
//
// Domains:   iunp.edu.rs, warsawuni.edu.pl
// Backend:   getedumail.com API, proxied via api/providers/edu.ts
// Transport: SSE  (api/providers/edu?action=stream)
// Delete:    NO  (getedumail has no delete API)
// Names:     realistic academic format: firstname.lastname / f.lastname / firstnameLastname

import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"

const BASE = "https://kilomail.vercel.app"

const FIRST = [
  "james","john","robert","michael","william","david","richard","joseph","thomas","charles",
  "mary","patricia","jennifer","linda","barbara","elizabeth","susan","jessica","sarah","karen",
  "emily","daniel","matthew","andrew","joshua","christopher","ethan","alexander","ryan","kevin",
  "emma","olivia","sophia","isabella","mia","charlotte","amelia","harper","evelyn","abigail",
]
const LAST = [
  "smith","johnson","williams","brown","jones","garcia","miller","davis","wilson","taylor",
  "anderson","thomas","jackson","white","harris","martin","thompson","robinson","clark","lewis",
  "walker","hall","allen","young","king","wright","scott","green","baker","adams",
]

export default {
  id:      "edu",
  name:    "EduMail",
  domains: ["iunp.edu.rs", "warsawuni.edu.pl"],
  enabled: true,

  generateUsername() {
    const first = FIRST[Math.floor(Math.random() * FIRST.length)]
    const last  = LAST[Math.floor(Math.random()  * LAST.length)]
    const fmt   = Math.floor(Math.random() * 3)
    if (fmt === 0) return `${first}${last}`
    if (fmt === 1) return `${first[0]}${last}`
    return `${first}${last[0].toUpperCase()}${last.slice(1)}`
  },

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

  // No deleteMessage — getedumail has no delete API.
} satisfies ProviderPlugin
