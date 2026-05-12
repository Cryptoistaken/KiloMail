# KiloMail — CLAUDE.md

Disposable email web app. React 19 + Vite + Vercel edge functions + Upstash Redis + Cloudflare Worker.
Personal project — full rewrites are fine, no public users to protect.

---

## Stack at a glance

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind v4 |
| Routing | Hash router (`#/inbox`, `#/`) — `src/hooks/useHashRoute.ts` |
| Styling | Tailwind v4 + shadcn/ui components in `src/components/ui/` |
| API | Vercel edge functions in `api/` (no Express, no Node runtime unless specified) |
| Storage | Upstash Redis — hash per inbox, body blobs keyed separately |
| Email ingest | Cloudflare Worker (`worker/`) receives MX, writes to Redis |
| CI | `.github/workflows/ci.yml` — type-check + lint + build on PRs, provider health on schedule |

---

## Repo layout

```
src/
  App.tsx                        main app shell, all state lives here
  lib/
    types.ts                     MessageMeta, MessageFull, Panel, shared constants
    history.ts                   localStorage inbox history
    router.ts                    re-exports useHashRoute + navigate
    utils.ts                     cn() only
    names.ts                     shared name arrays + generateUsername() — used by all providers
  hooks/
    useHashRoute.ts              hash router hook + navigate()
    useTheme.ts                  watches <html class="dark"> mutations
  providers/
    types.ts                     ProviderPlugin interface — do not change without updating all providers
    registry.ts                  auto-discovery via import.meta.glob — NEVER EDIT
    kilolabs.provider.ts         kilolabs.space | SSE | delete supported
    edu.provider.ts              iunp.edu.rs, warsawuni.edu.pl | SSE | no delete
  app/
    views/
      Landing.tsx                marketing page shown to first-time visitors
      InboxView.tsx              message list sidebar
      MessageView.tsx            message body pane (iframe for HTML, pre for text)
      HistoryView.tsx            previously used addresses
    components/
      Background.tsx             decorative background
      Logo.tsx                   SVG logo
      MessageSkeleton.tsx        loading skeleton

api/
  inbox/
    [email].ts                   GET inbox list from Redis (kilolabs only)
    [email]/
      stream                     SSE stream (kilolabs only)
      [id].ts                    GET + DELETE single message (kilolabs only)
  providers/
    hd.ts                        proxy for hotmail9.com
    edu.ts                       proxy for getedumail.com
  webhook.ts                     receives inbound mail from Cloudflare, writes to Redis
  test.ts                        inject a fake email (TEST_MODE=1 only)

worker/
  index.ts                       Cloudflare Email Worker — parses MIME, writes to Redis

.github/
  workflows/ci.yml               single workflow: check + build + health
  scripts/health-check.mjs       provider smoke test script
```

---

## Key types

```ts
// src/lib/types.ts

interface MessageMeta {
  id: string          // always a string, even if upstream uses numbers
  from: string        // "Name <email>" or just "email"
  subject: string     // "(no subject)" if blank
  receivedAt: string  // ISO 8601
  read: boolean
  timeAgo: string     // "2m ago", "5h ago", "3d ago"
}

interface MessageFull extends MessageMeta {
  read: boolean       // true after fetch
  text: string        // plain text body
  html: string        // HTML body
}

type Panel = "inbox" | "history"

// Constants
const BASE   = "https://kilomail.vercel.app"
const DOMAIN = "kilolabs.space"     // primary own domain
```

---

## Provider plugin system

Providers are **auto-discovered** via `import.meta.glob` in `registry.ts`. Do not touch that file.

### Adding a provider — 2 files

1. `src/providers/<name>.provider.ts` — frontend plugin
2. `api/providers/<name>.ts` — Vercel edge proxy

Drop both files, redeploy. That's it.

### Removing a provider — delete both files, redeploy.

### Disabling without deleting — set `enabled: false` in the provider file.

### ProviderPlugin interface (must satisfy)

