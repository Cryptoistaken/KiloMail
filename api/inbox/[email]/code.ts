import { Redis } from "@upstash/redis";
import { extractCode } from "../../../src/lib/codes";
import { extractActionLink } from "../../../src/lib/links";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAINS = ["factoryai.tech", "kilomail.my.id", "kilosms.web.id", "kilomail.tech"];

const CORS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

interface MessageMeta {
  id: string;
  from: string;
  fromName?: string;
  subject: string;
  receivedAt: string;
  expiresAt?: number;
}

interface MessageBody {
  text: string;
  html: string;
}

/**
 * GET /api/inbox/:email/code — the whole point of the inbox in one call.
 *
 * Listing, fetching the body and pulling the code out is three round trips for an agent that
 * only wants "what did the site send me". The newest message wins, the code is preferred over
 * the link, and an empty inbox answers `found: false` instead of 404 so a caller can just poll.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Use GET" }), { status: 405, headers: CORS });
  }

  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const email = decodeURIComponent(parts[2] ?? "").toLowerCase().trim();

  if (!DOMAINS.some((d) => email.endsWith(`@${d}`))) {
    return new Response(JSON.stringify({ found: false, error: "Not one of our domains", email }), { status: 400, headers: CORS });
  }

  const hashData = await redis.hgetall(`inbox:${email}`);
  const now = Date.now();
  const messages = Object.values((hashData as Record<string, MessageMeta>) ?? {})
    .filter((m) => !m.expiresAt || m.expiresAt > now)
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  if (messages.length === 0) {
    return new Response(JSON.stringify({ email, found: false, messages: 0 }), { headers: CORS });
  }

  // Walk from the newest down: the first message that actually carries a code or a link wins.
  for (const meta of messages.slice(0, 5)) {
    const body = await redis.get<MessageBody>(`body:${meta.id}`);
    const code = extractCode(body?.text ?? "", body?.html ?? "");
    const link = code ? null : extractActionLink(body?.text ?? "", body?.html ?? "", meta.from);
    if (!code && !link) continue;

    return new Response(JSON.stringify({
      email,
      found: true,
      messages: messages.length,
      code,
      link,
      id: meta.id,
      from: meta.from,
      fromName: meta.fromName ?? "",
      subject: meta.subject,
      receivedAt: meta.receivedAt,
    }), { headers: CORS });
  }

  // Mail arrived, but nothing in it looks like a code or a verification link.
  const newest = messages[0];
  return new Response(JSON.stringify({
    email,
    found: false,
    messages: messages.length,
    id: newest.id,
    from: newest.from,
    subject: newest.subject,
    receivedAt: newest.receivedAt,
  }), { headers: CORS });
}

export const config = { runtime: "edge" };
