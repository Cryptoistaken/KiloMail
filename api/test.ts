/**
 * POST /api/test
 * Injects a fake email directly into Redis — bypasses the CF Worker entirely.
 * Only works when TEST_MODE env var is set to "1".
 *
 * Body (all optional, defaults provided):
 *   { to?: string, from?: string, subject?: string, text?: string }
 */

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAIN = "kilolabs.space";
const TTL = 2592000; // 30 days in seconds
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
  } catch {
    // use defaults
  }

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

  const message = {
    id: crypto.randomUUID(),
    from,
    subject,
    text,
    html: "",
    receivedAt: new Date().toISOString(),
  };

  const key = `inbox:${to}`;
  const existing = (await redis.get<typeof message[]>(key)) ?? [];
  existing.push(message);
  const trimmed = existing.slice(-MAX_MESSAGES);
  await redis.set(key, trimmed, { ex: TTL });

  return new Response(
    JSON.stringify({ ok: true, injected: message, inboxKey: key }),
    { status: 200, headers: CORS }
  );
}

export const config = { runtime: "edge" };
