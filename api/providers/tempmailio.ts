const UPSTREAM = "https://api.internal.temp-mail.io/api/v3"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// Probed against the live API on 2026-10-20:
//   POST   /email/new {domain,name}      -> {email,token}   (server lower-cases the local part)
//   GET    /email/{email}/messages       -> [{id,from,to,subject,body_text,body_html,created_at,attachments}]
//   GET    /email/{email}/messages/{id}  -> 404 - no such route (so `read` filters the list instead)
//   DELETE /email/{email}/messages/{id}  -> 404 - no such route (so deleteMessage is not wired)
//   DELETE /email/{email} <token>        -> 200, but needs the create token and wipes the WHOLE address
//
// Auth: none needed. The list/read routes answer for any existing address with no token at all, so
// nothing is stored client-side and this function stays stateless. An address that was never created
// answers 400 {"code":101,"message":"Email not found"}, which is why inbox/stream create it on demand
// (that is also what makes a hand-typed custom local part work).
const HEADERS = { "Application-Name": "temp-mail", "Application-Version": "5.0.0" }

interface Mail {
  id:        string
  from?:     string
  subject?:  string
  body_text?: string | null
  body_html?: string | null
  created_at?: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") ?? ""
  // upstream stores addresses lower-cased and its lookup is case sensitive
  const email  = (url.searchParams.get("email") ?? "").toLowerCase().trim()

  // ── create ─────────────────────────────────────────────────────────────
  if (action === "create") {
    const domain = (url.searchParams.get("domain") ?? "").toLowerCase().trim()
    if (!domain) return json({ error: "Missing domain" }, 400)
    const address = await createEmail(domain, url.searchParams.get("name") ?? "")
    if (!address) return json({ error: "Create failed" }, 502)
    return json({ email: address })
  }

  if (!email) return json({ error: "Missing email" }, 400)

  if (action === "inbox") return json(await list(email))

  // ── SSE stream ─────────────────────────────────────────────────────────
  if (action === "stream") {
    const encoder = new TextEncoder()
    let lastHash: string | null = null
    let closed   = false

    const stream = new ReadableStream({
      start(ctrl) {
        const send = (data: object) => {
          if (closed) return
          try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* stream closed */ }
        }
        send({ type: "connected" })

        const poll = async () => {
          if (closed) return
          try {
            const msgs = await list(email)
            const hash = msgs.map(m => m.id).join(",")
            if (hash !== lastHash) {
              lastHash = hash
              send({ type: "update", messages: msgs })
            }
          } catch { /* keep polling through transient upstream errors */ }
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
    // no per-message route upstream; the list payload already carries both bodies
    const r = await fetch(listUrl(email), { headers: HEADERS })
    if (!r.ok) return json({ error: "Not found" }, 404)
    const raw = await r.json() as Mail[]
    const m = (Array.isArray(raw) ? raw : []).find(x => String(x.id) === id)
    if (!m) return json({ error: "Not found" }, 404)
    return json({
      ...meta(m, Date.now()),
      read: true,
      text: m.body_text ?? "",
      html: m.body_html ?? "",
    })
  }

  // ── delete ─────────────────────────────────────────────────────────────
  // Kept so a caller gets an explicit answer: the only delete upstream is the whole address, and it
  // would wipe every message instead of one, so the provider leaves deleteMessage undefined.
  if (action === "delete") return json({ error: "temp-mail.io has no per-message delete" }, 501)

  return json({ error: "Unknown action" }, 400)
}

async function list(email: string) {
  const r = await fetch(listUrl(email), { headers: HEADERS })
  if (!r.ok) {
    // 400 code 101 = this address was never created; create it so a typed custom inbox works
    const at = email.lastIndexOf("@")
    if (at > 0) await createEmail(email.slice(at + 1), email.slice(0, at))
    return []
  }
  const raw = await r.json() as Mail[]
  const now = Date.now()
  // upstream returns oldest first, the inbox expects newest first
  return (Array.isArray(raw) ? raw : []).map(m => meta(m, now)).reverse()
}

// Empty token = the local part is already registered (shared with whoever created it first), so a
// second attempt with a different name is needed. 4 tries, then give up.
async function createEmail(domain: string, name: string): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = attempt === 0 ? name : `${name}${Math.floor(Math.random() * 10_000)}`
    const r = await fetch(`${UPSTREAM}/email/new`, {
      method:  "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body:    JSON.stringify({ domain, name: local }),
    })
    if (!r.ok) return null
    const d = await r.json() as { email?: string; token?: string }
    if (!d.email) return null
    // an unknown domain is silently swapped for a live one - refuse rather than hand back another domain
    if (d.email.slice(d.email.lastIndexOf("@") + 1) !== domain) return null
    if (d.token) return d.email
  }
  return null
}

function listUrl(email: string) {
  // the upstream does not decode %40 - a percent-encoded address answers "Email not found",
  // so the local part and host are encoded separately and the @ is left literal
  return `${UPSTREAM}/email/${email.split("@").map(encodeURIComponent).join("@")}/messages`
}

function meta(m: Mail, now: number) {
  const receivedAt = toIso(m.created_at)
  return {
    id:         String(m.id),
    from:       m.from || "unknown",
    subject:    m.subject || "(no subject)",
    receivedAt,
    read:       false,
    timeAgo:    relativeTime(receivedAt, now),
  }
}

function toIso(t: string | undefined): string {
  if (!t) return new Date().toISOString()
  const d = new Date(t)   // "2026-10-20T17:38:26.809891Z" - V8 truncates the microseconds
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
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
