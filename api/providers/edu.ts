/**
 * Proxy for EDU domains: iunp.edu.rs, warsawuni.edu.pl
 * Route: /api/providers/edu
 *
 * ?action=inbox&email=          → message list (creates inbox if needed)
 * ?action=stream&email=         → SSE stream
 * ?action=read&email=&uid=      → full message body
 */

const EDU_BASE = "https://api.getedumail.com/getedumail/emails"

const EDU_DOMAINS: ReadonlySet<string> = new Set([
  "iunp.edu.rs",
  "warsawuni.edu.pl",
])

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const EDU_POLL_MS = 500
const EDU_MAX_MS  = 295_000

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") ?? ""
  const email  = (url.searchParams.get("email") ?? "").toLowerCase().trim()
  if (!email) return json({ error: "Missing email" }, 400)

  const domain = email.split("@")[1] ?? ""
  if (!EDU_DOMAINS.has(domain)) return json({ error: "Not an EDU domain" }, 400)

  // ── SSE stream ─────────────────────────────────────────────────────────
  if (action === "stream") {
    await ensureAccount(email)
    const encoder = new TextEncoder()
    let lastHash  = ""
    let closed    = false

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
            const r = await fetch(`${EDU_BASE}/${encodeURIComponent(email)}/list?page=1`, { headers: { accept: "application/json" } })
            if (r.ok) {
              const d = await r.json() as { emails: EduEmail[] }
              const emails = d.emails ?? []
              const hash = `${emails.length}:${emails.map(m => m.uid).join(",")}`
              if (hash !== lastHash) {
                lastHash = hash
                send({ type: "update", messages: emails.map(m => mapEmail(m, Date.now())) })
              }
            }
          } catch {}
          if (!closed) setTimeout(poll, EDU_POLL_MS)
        }

        poll()
        setTimeout(() => { closed = true; try { ctrl.close() } catch {} }, EDU_MAX_MS)
      },
      cancel() { closed = true },
    })

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*", "X-Accel-Buffering": "no" },
    })
  }

  // ── inbox list ─────────────────────────────────────────────────────────
  if (action === "inbox") {
    await ensureAccount(email)
    const r = await fetch(`${EDU_BASE}/${encodeURIComponent(email)}/list?page=1`, { headers: { accept: "application/json" } })
    if (!r.ok) return json([], 200)
    const d = await r.json() as { emails: EduEmail[] }
    const now = Date.now()
    return json((d.emails ?? []).map(m => mapEmail(m, now)))
  }

  // ── read single message ────────────────────────────────────────────────
  if (action === "read") {
    const uid = url.searchParams.get("uid") ?? ""
    if (!uid) return json({ error: "Missing uid" }, 400)
    await ensureAccount(email)
    const r = await fetch(`${EDU_BASE}/${encodeURIComponent(email)}/list?page=1`, { headers: { accept: "application/json" } })
    if (!r.ok) return json({ error: "Not found" }, 404)
    const d = await r.json() as { emails: EduEmail[] }
    const msg = d.emails?.find(m => String(m.uid) === uid)
    if (!msg) return json({ error: "Not found" }, 404)
    return json({ ...mapEmail(msg, Date.now()), read: true, text: msg.body?.text ?? "", html: msg.body?.html ?? "" })
  }

  return json({ error: "Unknown action" }, 400)
}

// ── helpers ────────────────────────────────────────────────────────────────

interface EduEmail {
  uid: number
  subject: string
  from: { name: string; address: string }[]
  date: string
  body: { text: string; html: string }
}

const ensuredCache = new Set<string>()

async function ensureAccount(email: string): Promise<void> {
  if (ensuredCache.has(email)) return
  try {
    const r = await fetch(`${EDU_BASE}/availability?email=${encodeURIComponent(email)}`, { headers: { accept: "application/json" } })
    const d = await r.json() as { isMailAvailable: boolean; isMailAlreadyCreated: boolean }
    if (!d.isMailAlreadyCreated && d.isMailAvailable) {
      await fetch(`${EDU_BASE}/guest`, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ email }) })
    }
    ensuredCache.add(email)
  } catch {}
}

function mapEmail(m: EduEmail, now: number) {
  return {
    id:         String(m.uid),
    from:       m.from?.[0]?.name ? `${m.from[0].name} <${m.from[0].address}>` : (m.from?.[0]?.address ?? "unknown"),
    subject:    m.subject ?? "(no subject)",
    receivedAt: m.date ?? new Date().toISOString(),
    read:       false,
    timeAgo:    relativeTime(m.date ?? new Date().toISOString(), now),
  }
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (diff < 0)     return "just now"
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const config = { runtime: "edge" }
