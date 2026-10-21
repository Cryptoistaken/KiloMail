const UPSTREAM = "https://api.maildrop.cc/graphql"
const POLL_MS  = 5_000

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// maildrop's own documents - the field is `inbox`, not `messages`
const LIST_QUERY = `query($mailbox: String!) {
  inbox(mailbox: $mailbox) { id headerfrom subject date }
}`

const ONE_QUERY = `query($mailbox: String!, $id: String!) {
  message(mailbox: $mailbox, id: $id) { id headerfrom subject date html data }
}`

const DELETE_MUTATION = `mutation($mailbox: String!, $id: String!) {
  delete(mailbox: $mailbox, id: $id)
}`

interface RawMessage {
  id?: string
  headerfrom?: string
  subject?: string
  date?: string
  html?: string
  data?: string
}

type GqlData = {
  inbox?: RawMessage[]
  message?: RawMessage
  delete?: boolean
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const url     = new URL(req.url)
  const action  = url.searchParams.get("action") ?? ""
  const email   = (url.searchParams.get("email") ?? "").toLowerCase().trim()
  const mailbox = email.split("@")[0] ?? ""
  if (!mailbox) return json({ error: "Missing email" }, 400)

  // -- inbox list ---------------------------------------------------------
  if (action === "inbox") {
    const data = await gql(LIST_QUERY, { mailbox })
    return json(toMeta(data?.inbox ?? [], Date.now()))
  }

  // -- SSE stream ---------------------------------------------------------
  if (action === "stream") {
    const encoder = new TextEncoder()
    let lastIds = ""
    let closed  = false

    const stream = new ReadableStream({
      start(ctrl) {
        const send = (payload: object) => {
          if (closed) return
          try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)) } catch { /* client gone */ }
        }
        send({ type: "connected" })

        const poll = async () => {
          if (closed) return
          try {
            const data = await gql(LIST_QUERY, { mailbox })
            if (data) {
              const list = data.inbox ?? []
              const ids  = list.map(m => m.id).join(",")
              if (ids !== lastIds) {
                lastIds = ids
                send({ type: "update", messages: toMeta(list, Date.now()) })
              }
            }
          } catch { /* next tick retries */ }
          if (!closed) setTimeout(poll, POLL_MS)
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

  // -- read single message ------------------------------------------------
  if (action === "read") {
    const id = (url.searchParams.get("id") ?? "").trim()
    if (!id) return json({ error: "Missing id" }, 400)

    const data = await gql(ONE_QUERY, { mailbox, id })
    const m    = data?.message
    if (!m) return json({ error: "Not found" }, 404)

    return json({
      ...toMeta([m], Date.now())[0],
      read: true,
      text: plainText(m),
      html: m.html ?? "",
    })
  }

  // -- delete -------------------------------------------------------------
  if (action === "delete") {
    const id = (url.searchParams.get("id") ?? "").trim()
    if (!id) return json({ error: "Missing id" }, 400)

    const data = await gql(DELETE_MUTATION, { mailbox, id })
    if (data?.delete !== true) return json({ error: "Delete failed" }, 502)
    return json({ ok: true })
  }

  return json({ error: "Unknown action" }, 400)
}

function toMeta(list: RawMessage[], now: number) {
  return list.map(m => {
    const receivedAt = toIso(m.date)
    return {
      id:         String(m.id ?? ""),
      from:       squash(m.headerfrom) || "unknown",
      subject:    squash(m.subject) || "(no subject)",
      receivedAt,
      read:       false,
      timeAgo:    relativeTime(receivedAt, now),
    }
  })
}

/** maildrop answers ISO today; epoch seconds are tolerated for old/proxied nodes. */
function toIso(date?: string): string {
  if (!date) return new Date().toISOString()
  if (/^\d+$/.test(date)) {
    const n = Number(date)
    return new Date(n < 1e12 ? n * 1000 : n).toISOString()
  }
  const t = Date.parse(date)
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString()
}

/** headerfrom carries folded-header whitespace: "Name\r\n\t <mail@host>" */
function squash(v?: string): string {
  return String(v ?? "").replace(/\s+/g, " ").trim()
}

/**
 * maildrop has no `text` field: the html part, or the raw MIME in `data`.
 * MessageView injects `text` as HTML, so `<` is escaped - otherwise a decoded
 * `&lt;img onerror=...&gt;` from the html part would come back as a live tag.
 */
function plainText(m: RawMessage): string {
  const source = (m.html || m.data || "").replace(/\r\n?/g, "\n")
  if (!source) return ""
  if (m.html) {
    const text = decodeEntities(
      source
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
    )
    return tidy(text)
  }
  // no HTML part: `data` is the raw RFC822 source, so drop its header block
  return tidy(source.split(/\n\s*\n/).slice(1).join("\n\n"))
}

function tidy(text: string): string {
  return text.replace(/</g, "&lt;").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

async function gql(query: string, variables: Record<string, string>): Promise<GqlData | null> {
  try {
    const r = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    })
    if (!r.ok) return null
    const payload = await r.json()
    if (payload?.errors?.length) return null
    return payload?.data ?? null
  } catch {
    return null
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

export const config = { runtime: "edge" }