```ts
interface ProviderPlugin {
  id: string
  name: string
  domains: string[]
  enabled: boolean

  fetchInbox(email: string): Promise<MessageMeta[]>

  // Must return a cleanup function — called on inbox switch / navigation
  streamInbox(
    email: string,
    onUpdate: (msgs: MessageMeta[]) => void,
    onStatusChange: (connected: boolean) => void,
  ): () => void

  fetchMessage(email: string, meta: MessageMeta): Promise<MessageFull | null>

  deleteMessage?(email: string, id: string): Promise<void>  // undefined = UI hides delete button
  generateUsername?(domain: string): string                 // undefined = falls back to shared generateUsername() from @/lib/names
}
```

### Rules

- Polling providers: use recursive `setTimeout`, not `setInterval` — avoids overlap when calls are slow
- SSE wire format App.tsx expects:
  ```
  data: {"type":"connected"}\n\n
  data: {"type":"update","messages":[...]}\n\n
  ```
- Never use `this.fetchInbox()` inside `streamInbox` — the object literal has no `this` binding when used with `satisfies`. Inline the fetch instead.
- `deleteMessage` being `undefined` → App.tsx removes the message from local state only, no API call
- **Username generation — do NOT write your own name arrays in a new provider.** Import and call `generateUsername` from `@/lib/names` instead:
  ```ts
  import { generateUsername } from "@/lib/names"
  // then in the provider object:
  generateUsername() { return generateUsername() },
  ```
  Only skip `generateUsername` entirely if you want the shared generator to be used automatically via the App.tsx fallback (same result). Adding names belongs in `src/lib/names.ts`, not in provider files.

### Complete worked example

Replace `myservice` / `myservice.com` throughout. This compiles and satisfies the interface as-is.

**`src/providers/myservice.provider.ts`**

