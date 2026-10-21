const UPSTREAM = "https://api.guerrillamail.com/ajax.php";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface GmMail {
  mail_id?:        string | number;
  mail_from?:      string;
  mail_subject?:   string;
  mail_timestamp?: string | number;
  mail_read?:      string | number;
  mail_body?:      string;
  content_type?:   string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url    = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";
  // Guerrilla Mail is session based and the browser holds the session: sid_token + site arrive here.
  const sid    = url.searchParams.get("sid_token") ?? "";
  const site   = url.searchParams.get("site") ?? "guerrillamail.com";
  if (!sid) return json({ error: "Missing sid_token" }, 400);

  const gm = (params: string) =>
    `${UPSTREAM}?${params}&lang=en&site=${encodeURIComponent(site)}&sid_token=${encodeURIComponent(sid)}`;

  // -- inbox list --------------------------------------------------------
  if (action === "inbox") {
    const r = await fetch(gm("f=check_email&seq=0"), { cache: "no-store" });
    if (!r.ok) return json([], 200);
    const raw = await r.json().catch(() => null);
    // "Please call get_email_address or set_email_user first" = the stored session is gone.
    if (!Array.isArray(raw?.list)) return json({ error: "stale_session" }, 401);
    const now = Date.now();
    return json(raw.list.map((m: GmMail) => toMeta(m, now)));
  }

  // -- SSE stream --------------------------------------------------------
  if (action === "stream") {
    const encoder = new TextEncoder();
    let lastHash = "";
    let closed   = false;

    const stream = new ReadableStream({
      start(ctrl) {
        const send = (data: object) => {
          if (closed) return;
          try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
        };
        send({ type: "connected" });

        const poll = async () => {
          if (closed) return;
          try {
            const r = await fetch(gm("f=check_email&seq=0"), { cache: "no-store" });
            if (r.ok) {
              const raw  = await r.json().catch(() => null);
              const list: GmMail[] = Array.isArray(raw?.list) ? raw.list : [];
              const hash = list.map(m => m.mail_id).join(",");
              if (hash !== lastHash) {
                lastHash = hash;
                const now = Date.now();
                send({ type: "update", messages: list.map(m => toMeta(m, now)) });
              }
            }
          } catch { /* transient upstream error, next tick retries */ }
          if (!closed) setTimeout(poll, 5_000);
        };
        poll();
        setTimeout(() => { closed = true; try { ctrl.close(); } catch { /* already closed */ } }, 295_000);
      },
      cancel() { closed = true; },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*", "X-Accel-Buffering": "no",
      },
    });
  }

  // -- read single message -----------------------------------------------
  if (action === "read") {
    const id = url.searchParams.get("id") ?? "";
    if (!id) return json({ error: "Missing id" }, 400);
    const r = await fetch(gm(`f=fetch_email&email_id=${encodeURIComponent(id)}`));
    if (!r.ok) return json({ error: "Not found" }, 404);
    const m: GmMail = await r.json().catch(() => ({}));
    if (!m?.mail_id) return json({ error: "Not found" }, 404);

    const receivedAt = isoTime(m.mail_timestamp);
    const isHtml     = /html/i.test(m.content_type ?? "");
    const body       = String(m.mail_body ?? "");
    return json({
      id:         String(m.mail_id),
      from:       m.mail_from || "unknown",
      subject:    m.mail_subject || "(no subject)",
      receivedAt,
      read:       true,
      timeAgo:    relativeTime(receivedAt, Date.now()),
      text:       isHtml ? stripTags(body) : preText(body),
      html:       isHtml ? body : "",
    });
  }

  // -- delete ------------------------------------------------------------
  if (action === "delete") {
    const id = url.searchParams.get("id") ?? "";
    if (!id) return json({ error: "Missing id" }, 400);
    const r   = await fetch(gm(`f=del_email&email_ids[]=${encodeURIComponent(id)}`));
    const raw = await r.json().catch(() => null);
    const ok  = Array.isArray(raw?.deleted_ids) && raw.deleted_ids.includes(String(id));
    return json({ ok }, ok ? 200 : 502);
  }

  return json({ error: "Unknown action" }, 400);
}

function toMeta(m: GmMail, now: number) {
  const receivedAt = isoTime(m.mail_timestamp);
  return {
    id:         String(m.mail_id),
    from:       m.mail_from || "unknown",
    subject:    m.mail_subject || "(no subject)",
    receivedAt,
    read:       String(m.mail_read ?? "0") !== "0",
    timeAgo:    relativeTime(receivedAt, now),
  };
}

// mail_timestamp is unix seconds; the welcome mail and some system mails ship 0 and mail_date has
// no date part, so those fall back to "now" instead of 1970.
function isoTime(ts: string | number | undefined): string {
  const n = Number(ts);
  return n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
}

// text/plain bodies arrive wrapped in <pre>...</pre>
function preText(body: string): string {
  return body.replace(/^\s*<pre[^>]*>/i, "").replace(/<\/pre>\s*$/i, "").trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function relativeTime(iso: string, now: number): string {
  // clamped: Guerrilla Mail's clock runs a few seconds ahead of ours, which would print "-7s ago"
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export const config = { runtime: "edge" }
