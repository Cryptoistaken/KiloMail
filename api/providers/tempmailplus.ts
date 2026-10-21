const UPSTREAM = "https://tempmail.plus"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// list rows carry `time` ("2026-10-20 20:38:07", Moscow, no zone); read carries an
// RFC 2822 `date` instead. Both are normalised to ISO here.
interface Mail {
  result?: boolean
  mail_id: number
  from_name?: string
  from_mail?: string
  subject?: string
  time?: string
  date?: string
  is_new?: boolean
  text?: string
  html?: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const url    = new URL(req.url)
  const action = url.searchParams.get("action") ?? ""
  const email  = (url.searchParams.get("email") ?? "").toLowerCase().trim()
  if (!email) return json({ error: "Missing email" }, 400)

  // tempmail.plus has no push API and no `epin` on the API (verified: reads work
  // without it and a wrong pin is ignored), so both routes poll the same list.
  if (action === "inbox") return json(await list(email))

  if (action === "stream") {
    const encoder = new TextEncoder()
    let lastHash = ""
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
            const hash = msgs.map(m => `${m.id}:${m.read}`).join(",")
            if (hash !== lastHash) {
              lastHash = hash
              send({ type: "update", messages: msgs })
            }
          } catch { /* keep polling */ }
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

  if (action === "read") {
    const id = url.searchParams.get("id") ?? ""
    if (!id) return json({ error: "Missing id" }, 400)
    const r = await fetch(`${UPSTREAM}/api/mails/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`)
    if (!r.ok) return json({ error: "Not found" }, 404)
    const m: Mail = await r.json()
    if (m?.result === false) return json({ error: "Not found" }, 404)
    // reading marks the mail seen upstream, so report it as read
    return json({ ...meta(m, Date.now()), read: true, text: m.text ?? "", html: m.html ?? "" })
  }

  if (action === "delete") {
    const id = url.searchParams.get("id") ?? ""
    if (!id) return json({ error: "Missing id" }, 400)
    const r = await fetch(
      `${UPSTREAM}/api/mails/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`,
      { method: "DELETE" },
    )
    if (!r.ok) return json({ error: "Delete failed" }, 502)
    return json({ ok: true })
  }

  return json({ error: "Unknown action" }, 400)
}

async function list(email: string) {
  const r = await fetch(`${UPSTREAM}/api/mails?email=${encodeURIComponent(email)}&limit=20`)
  if (!r.ok) return []
  const raw = await r.json()
  if (raw?.result !== true) return []
  const now = Date.now()
  return ((raw.mail_list ?? []) as Mail[]).map(m => meta(m, now))
}

function meta(m: Mail, now: number) {
  const receivedAt = toIso(m.time ?? m.date)
  return {
    id:         String(m.mail_id),
    from:       m.from_name && m.from_mail ? `${m.from_name} <${m.from_mail}>` : (m.from_mail ?? "unknown"),
    subject:    m.subject || "(no subject)",
    receivedAt,
    read:       m.is_new === false,
    timeAgo:    relativeTime(receivedAt, now),
  }
}

function toIso(t: string | undefined): string {
  if (!t) return new Date().toISOString()
  // bare "YYYY-MM-DD HH:MM:SS" is Moscow time (UTC+3, no DST); RFC 2822 has a zone
  const d = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(t)
    ? new Date(`${t.replace(" ", "T")}+03:00`)
    : new Date(t)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.max(Math.floor((now - new Date(iso).getTime()) / 1000), 0) // sender clock may be slightly ahead
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const config = { runtime: "edge" }
