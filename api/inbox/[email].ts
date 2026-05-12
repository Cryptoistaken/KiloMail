import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

interface MessageMeta {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  expiresAt?: number;
  read: boolean;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const pathParts = new URL(req.url).pathname.split("/").filter(Boolean);
  const email = decodeURIComponent(
    pathParts[pathParts.length - 1] ?? ""
  ).toLowerCase().trim();

  if (!email || !email.endsWith("@kilolabs.space")) {
    return new Response(JSON.stringify([]), { headers: CORS });
  }

  const inboxKey = `inbox:${email}`;
  const hashData = await redis.hgetall(inboxKey);

  const now = Date.now();
  const all = Object.values(hashData as Record<string, MessageMeta> ?? {});

  const live = all.filter(m => !m.expiresAt || m.expiresAt > now);
  const expired = all.filter(m => m.expiresAt && m.expiresAt <= now);

  if (expired.length > 0) {
    const pipe = redis.pipeline();
    expired.forEach(m => pipe.hdel(inboxKey, m.id));
    pipe.exec().catch(() => {});
  }

  const messages = live
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    .map((m) => ({
      id:         m.id,
      from:       m.from,
      subject:    m.subject,
      receivedAt: m.receivedAt,
      read:       m.read ?? false,
      timeAgo:    relativeTime(m.receivedAt, now),
    }));

  const etag = `"${messages.length}-${messages[messages.length - 1]?.id ?? "0"}"`;
  if (req.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers: { "ETag": etag, "Access-Control-Allow-Origin": "*" } });
  }

  return new Response(JSON.stringify(messages), {
    headers: { ...CORS, "ETag": etag, "Cache-Control": "no-cache" },
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
