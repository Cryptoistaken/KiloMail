const TMAILOR_API = "https://tmailor.com/api"

const HEADERS = {
  "Content-Type": "application/json",
  "Origin": "https://tmailor.com",
  "Referer": "https://tmailor.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// In-memory state keyed by the tmailor-generated email address
const sessions   = new Map<string, string>()               // email -> accesstoken
const inboxCodes = new Map<string, string>()                // email -> latest code from listinbox
const msgTokens  = new Map<string, Map<string, string>>()   // email -> Map<messageId, emailToken>

let counter = 0

function toISO(ts: number | string): string {
  const n = typeof ts === "string" ? Number.parseInt(ts, 10) : ts
  return new Date(n * 1000).toISOString()
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

async function tmailorPost(body: unknown): Promise<any> {
  const res = await fetch(TMAILOR_API, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`TMailor HTTP ${res.status}`)
  const text = await res.text()
  try { return JSON.parse(text) } catch {
    throw new Error("TMailor returned non-JSON (Cloudflare challenge)")
  }
}

function mapMsg(id: string, m: any, now: number) {
  return {
    id:         id,
    from:       m.sender_name ? `${m.sender_name} <${m.sender_email}>` : (m.sender_email ?? "unknown"),
    subject:    m.subject ?? "(no subject)",
    receivedAt: toISO(m.receive_time ?? 0),
    read:       m.read === 1,
    timeAgo:    relativeTime(toISO(m.receive_time ?? 0), now),
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") ?? ""
  const email  = (url.searchParams.get("email") ?? "").toLowerCase().trim()

  // ── newemail ──────────────────────────────────────────────────────────
  if (action === "newemail") {
    const d = await tmailorPost({ action: "newemail", curentToken: "", fbToken: null })
    if (d.msg !== "ok" || !d.email) return json({ error: "newemail failed" }, 502)
    sessions.set(d.email, d.accesstoken)
    return json({ email: d.email })
  }

  if (!email) return json({ error: "Missing email" }, 400)

  // ── inbox ─────────────────────────────────────────────────────────────
  if (action === "inbox") {
    const token = sessions.get(email)
    if (!token) return json([], 200)

    const d = await tmailorPost({
      action: "listinbox", accesstoken: token,
      fbToken: null, curentToken: "null",
    })
    if (d.msg !== "ok") return json([], 200)

    inboxCodes.set(email, d.code ?? "")
    const now   = Date.now()
    const tmap  = new Map<string, string>()
    const msgs: any[] = []

    if (d.data && typeof d.data === "object") {
      for (const [id, m] of Object.entries(d.data)) {
        const msg = m as any
        tmap.set(id, msg.email_id ?? id)
        msgs.push(mapMsg(id, msg, now))
      }
    }
    msgTokens.set(email, tmap)
    return json(msgs)
  }

  // ── stream (SSE) ──────────────────────────────────────────────────────
  if (action === "stream") {
    const token = sessions.get(email)
    if (!token) {
      // No session yet — create one so the user can start fresh
      const d = await tmailorPost({ action: "newemail", curentToken: "", fbToken: null })
      if (d.msg !== "ok" || !d.email || !d.accesstoken)
        return json({ error: "cannot create session" }, 502)
      sessions.set(d.email, d.accesstoken)
    }

    const encoder = new TextEncoder()
    let lastHash = ""
    let closed = false

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
            const tok = sessions.get(email)
            if (!tok) { if (!closed) setTimeout(poll, 5000); return }

            const d = await tmailorPost({
              action: "listinbox", accesstoken: tok,
              fbToken: null, curentToken: "null",
            })
            if (d.msg === "ok" && d.data && typeof d.data === "object") {
              const ids = Object.keys(d.data).sort().join(",")
              if (ids !== lastHash) {
                lastHash = ids
                inboxCodes.set(email, d.code ?? "")
                const now = Date.now()
                const tmap = new Map<string, string>()
                const msgs: any[] = []
                for (const [id, m] of Object.entries(d.data)) {
                  const msg = m as any
                  tmap.set(id, msg.email_id ?? id)
                  msgs.push(mapMsg(id, msg, now))
                }
                msgTokens.set(email, tmap)
                send({ type: "update", messages: msgs })
              }
            }
          } catch {}
          if (!closed) setTimeout(poll, 5000)
        }

        poll()
        setTimeout(() => { closed = true; try { ctrl.close() } catch {} }, 295_000)
      },
      cancel() { closed = true },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      },
    })
  }

  // ── read ──────────────────────────────────────────────────────────────
  if (action === "read") {
    const id = url.searchParams.get("id") ?? ""
    if (!id) return json({ error: "Missing id" }, 400)

    const token   = sessions.get(email)
    const code    = inboxCodes.get(email)
    const tmap    = msgTokens.get(email)
    if (!token)  return json({ error: "Session not found" }, 404)
    if (!code)   return json({ error: "Inbox not loaded yet" }, 404)
    if (!tmap)   return json({ error: "Message index missing" }, 404)

    const emailToken = tmap.get(id) ?? id

    const d = await tmailorPost({
      action: "read", accesstoken: token,
      email_code: code, email_token: emailToken,
      fbToken: null, curentToken: "null",
    })
    if (d.msg !== "ok" || !d.data)
      return json({ error: "Read failed" }, 502)

    const m = d.data
    const now = Date.now()
    return json({
      id:         m.id ?? id,
      from:       m.sender_name ? `${m.sender_name} <${m.sender_email}>` : (m.sender_email ?? "unknown"),
      subject:    m.subject ?? "(no subject)",
      receivedAt: toISO(m.receive_time ?? 0),
      read:       true,
      timeAgo:    relativeTime(toISO(m.receive_time ?? 0), now),
      text:       "",
      html:       m.body ?? "",
    })
  }

  return json({ error: "Unknown action" }, 400)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const config = { runtime: "edge" }
