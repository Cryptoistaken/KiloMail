/**
 * Pull every inbox out of the production Redis into test/data/.
 *
 * The app can only read one address at a time, and addresses are random, so this talks to
 * Upstash directly: SCAN inbox:* -> HGETALL per inbox -> GET body:<id> per message, all in
 * pipelines (one HTTP round trip per ~100 commands instead of one per command).
 *
 *   node test/pull-mail.mjs
 *
 * Credentials come from the environment, or from .dev.vars / .env.local. Nothing is printed.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "test", "data");

function fromFile(key) {
  for (const file of [".dev.vars", ".env.local", ".env"]) {
    try {
      const text = readFileSync(join(root, file), "utf8");
      const line = text.split(/\r?\n/).find((l) => l.trim().startsWith(`${key}=`));
      if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    } catch {
      /* file absent, try the next one */
    }
  }
  return undefined;
}

const url = process.env.UPSTASH_REDIS_REST_URL ?? fromFile("UPSTASH_REDIS_REST_URL");
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? fromFile("UPSTASH_REDIS_REST_TOKEN");

if (!url || !token) {
  console.error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (env, .dev.vars or .env.local).");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function command(...args) {
  const res = await fetch(url, { method: "POST", headers: auth, body: JSON.stringify(args) });
  const json = await res.json();
  if (json.error) throw new Error(`${args[0]}: ${json.error}`);
  return json.result;
}

/** Many commands, one round trip. Returns results in the same order. */
async function pipeline(commands) {
  const out = [];
  for (let i = 0; i < commands.length; i += 100) {
    const chunk = commands.slice(i, i + 100);
    const res = await fetch(`${url}/pipeline`, { method: "POST", headers: auth, body: JSON.stringify(chunk) });
    const json = await res.json();
    for (const item of json) {
      if (item.error) out.push(null);
      else out.push(item.result);
    }
  }
  return out;
}

/** HGETALL comes back as a flat [field, value, ...] array. */
function pairs(result) {
  const out = {};
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i += 2) out[result[i]] = result[i + 1];
  } else if (result && typeof result === "object") {
    Object.assign(out, result);
  }
  return out;
}

const keys = [];
let cursor = "0";
do {
  const [next, batch] = await command("SCAN", cursor, "MATCH", "inbox:*", "COUNT", "200");
  cursor = String(next);
  for (const k of batch ?? []) keys.push(String(k).replace(/^"|"$/g, ""));
} while (cursor !== "0");

console.log(`${keys.length} inboxes`);

const hashes = await pipeline(keys.map((k) => ["HGETALL", k]));

const inboxes = [];
const wanted = []; // every message that needs a body

for (let i = 0; i < keys.length; i++) {
  const email = keys[i].replace(/^inbox:/, "");
  const messages = Object.values(pairs(hashes[i])).map((meta) => {
    const m = typeof meta === "string" ? JSON.parse(meta) : meta;
    const entry = { ...m, body: null };
    wanted.push({ email, entry });
    return entry;
  });
  messages.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  inboxes.push({ email, messages });
}

const bodies = await pipeline(wanted.map((w) => ["GET", `body:${w.entry.id}`]));
for (let i = 0; i < wanted.length; i++) {
  const raw = bodies[i];
  if (!raw) continue;
  try {
    wanted[i].entry.body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    wanted[i].entry.body = { text: String(raw), html: "" };
  }
}

mkdirSync(outDir, { recursive: true });
const flat = inboxes.flatMap((i) => i.messages.map((m) => ({ inbox: i.email, ...m })));
writeFileSync(join(outDir, "messages.json"), JSON.stringify(inboxes, null, 2));
writeFileSync(join(outDir, "messages.ndjson"), flat.map((m) => JSON.stringify(m)).join("\n"));

const withBody = flat.filter((m) => m.body).length;
console.log(`${inboxes.length} inboxes, ${flat.length} messages (${withBody} with a body) -> test/data/messages.json`);
