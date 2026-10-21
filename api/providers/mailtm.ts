const UPSTREAM = "https://api.mail.tm"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface MailAddress { address?: string; name?: string }
interface Mail {
  id?: string
  from?: MailAddress
  subject?: string
  seen?: boolean
  createdAt?: string
  text?: string
  html?: string | string[]
}
interface Meta {
  id: string
  from: string
  subject: string
  receivedAt: string
  read: boolean
  timeAgo: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") ?? ""
  // EventSource cannot set headers, so the stream action also accepts ?token=.
  const token  = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
    || url.searchParams.get("token")
    || ""

  // ── create account + token (password travels in the body, never in the URL) ──
  if (action === "create") {
    const body     = await req.json().catch(() => null) as { address?: string; password?: string } | null
    const address  = (body?.address ?? "").toLowerCase().trim()
    const password = body?.password ?? ""
    if (!address || !password) return json({ error: "Missing address or password" }, 400)

    const created = await post(`${UPSTREAM}/accounts`, { address, password })
    if (!created.ok) return json({ error: await detail(created) }, created.status)

    const tok = await post(`${UPSTREAM}/token`, { address, password })
    if (!tok.ok) return json({ error: await detail(tok) }, tok.status)
    const t = await tok.json() as { token?: string }
    return json({ address, token: String(t.token ?? "") }, 201)
  }

  if (!token) return json({ error: "Missing token" }, 401)

  // ── inbox list ─────────────────────────────────────────────────────────
  if (action === "inbox") {
    const r = await fetch(`${UPSTREAM}/messages`, { headers: auth(token) })
    if (!r.ok) return json({ error: await detail(r) }, r.status)
    return json(toMeta(await r.json(), Date.now()))
  }

  // ── SSE stream ─────────────────────────────────────────────────────────
  if (action === "stream") {
    const encoder = new TextEncoder()
    let lastHash: string | null = null
    let closed    = false

    const stream = new ReadableStream({
      start(ctrl) {
        const send = (data: object) => {
          if (closed) return
          try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { closed = true }
        }
        send({ type: "connected" })

        const poll = async () => {
          if (closed) return
          try {
            const r = await fetch(`${UPSTREAM}/messages`, { headers: auth(token) })
            if (r.ok) {
              const msgs = toMeta(await r.json(), Date.now())
              const hash = msgs.map(m => m.id).join(",")
              if (hash !== lastHash) {
                lastHash = hash
                send({ type: "update", messages: msgs })
              }
            }
          } catch { /* upstream hiccup - keep the stream open */ }
          if (!closed) setTimeout(poll, 5_000)
        }
        poll()
        setTimeout(() => { closed = true; try { ctrl.close() } catch { /* already closed */ } }, 295_000)
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
    const r = await fetch(`${UPSTREAM}/messages/${encodeURIComponent(id)}`, { headers: auth(token) })
    if (!r.ok) return json({ error: "Not found" }, r.status === 404 ? 404 : r.status)
    const m = await r.json() as Mail
    // mail.tm returns html as an array of parts, but MessageFull.html is a single string.
    const html = Array.isArray(m.html) ? m.html.join("") : (m.html ?? "")
    return json({ ...meta(m), read: true, text: m.text ?? "", html })
  }

  // ── delete ─────────────────────────────────────────────────────────────
  if (action === "delete") {
    const id = url.searchParams.get("id") ?? ""
    if (!id) return json({ error: "Missing id" }, 400)
    const r = await fetch(`${UPSTREAM}/messages/${encodeURIComponent(id)}`, {
      method: "DELETE", headers: auth(token),
    })
    if (!r.ok && r.status !== 404) return json({ error: await detail(r) }, r.status)
    return json({ ok: true })
  }

  return json({ error: "Unknown action" }, 400)
}

// the list endpoint is a plain array today; the hydra:member shape is kept as a fallback
function toMeta(raw: unknown, now: number): Meta[] {
  const list = Array.isArray(raw)
    ? raw as Mail[]
    : (raw as Record<string, Mail[]> | null)?.["hydra:member"] ?? []
  return list.map(m => meta(m, now))
}

function meta(m: Mail, now = Date.now()): Meta {
  const receivedAt = iso(m.createdAt)
  const address    = m.from?.address ?? ""
  const name       = m.from?.name ?? ""
  return {
    id:         String(m.id ?? ""),
    from:       name ? `${name} <${address}>` : (address || "unknown"),
    subject:    m.subject || "(no subject)",
    receivedAt,
    read:       m.seen === true,
    timeAgo:    relativeTime(receivedAt, now),
  }
}

function iso(value?: string): string {
  const d = new Date(value ?? "")
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function relativeTime(isoString: string, now: number): string {
  const diff = Math.max(0, Math.floor((now - new Date(isoString).getTime()) / 1000))
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function auth(token: string): HeadersInit {
  return { Accept: "application/json", Authorization: `Bearer ${token}` }
}

function post(url: string, body: object): Promise<Response> {
  return fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify(body),
  })
}

async function detail(r: Response): Promise<string> {
  const text = await r.text().catch(() => "")
  return text.slice(0, 300) || `upstream ${r.status}`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const config = { runtime: "edge" }
