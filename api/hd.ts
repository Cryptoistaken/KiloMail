/**
 * Proxy API for HD (hotmail9) domains: tenwmail.com, clowtmail.com
 *
 * These are third-party domains accessed via the hotmail9.com API.
 * We proxy through here so the frontend never exposes the upstream API.
 *
 * Endpoints (all require ?email=user@domain.com):
 *   GET  /api/hd?action=inbox&email=...          → list messages
 *   GET  /api/hd?action=read&email=...&emlid=...&time=... → full message body
 *   POST /api/hd?action=ensure&email=...         → register/login, return token
 */

const HD_BASE = "https://hotmail9.com/view/api";

// host=1 → tenwmail.com, host=0 → clowtmail.com
const HD_DOMAINS: Record<string, string> = {
  "tenwmail.com":  "1",
  "clowtmail.com": "0",
  // "newdomain.com": "2",   ← add new HD domains here with their host number
};

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url    = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";
  const email  = (url.searchParams.get("email") ?? "").toLowerCase().trim();

  if (!email) return json({ error: "Missing email" }, 400);

  const [user, domain] = email.split("@");
  const host = HD_DOMAINS[domain];
  if (!host) return json({ error: "Not an HD domain" }, 400);

  // ── ensure: register or login, return a token ──────────────────────────
  if (action === "ensure" && (req.method === "POST" || req.method === "GET")) {
    const token = await ensureAccount(user, domain, host);
    if (!token) return json({ error: "Auth failed" }, 502);
    return json({ token });
  }

  // ── inbox: list messages ───────────────────────────────────────────────
  if (action === "inbox") {
    const token = await ensureAccount(user, domain, host);
    if (!token) return json({ error: "Auth failed" }, 502);

    const r = await fetch(`${HD_BASE}?type=message&time=0`, {
      headers: { authorization: token },
    });
    const data: any = await r.json();
    if (!data || data.status !== 1) return json([], 200);

    const now = Date.now();
    const messages = (data.list ?? []).map((m: any) => ({
      id:         m.emlid,
      from:       m.from?.display ?? m.from?.address ?? "",
      subject:    m.subject ?? "(no subject)",
      receivedAt: new Date(m.time * 1000).toISOString(),
      read:       m.is_read === 1,
      timeAgo:    relativeTime(m.time * 1000, now),
    }));

    return json(messages);
  }

  // ── read: fetch full message body ──────────────────────────────────────
  if (action === "read") {
    const emlid = url.searchParams.get("emlid") ?? "";
    const time  = url.searchParams.get("time")  ?? "0";
    if (!emlid) return json({ error: "Missing emlid" }, 400);

    const token = await ensureAccount(user, domain, host);
    if (!token) return json({ error: "Auth failed" }, 502);

    const r = await fetch(`${HD_BASE}?type=read&time=${time}&emlid=${emlid}`, {
      headers: { authorization: token },
    });
    const data: any = await r.json();
    if (!data || data.status !== 1) return json({ error: "Not found" }, 404);

    return json({
      id:         emlid,
      from:       data.from?.display ?? data.from?.address ?? "",
      subject:    data.subject ?? "(no subject)",
      receivedAt: new Date(Number(time) * 1000).toISOString(),
      read:       true,
      text:       stripHtml(data.html ?? ""),
      html:       data.html ?? "",
    });
  }

  return json({ error: "Unknown action" }, 400);
}

// ── helpers ────────────────────────────────────────────────────────────────

const HM9_PASS = "Abuhider";

async function ensureAccount(
  user: string, domain: string, host: string
): Promise<string | null> {
  // 1. Try register — status 1 = newly created, status 0 = already exists, both fine
  try {
    await fetch(`${HD_BASE}?type=reg&user=${encodeURIComponent(user)}&password=${encodeURIComponent(HM9_PASS)}&host=${host}`);
  } catch { /* ignore — fall through to login */ }

  // 2. Login with fixed password to get token
  const loginRes  = await fetch(`${HD_BASE}?type=login&user=${encodeURIComponent(user)}@${domain}&password=${encodeURIComponent(HM9_PASS)}`);
  const loginData: any = await loginRes.json();
  if (loginData?.status === 1) return loginData.token as string;

  return null;
}

function relativeTime(ms: number, now: number): string {
  const diff = Math.floor((now - ms) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export const config = { runtime: "edge" };
