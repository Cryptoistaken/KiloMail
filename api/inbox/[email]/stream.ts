import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAIN = "kilolabs.space";
const CHECK_INTERVAL = 800;
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
            .sort((a: any, b: any) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
          const ids = messages.map((m: any) => m.id).join(",");
          const hash = `${messages.length}:${ids}`;
          if (hash !== lastHash) {
            // Fetch bodies for all messages in one pipeline
            const bodies: Record<string, { text: string; html: string }> = {};
            if (messages.length > 0) {
              const pipe = redis.pipeline();
              messages.forEach((m: any) => pipe.get(`body:${m.id}`));
              const results = await pipe.exec();
              messages.forEach((m: any, i: number) => {
                const b = results[i] as { text?: string; html?: string } | null;
                bodies[m.id] = { text: b?.text ?? "", html: b?.html ?? "" };
              });
            }
            lastHash = hash;
            const now = Date.now();
            send({
              type: "update",
              messages: messages.map((m: any) => ({
                ...m,
                timeAgo: relativeTime(m.receivedAt, now),
                html: bodies[m.id]?.html ?? "",
                text: bodies[m.id]?.text ?? "",
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
