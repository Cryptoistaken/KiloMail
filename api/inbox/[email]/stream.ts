import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAIN = "kilolabs.space";
const CHECK_INTERVAL = 2000;
const MAX_DURATION = 295_000;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const email = decodeURIComponent(parts[2] ?? "").toLowerCase().trim();

  if (!email.endsWith(`@${DOMAIN}`)) {
    return new Response("Invalid", { status: 400 });
  }

  const inboxKey = `inbox:${email}`;
  const encoder = new TextEncoder();
  let lastHash = "";
  let closed = false;

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const send = (data: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };

      send({ type: "connected" });

      const iv = setInterval(async () => {
        if (closed) { clearInterval(iv); return; }
        try {
          const hashData = await redis.hgetall(inboxKey);
          const messages = Object.values(hashData ?? {})
            .sort((a: any, b: any) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
          const hash = `${messages.length}:${messages.map((m: any) => m.id).join(",")}`;
          if (hash !== lastHash) {
            lastHash = hash;
            const now = Date.now();
            send({
              type: "update",
              messages: messages.map((m: any) => ({
                id:         m.id,
                from:       m.from,
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
        try { controller.close(); } catch {}
      }, MAX_DURATION);
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

function relativeTime(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const config = { runtime: "edge" };
