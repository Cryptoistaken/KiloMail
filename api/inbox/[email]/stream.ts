import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAINS = ["factoryai.tech", "kilomail.my.id", "kilosms.web.id", "kilomail.tech"];
const CHECK_INTERVAL = 2000;
/** How long one connection stays open before the server ends it. The browser then reconnects
 *  on its own (see the `retry` hint below), so nothing is missed - but a longer window means
 *  fewer reconnects and a steadier "live" indicator. 9 minutes, inside the 5-10 minute range. */
const MAX_DURATION = 540_000;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const email = decodeURIComponent(parts[2] ?? "").toLowerCase().trim();

  if (!DOMAINS.some((d) => email.endsWith(`@${d}`))) {
    return new Response("Invalid", { status: 400 });
  }

  const inboxKey = `inbox:${email}`;
  const encoder = new TextEncoder();
  let lastHash = "";
  let closed = false;
  let beat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const send = (data: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };

      // Ask the browser to come straight back when this connection ends, instead of its
      // default multi-second wait - that is what made the connection look like it dropped.
      try { controller.enqueue(encoder.encode("retry: 1000\n\n")); } catch {}

      send({ type: "connected" });

      // Keep-alive. Nothing is written between mails, and an idle stream is closed upstream
      // after roughly two minutes (measured: 128s), which is what made the connection look
      // like it kept dropping. A comment line every 15s costs nothing and holds it open.
      beat = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch {}
      }, 15_000);

      const iv = setInterval(async () => {
        if (closed) { clearInterval(iv); return; }
        try {
          const hashData = await redis.hgetall(inboxKey);
          const now = Date.now();
          const messages = Object.values(hashData ?? {})
            .filter((m: any) => !m.expiresAt || m.expiresAt > now)
            .sort((a: any, b: any) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
          const hash = `${messages.length}:${messages.map((m: any) => m.id).join(",")}`;
          if (hash !== lastHash) {
            lastHash = hash;
            send({
              type: "update",
              messages: messages.map((m: any) => ({
                id:         m.id,
                from:       m.from,
                fromName:   m.fromName ?? "",
                subject:    m.subject,
                receivedAt: m.receivedAt,
                read:       m.read ?? false,
                timeAgo:    relativeTime(m.receivedAt, now),
              })),
            });
          }
        } catch {}
      }, CHECK_INTERVAL);

      setTimeout(() => {
        closed = true;
        clearInterval(iv);
        if (beat) clearInterval(beat);
        try { controller.close(); } catch {}
      }, MAX_DURATION);
    },
    cancel() {
      closed = true;
      if (beat) clearInterval(beat);
    },
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

function relativeTime(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const config = { runtime: "edge" };
