import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAIN = "kilolabs.space";
const TTL = 2592000;
const MAX_MESSAGES = 50;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (process.env.TEST_MODE !== "1") {
    return new Response(
      JSON.stringify({ error: "Test mode is disabled. Set TEST_MODE=1 to enable." }),
      { status: 403, headers: CORS }
    );
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, message: "Test endpoint is active. Send a POST to inject a test email." }),
      { status: 200, headers: CORS }
    );
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {}

  const to = (body.to ?? `test@${DOMAIN}`).toLowerCase().trim();
  const from = body.from ?? "test-sender@gmail.com";
  const subject = body.subject ?? "Test Email from /api/test";
  const text = body.text ?? `This is a test message injected at ${new Date().toISOString()}`;

  if (!to.endsWith(`@${DOMAIN}`)) {
    return new Response(
      JSON.stringify({ error: `Address must end with @${DOMAIN}` }),
      { status: 400, headers: CORS }
    );
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const meta = {
    id,
    from,
    subject,
    receivedAt: now.toISOString(),
    expiresAt: now.getTime() + TTL * 1000,
    read: false,
  };

  const key = `inbox:${to}`;

  const pipe = redis.pipeline();
  pipe.hset(key, { [id]: meta });
  pipe.persist(key);
  pipe.set(`body:${id}`, { text, html: "" }, { ex: TTL });
  pipe.hlen(key);
  const results = await pipe.exec();

  const currentLen = results[3] as number ?? 0;
  if (currentLen > MAX_MESSAGES) {
    const hashData = await redis.hgetall<Record<string, typeof meta>>(key);
    if (hashData) {
      const sorted = Object.entries(hashData)
        .map(([k, v]) => ({ id: k, receivedAt: v.receivedAt }))
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
      const toDelete = sorted.slice(0, currentLen - MAX_MESSAGES).map(e => e.id);
      const trimPipe = redis.pipeline();
      toDelete.forEach(fid => trimPipe.hdel(key, fid));
      await trimPipe.exec();
    }
  }

  const message = { ...meta, text, html: "" };

  return new Response(
    JSON.stringify({ ok: true, injected: message, inboxKey: key }),
    { status: 200, headers: CORS }
  );
}

export const config = { runtime: "edge" };
