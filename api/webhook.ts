import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAIN = "kilolabs.space";
const TTL = 2592000;
const MAX_MESSAGES = 50;

interface IncomingPayload {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

interface MessageMeta {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  expiresAt: number;
  read: boolean;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: IncomingPayload;
  try { body = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const address = (body.to ?? "").toLowerCase().trim();
  if (!address.endsWith(`@${DOMAIN}`)) return new Response("Ignored", { status: 200 });

  const id = crypto.randomUUID();
  const now = new Date();
  const meta: MessageMeta = {
    id,
    from: body.from ?? "",
    subject: body.subject ?? "(no subject)",
    receivedAt: now.toISOString(),
    expiresAt: now.getTime() + TTL * 1000,
    read: false,
  };

  const inboxKey = `inbox:${address}`;

  const pipe = redis.pipeline();
  pipe.hset(inboxKey, { [id]: meta });
  pipe.persist(inboxKey);
  pipe.set(`body:${id}`, { text: body.text ?? "", html: body.html ?? "" }, { ex: TTL });
  pipe.hlen(inboxKey);
  const results = await pipe.exec();

  const currentLen = results[3] as number ?? 0;
  if (currentLen > MAX_MESSAGES) {
    const hashData = await redis.hgetall<Record<string, MessageMeta>>(inboxKey);
    if (hashData) {
      const sorted = Object.entries(hashData)
        .map(([k, v]) => ({ id: k, receivedAt: v.receivedAt }))
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
      const toDelete = sorted.slice(0, currentLen - MAX_MESSAGES).map(e => e.id);
      const trimPipe = redis.pipeline();
      toDelete.forEach(fid => trimPipe.hdel(inboxKey, fid));
      await trimPipe.exec();
    }
  }

  return new Response("ok", { status: 200 });
}

export const config = { runtime: "edge" };
