import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DOMAINS = ["factoryai.tech", "kilomail.my.id", "kilosms.web.id", "kilomail.tech"];

const CORS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * POST /api/inbox — hand out an address.
 *
 * Every name on our own domains already works (mail is stored by MX, not by signup), so this
 * endpoint exists so an agent never has to invent or remember one: it returns the address and
 * the three calls that go with it.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: CORS });
  }

  const url = new URL(req.url);

  // `?name=` lets a caller ask for a specific local part (handy when a site shows it back).
  const wanted = (url.searchParams.get("name") ?? "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const domain = (url.searchParams.get("domain") ?? "").toLowerCase();
  const hosts = DOMAINS.includes(domain) ? [domain] : DOMAINS;

  const name = wanted.length >= 3 && wanted.length <= 32 ? wanted : randomName();
  const email = `${name}@${hosts[Math.floor(Math.random() * hosts.length)]}`;

  const base = `${url.protocol}//${url.host}`;
  const enc = encodeURIComponent(email);

  // A name someone asked for must not already hold mail from another signup.
  if (wanted) {
    const existing = await redis.hlen(`inbox:${email}`);
    if (existing > 0) {
      return new Response(JSON.stringify({ error: "That name already has mail", email }), { status: 409, headers: CORS });
    }
  }

  return new Response(JSON.stringify({
    email,
    list:   `${base}/api/inbox/${enc}`,
    code:   `${base}/api/inbox/${enc}/code`,
    stream: `${base}/api/inbox/${enc}/stream`,
    delete: `${base}/api/inbox/${enc}`,
  }), { headers: CORS });
}

function randomName(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let name = "";
  for (let i = 0; i < 8; i++) name += pick(alphabet);
  name += pick(digits) + pick(digits);
  return name;
}

export const config = { runtime: "edge" };
