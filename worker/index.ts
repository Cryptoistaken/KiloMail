import PostalMime from "postal-mime";

export interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  DOMAIN: string;
}

const TTL = 600;
const MAX_MESSAGES = 50;

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);

    const to = message.to.toLowerCase().trim();
    if (!to.endsWith(`@${env.DOMAIN}`)) return;

    const id = crypto.randomUUID();
    const meta = JSON.stringify({
      id,
      from: message.from ?? "",
      subject: parsed.subject ?? "(no subject)",
      receivedAt: new Date().toISOString(),
      read: false,
    });
    const body = JSON.stringify({ text: parsed.text ?? "", html: parsed.html ?? "" });
    const inboxKey = `inbox:${to}`;

    const pipeRes = await upstash(env, "pipeline", [
      ["HSET", inboxKey, id, meta],
      ["EXPIRE", inboxKey, String(TTL)],
      ["SET", `body:${id}`, body, "EX", String(TTL)],
      ["HLEN", inboxKey],
    ]);

    const results = await pipeRes.json() as Array<{ result: any }>;
    const currentLen: number = results[3]?.result ?? 0;

    if (currentLen > MAX_MESSAGES) {
      await trimInbox(env, inboxKey, currentLen);
    }

    console.log(`Delivered: ${message.from} -> ${to} | ${parsed.subject}`);
  },
};

async function trimInbox(env: Env, inboxKey: string, currentLen: number): Promise<void> {
  const res = await upstash(env, "pipeline", [["HGETALL", inboxKey]]);
  const [{ result: flat }] = await res.json() as [{ result: string[] }];
  if (!flat || flat.length === 0) return;

  const entries: { id: string; receivedAt: string }[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    try { entries.push({ id: flat[i], receivedAt: JSON.parse(flat[i + 1]).receivedAt }); } catch {}
  }
  entries.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const toDelete = entries.slice(0, currentLen - MAX_MESSAGES).map(e => e.id);
  if (toDelete.length === 0) return;
  await upstash(env, "pipeline", toDelete.map(fid => ["HDEL", inboxKey, fid]));
}

function upstash(env: Env, path: string, body: unknown) {
  return fetch(`${env.UPSTASH_REDIS_REST_URL}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