```ts
import type { ProviderPlugin } from "./types"
import type { MessageMeta, MessageFull } from "@/lib/types"
import { generateUsername } from "@/lib/names"

const BASE     = "https://kilomail.vercel.app"
const POLL_MS  = 5_000

function relativeTime(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default {
  id:      "myservice",
  name:    "MyService",
  domains: ["myservice.com"],
  enabled: true,

  generateUsername(_domain) { return generateUsername() },

  async fetchInbox(email) {
    const res = await fetch(
      `${BASE}/api/providers/myservice?action=inbox&email=${encodeURIComponent(email)}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  // SSE variant — swap for polling block below if the upstream has no push API
  streamInbox(email, onUpdate, onStatusChange) {
    const es = new EventSource(
      `${BASE}/api/providers/myservice?action=stream&email=${encodeURIComponent(email)}`
    )
    es.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === "connected") onStatusChange(true)
      if (d.type === "update")    onUpdate(d.messages as MessageMeta[])
    }
    es.onerror = () => onStatusChange(false)
    return () => es.close()
  },

  // Polling variant (use instead of SSE when upstream has no push):
  // streamInbox(email, onUpdate, onStatusChange) {
  //   let active = true
  //   const poll = async () => {
  //     if (!active) return
  //     try {
  //       const res = await fetch(`${BASE}/api/providers/myservice?action=inbox&email=${encodeURIComponent(email)}`)
  //       if (!res.ok) throw new Error("fetch failed")
  //       const data = await res.json()
  //       onUpdate(Array.isArray(data) ? data : [])
  //       onStatusChange(true)
  //     } catch { onStatusChange(false) }
  //     if (active) setTimeout(poll, POLL_MS)
  //   }
  //   poll()
  //   return () => { active = false }
  // },

  async fetchMessage(email, meta) {
    const res = await fetch(
      `${BASE}/api/providers/myservice?action=read&email=${encodeURIComponent(email)}&id=${encodeURIComponent(meta.id)}`
    )
    if (!res.ok) return null
    return res.json() as Promise<MessageFull>
  },

  // Remove if upstream has no delete API — UI will hide the button automatically
  async deleteMessage(email, id) {
    await fetch(
      `${BASE}/api/providers/myservice?action=delete&email=${encodeURIComponent(email)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    )
  },
} satisfies ProviderPlugin
```

**`api/providers/myservice.ts`**

```ts
const UPSTREAM = "https://api.myservice.com"  // swap for the real upstream base URL

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") ?? ""
  const email  = (url.searchParams.get("email") ?? "").toLowerCase().trim()
  if (!email) return json({ error: "Missing email" }, 400)

  // ── inbox list ─────────────────────────────────────────────────────────
  if (action === "inbox") {
    const r = await fetch(`${UPSTREAM}/messages?email=${encodeURIComponent(email)}`)
    if (!r.ok) return json([], 200)
    const raw = await r.json()
    const now = Date.now()
    return json((raw.messages ?? []).map((m: any) => ({
      id:         String(m.id),
      from:       m.sender ?? "unknown",
      subject:    m.subject ?? "(no subject)",
      receivedAt: m.date ?? new Date().toISOString(),
      read:       false,
      timeAgo:    relativeTime(m.date ?? new Date().toISOString(), now),
    })))
  }

  // ── SSE stream ─────────────────────────────────────────────────────────
  if (action === "stream") {
    const encoder = new TextEncoder()
    let lastHash = ""
    let closed   = false

    const stream = new ReadableStream({
      start(ctrl) {
        const send = (data: object) => {
          if (closed) return
          try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
        }
        send({ type: "connected" })

        const poll = async () => {
          if (closed) return
          try {
            const r = await fetch(`${UPSTREAM}/messages?email=${encodeURIComponent(email)}`)
            if (r.ok) {
              const raw = await r.json()
              const msgs = raw.messages ?? []
              const hash = msgs.map((m: any) => m.id).join(",")
              if (hash !== lastHash) {
                lastHash = hash
                const now = Date.now()
                send({ type: "update", messages: msgs.map((m: any) => ({
                  id: String(m.id), from: m.sender ?? "unknown",
                  subject: m.subject ?? "(no subject)",
                  receivedAt: m.date ?? new Date().toISOString(),
                  read: false, timeAgo: relativeTime(m.date ?? new Date().toISOString(), now),
                })) })
              }
            }
          } catch {}
          if (!closed) setTimeout(poll, 5_000)
        }
        poll()
        setTimeout(() => { closed = true; try { ctrl.close() } catch {} }, 295_000)
      },
      cancel() { closed = true },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*", "X-Accel-Buffering": "no",
      },
    })
  }

  // ── read single message ────────────────────────────────────────────────
  if (action === "read") {
    const id = url.searchParams.get("id") ?? ""
    if (!id) return json({ error: "Missing id" }, 400)
    const r = await fetch(`${UPSTREAM}/messages/${encodeURIComponent(id)}`)
    if (!r.ok) return json({ error: "Not found" }, 404)
    const m = await r.json()
    return json({
      id:         String(m.id),
      from:       m.sender ?? "unknown",
      subject:    m.subject ?? "(no subject)",
      receivedAt: m.date ?? new Date().toISOString(),
      read:       true,
      timeAgo:    relativeTime(m.date ?? new Date().toISOString(), Date.now()),
      text:       m.text ?? "",
      html:       m.html ?? "",
    })
  }

  // ── delete (optional) ──────────────────────────────────────────────────
  if (action === "delete") {
    const id = url.searchParams.get("id") ?? ""
    if (!id) return json({ error: "Missing id" }, 400)
    await fetch(`${UPSTREAM}/messages/${encodeURIComponent(id)}`, { method: "DELETE" })
    return json({ ok: true })
  }

  return json({ error: "Unknown action" }, 400)
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const config = { runtime: "edge" }
```

### After creating the two files — checklist

- [ ] `domains` in the provider file don't overlap with any existing provider
- [ ] `id` is unique across all providers (`kilolabs`, `hd`, `edu`, …)
- [ ] `relativeTime` is local to each API file — do not import across files
- [ ] Add the new domain(s) to `.github/scripts/health-check.mjs` under a new provider entry so CI monitors it
- [ ] If the upstream requires auth tokens, add them as Vercel env vars and read via `process.env.*` in the `api/` file only — never in `src/`

---

## Redis schema (kilolabs only)

```
inbox:<email>          Redis hash — field = message id, value = JSON MessageMeta
body:<id>              Redis string — JSON { text, html }  (TTL per message)
```

- Inbox hash has no TTL (`PERSIST`); individual body keys expire after 30 days
- Messages whose `expiresAt` has passed are filtered out on read and pruned from the hash
- Max 50 messages per inbox — oldest trimmed on write when exceeded
- Worker TTL is only 10 min (`worker/index.ts`) — differs from webhook TTL (30 days). Worker is for live transient mail; webhook is for durable storage.

---

## App state (App.tsx)

All meaningful state lives in `App.tsx`. There is no global store.

```
email          string            current inbox address
messages       MessageMeta[]     current inbox list
fullMsg        MessageFull|null  currently open message
loading        boolean           initial inbox fetch in progress
connected      boolean           SSE/poll connection status
selectedId     string|null       open message id
panel          Panel             "inbox" | "history"
bodyCodes      Record<id,code>   prefetched OTP codes from message bodies
```

`msgCache` (ref) — `Map<id, MessageFull>` — in-memory cache, cleared on inbox switch.
`readIds` (ref) — `Set<id>` — tracks read state locally; avoids roundtrip on re-open.
`stopStream` (ref) — holds the cleanup fn returned by `provider.streamInbox`.

---

## CI workflow (`.github/workflows/ci.yml`)

Three jobs, one file:

| Job | When | Does |
|---|---|---|
| `check` | PR + manual | `tsc --build` on `src/`, inline tsconfig for `api/`, ESLint |
| `build` | PR + manual (after check) | `npm run build` (same as Vercel: `tsc -b && vite build`) |
| `health` | Schedule every 6 h + manual | Runs `.github/scripts/health-check.mjs` against live URL |

No push triggers. No deploy steps anywhere.

Health job needs secret: `KILOMAIL_BASE_URL` (e.g. `https://kilomail.vercel.app`).

---

## Env vars

| Var | Used by | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `api/`, `worker/` | Redis connection |
| `UPSTASH_REDIS_REST_TOKEN` | `api/`, `worker/` | Redis auth |
| `WEBHOOK_SECRET` | `api/webhook.ts` | Validates inbound mail from Cloudflare |
| `TEST_MODE` | `api/test.ts` | Set to `"1"` to enable test email injection endpoint |
| `DOMAIN` | `worker/wrangler.toml` | Cloudflare Worker binding for the MX domain |

---

## Things that must not change without care

- **`src/providers/types.ts`** — the `ProviderPlugin` interface. Changing it requires updating all three provider files.
- **`src/providers/registry.ts`** — auto-discovery. Never edit.
- **Redis key schema** — `inbox:<email>` hash + `body:<id>` string. `api/inbox/[email].ts`, `api/webhook.ts`, `api/test.ts`, and `worker/index.ts` all depend on this shape.
- **SSE event format** — `{ type: "connected" }` / `{ type: "update", messages: [] }`. App.tsx parses this directly.
- **`satisfies ProviderPlugin`** on every provider default export — keeps TypeScript honest without widening the return type.

---

## Known patterns / gotchas

- `timeAgo` is computed at fetch time and not re-computed on re-render. Stale for long-lived sessions — acceptable for a disposable inbox tool.
- `extractCode()` in `App.tsx` prefetches OTP codes from message bodies and caches them in `bodyCodes` so the inbox list can show them without opening the message.
- `Landing.tsx` imports `DOMAIN` from `@/lib/types` — make sure that export exists before touching `types.ts`.
- `useTheme.ts` lives in `src/hooks/` only. The copy that was in `src/lib/` has been deleted.
- `SettingsView.tsx` has been deleted — it was never wired up. If you want a settings panel, add `"settings"` back to the `Panel` type and render it in `App.tsx`.
- `hd.provider.ts` polling: the poll loop inlines its own fetch rather than calling `this.fetchInbox` — `this` is not available in an object literal passed to `satisfies`.

