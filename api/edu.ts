/**
 * Proxy API for EDU domains: iunp.edu.rs, warsawuni.edu.pl
 *
 * These are third-party domains accessed via the getedumail.com API.
 * We proxy through here so the frontend never calls getedumail directly.
 *
 * Endpoints (all require ?email=user@domain.com):
 *   GET  /api/edu?action=inbox&email=...   → list messages (auto-creates inbox if needed)
 *   GET  /api/edu?action=read&email=...&uid=... → full message body
 */

const EDU_BASE = "https://api.getedumail.com/getedumail/emails";

const EDU_DOMAINS: ReadonlySet<string> = new Set([
  "iunp.edu.rs",
  "warsawuni.edu.pl",
  // add more .edu domains here
]);

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EDU_POLL_MS  = 2_000;
const EDU_MAX_MS   = 295_000; // just under Vercel's 300 s edge limit

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url    = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";
  const email  = (url.searchParams.get("email") ?? "").toLowerCase().trim();

  if (!email) return json({ error: "Missing email" }, 400);

  const domain = email.split("@")[1] ?? "";
  if (!EDU_DOMAINS.has(domain)) return json({ error: "Not an EDU domain" }, 400);

  // ── stream: SSE — polls getedumail internally, pushes updates ─────────
  if (action === "stream") {
    await ensureAccount(email);

    const encoder  = new TextEncoder();
    let lastHash   = "";
    let closed     = false;

    const stream = new ReadableStream({
      start(controller) {
        const send = (data: object) => {
          if (closed) return;
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
        };

        send({ type: "connected" });

        const poll = async () => {
          if (closed) return;
          try {
            const listRes = await fetch(
              `${EDU_BASE}/${encodeURIComponent(email)}/list?page=1`,
              { headers: { "accept": "application/json" } }
            );
            if (listRes.ok) {
              const listData = await listRes.json() as { total: number; emails: EduEmail[] };
              const emails   = listData.emails ?? [];
              const hash     = `${emails.length}:${emails.map(m => m.uid).join(",")}`;

              if (hash !== lastHash) {
                lastHash = hash;
                const now = Date.now();
                send({
                  type: "update",
                  messages: emails.map((m, i) => ({
                    id:         String(m.uid ?? i),
                    from:       m.from?.[0]?.name
                                  ? `${m.from[0].name} <${m.from[0].address}>`
                                  : (m.from?.[0]?.address ?? "unknown"),
                    subject:    m.subject ?? "(no subject)",
                    receivedAt: m.date ?? new Date().toISOString(),
                    read:       false,
                    timeAgo:    relativeTime(m.date ?? new Date().toISOString(), now),
                    text:       m.body?.text ?? "",
                    html:       m.body?.html ?? "",
                  })),
                });
              }
            }
          } catch { /* transient — next tick retries */ }

          if (!closed) setTimeout(poll, EDU_POLL_MS);
        };

        // Kick off immediately, then recurse every EDU_POLL_MS
        poll();

        setTimeout(() => {
          closed = true;
          try { controller.close(); } catch {}
        }, EDU_MAX_MS);
      },
      cancel() { closed = true; },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // ── inbox: ensure account exists, then list messages ──────────────────
  if (action === "inbox") {
    await ensureAccount(email);

    const listRes = await fetch(
      `${EDU_BASE}/${encodeURIComponent(email)}/list?page=1`,
      { headers: { "accept": "application/json" } }
    );
    if (!listRes.ok) return json([], 200);

    const listData = await listRes.json() as { total: number; emails: EduEmail[] };
    const now = Date.now();

    const messages = (listData.emails ?? []).map((m, i) => ({
      id:         String(m.uid ?? i),
      from:       m.from?.[0]?.name
                    ? `${m.from[0].name} <${m.from[0].address}>`
                    : (m.from?.[0]?.address ?? "unknown"),
      subject:    m.subject ?? "(no subject)",
      receivedAt: m.date ?? new Date().toISOString(),
      read:       false,
      timeAgo:    relativeTime(m.date ?? new Date().toISOString(), now),
    }));

    return json(messages);
  }

  // ── read: return a specific message by uid ─────────────────────────────
  if (action === "read") {
    const uid = url.searchParams.get("uid") ?? "";
    if (!uid) return json({ error: "Missing uid" }, 400);

    await ensureAccount(email);

    const listRes = await fetch(
      `${EDU_BASE}/${encodeURIComponent(email)}/list?page=1`,
      { headers: { "accept": "application/json" } }
    );
    if (!listRes.ok) return json({ error: "Not found" }, 404);

    const listData = await listRes.json() as { total: number; emails: EduEmail[] };
    const msg = listData.emails?.find(m => String(m.uid) === uid);
    if (!msg) return json({ error: "Not found" }, 404);

    return json({
      id:         String(msg.uid),
      from:       msg.from?.[0]?.name
                    ? `${msg.from[0].name} <${msg.from[0].address}>`
                    : (msg.from?.[0]?.address ?? "unknown"),
      subject:    msg.subject ?? "(no subject)",
      receivedAt: msg.date ?? new Date().toISOString(),
      read:       true,
      text:       msg.body?.text ?? "",
      html:       msg.body?.html ?? "",
    });
  }

  return json({ error: "Unknown action" }, 400);
}

// ── helpers ────────────────────────────────────────────────────────────────

interface EduFrom {
  name: string;
  address: string;
}

interface EduEmail {
  uid: number;
  subject: string;
  from: EduFrom[];
  date: string;
  body: { text: string; html: string };
}

/** Emails we've already ensured exist — skip the availability round-trip on repeat polls. */
const ensuredCache = new Set<string>();

/** Ensure the inbox exists on getedumail; creates it if not. No-ops on repeat calls. */
async function ensureAccount(email: string): Promise<void> {
  if (ensuredCache.has(email)) return;
  try {
    const checkRes = await fetch(
      `${EDU_BASE}/availability?email=${encodeURIComponent(email)}`,
      { headers: { "accept": "application/json" } }
    );
    const check = await checkRes.json() as { isMailAvailable: boolean; isMailAlreadyCreated: boolean };

    if (!check.isMailAlreadyCreated && check.isMailAvailable) {
      await fetch(`${EDU_BASE}/guest`, {
        method: "POST",
        headers: { "accept": "application/json", "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    }
    // Mark as ensured regardless — even if already created, no need to check again
    ensuredCache.add(email);
  } catch { /* ignore — fall through, list may still work */ }
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (diff < 0)     return "just now";
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export const config = { runtime: "edge" };
