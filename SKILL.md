# KiloMail — Claude skill

Read this before touching any provider-related code in this project.

## What this project is

KiloMail is a disposable email web app (React + Vite + Vercel edge functions + Upstash Redis).
Personal project — no public users, full rewrites are fine.

## Provider plugin system

Providers are auto-discovered. **Never touch `registry.ts`** to add/remove a provider.

### To add a provider — 2 files only

1. `src/providers/<name>.provider.ts` — frontend logic
2. `api/providers/<name>.ts` — Vercel edge function proxy

Drop both files → redeploy → done. The registry picks them up via `import.meta.glob`.

### To remove a provider

Delete both files above → redeploy.

### To disable without deleting

Set `enabled: false` in the provider file. Domain vanishes from all pickers and routing.

---

## File map

```
src/
  providers/
    types.ts              ← ProviderPlugin interface (DO NOT CHANGE without updating all providers)
    registry.ts           ← auto-discovery via import.meta.glob (NEVER EDIT)
    kilolabs.provider.ts  ← kilolabs.space  | SSE | delete: yes
    hd.provider.ts        ← tenwmail.com, clowtmail.com | polling 5s | delete: no
    edu.provider.ts       ← iunp.edu.rs, warsawuni.edu.pl | SSE | delete: no
  lib/
    types.ts              ← MessageMeta, MessageFull, Panel — shared shapes only
    history.ts            ← localStorage history (no provider logic)
    router.ts             ← hash router
    utils.ts              ← cn()

api/
  providers/
    hd.ts                 ← proxy for hotmail9.com
    edu.ts                ← proxy for getedumail.com
  inbox/
    [email].ts            ← kilolabs inbox GET (Redis)
    [email]/
      stream              ← kilolabs SSE stream
      [id].ts             ← kilolabs message GET + DELETE
  webhook.ts              ← Cloudflare Worker → Redis (receives inbound mail for kilolabs.space)
  test.ts                 ← inject test email (TEST_MODE=1 only)
```

---

## ProviderPlugin interface (from src/providers/types.ts)

```ts
interface ProviderPlugin {
  id: string               // unique key e.g. "hd"
  name: string             // display name e.g. "Hotmail9"
  domains: string[]        // ["tenwmail.com", "clowtmail.com"]
  enabled: boolean         // false = hidden everywhere, no routing

  fetchInbox(email: string): Promise<MessageMeta[]>

  streamInbox(
    email: string,
    onUpdate: (msgs: MessageMeta[]) => void,
    onStatusChange: (connected: boolean) => void,
  ): () => void            // must return cleanup function

  fetchMessage(email: string, meta: MessageMeta): Promise<MessageFull | null>

  deleteMessage?(email: string, id: string): Promise<void>  // optional
  generateUsername?(domain: string): string                 // optional
}
```

---

## Provider template

### src/providers/myservice.provider.ts

```ts
import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"

const BASE = "https://kilomail.vercel.app"

export default {
  id:      "myservice",
  name:    "MyService",
  domains: ["myservice.com"],
  enabled: true,

  async fetchInbox(email) {
    const res = await fetch(`${BASE}/api/providers/myservice?action=inbox&email=${encodeURIComponent(email)}`)
    if (!res.ok) return []
    return res.json()
  },

  streamInbox(email, onUpdate, onStatusChange) {
    // Option A — SSE
    const es = new EventSource(`${BASE}/api/providers/myservice?action=stream&email=${encodeURIComponent(email)}`)
    es.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === "connected") onStatusChange(true)
      if (d.type === "update")    onUpdate(d.messages)
    }
    es.onerror = () => onStatusChange(false)
    return () => es.close()

    // Option B — polling
    // let active = true
    // const poll = async () => {
    //   if (!active) return
    //   try { onUpdate(await this.fetchInbox(email)); onStatusChange(true) }
    //   catch { onStatusChange(false) }
    //   if (active) setTimeout(poll, 5000)
    // }
    // poll()
    // return () => { active = false }
  },

  async fetchMessage(email, meta) {
    const res = await fetch(`${BASE}/api/providers/myservice?action=read&email=${encodeURIComponent(email)}&id=${encodeURIComponent(meta.id)}`)
    if (!res.ok) return null
    return res.json()
  },

  // optional:
  async deleteMessage(email, id) {
    await fetch(`${BASE}/api/providers/myservice?action=delete&email=${encodeURIComponent(email)}&id=${encodeURIComponent(id)}`, { method: "DELETE" })
  },

  generateUsername(domain) {
    return `user${Math.floor(Math.random() * 9000) + 1000}`
  },
} satisfies ProviderPlugin
```

### api/providers/myservice.ts

```ts
const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") ?? ""
  const email  = (url.searchParams.get("email") ?? "").toLowerCase().trim()
  if (!email) return json({ error: "Missing email" }, 400)

  if (action === "inbox") {
    // call upstream API, map to MessageMeta[], return
    return json([])
  }

  if (action === "stream") {
    // return SSE ReadableStream that polls upstream and pushes { type: "connected" } then { type: "update", messages: [] }
  }

  if (action === "read") {
    // return MessageFull
    return json({ error: "Not found" }, 404)
  }

  return json({ error: "Unknown action" }, 400)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const config = { runtime: "edge" }
```

---

## MessageMeta shape (what providers must return for inbox lists)

```ts
{
  id: string           // unique message ID (string, even if upstream uses numbers)
  from: string         // "Display Name <email@x.com>" or just "email@x.com"
  subject: string      // "(no subject)" if empty
  receivedAt: string   // ISO 8601 datetime string
  read: boolean        // false on first load; App.tsx tracks read state locally
  timeAgo: string      // "2m ago", "5h ago", "3d ago"
}
```

## MessageFull shape (fetchMessage return)

Same as MessageMeta plus:
```ts
{
  read: true           // always true
  text: string         // plain text body
  html: string         // HTML body (used for rendering; text is fallback/code extraction)
}
```

---

## Key behaviours to preserve

- `streamInbox` cleanup is called when the user switches email or navigates away — always return a working cleanup fn
- `deleteMessage` being `undefined` → App.tsx skips the API call and just removes from local state
- `generateUsername` is optional — falls back to `adjective+noun+number` if not provided
- Providers with polling: use recursive `setTimeout`, not `setInterval` (avoids overlap if the call is slow)
- SSE format expected by App.tsx: `data: {"type":"connected"}\n\n` then `data: {"type":"update","messages":[...]}\n\n`

---

## Env vars (Vercel)

- `UPSTASH_REDIS_REST_URL` — kilolabs.space inbox storage
- `UPSTASH_REDIS_REST_TOKEN` — kilolabs.space inbox storage
- `WEBHOOK_SECRET` — validates inbound mail from Cloudflare Worker
- `TEST_MODE` — set to "1" to enable /api/test injection endpoint
