import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAIN = "kilolabs.space";
const CORS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface MessageMeta {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  read: boolean;
}

interface MessageBody {
  text: string;
  html: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const email     = decodeURIComponent(parts[2] ?? "").toLowerCase().trim();
  const messageId = decodeURIComponent(parts[3] ?? "");

  if (!email.endsWith(`@${DOMAIN}`) || !messageId) {
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: CORS });
  }

  const inboxKey = `inbox:${email}`;

  // ── GET — return full body; read state tracked client-side ────────────────
  if (req.method === "GET") {
    // Pipeline meta + body — 1 round-trip
    const results = await redis.pipeline()
      .hget<MessageMeta>(inboxKey, messageId)
      .get<MessageBody>(`body:${messageId}`)
      .exec();

    const meta = results[0] as MessageMeta | null;
    const body = results[1] as MessageBody | null;

    if (!meta) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });
    }

    return new Response(JSON.stringify({
      id:         meta.id,
      from:       meta.from,
      subject:    meta.subject,
      receivedAt: meta.receivedAt,
      read:       true,
      text:       body?.text ?? "",
      html:       body?.html ?? "",
    }), { headers: CORS });
  }

  // ── DELETE — HDEL + DEL body in 1 round-trip, no GET needed ──────────────
  if (req.method === "DELETE") {
    const results = await redis.pipeline()
      .hget<MessageMeta>(inboxKey, messageId)
      .hdel(inboxKey, messageId)
      .del(`body:${messageId}`)
      .exec();

    const meta = results[0] as MessageMeta | null;

    if (!meta) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  return new Response("Method Not Allowed", { status: 405 });
}

export const config = { runtime: "edge" };
