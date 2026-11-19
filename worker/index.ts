import PostalMime from "postal-mime";

export interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  DOMAINS: string;
}

const DEFAULT_DOMAINS = "factoryai.tech";

const TTL = 2592000; // 30 days
const MAX_MESSAGES = 500;

interface MailHeader { key: string; value: string }
interface MailAddress { name?: string; address?: string }

/** `Name <addr>` the way a mail client writes it. */
function formatAddress(a?: MailAddress | null): string {
  const address = (a?.address ?? "").trim();
  const name = (a?.name ?? "").trim();
  if (!address) return "";
  return name ? `${name} <${address}>` : address;
}

function header(headers: MailHeader[], name: string): string {
  const want = name.toLowerCase();
  const hit = headers.find((h) => h.key.toLowerCase() === want);
  return hit ? hit.value.trim() : "";
}

function headerAll(headers: MailHeader[], name: string): string[] {
  const want = name.toLowerCase();
  return headers.filter((h) => h.key.toLowerCase() === want).map((h) => h.value);
}

/** The domain of the ENVELOPE sender - what a mail client calls "mailed-by". */
function envelopeDomain(address: string): string {
  const m = (address ?? "").match(/@([^>\s]+)/);
  return m ? m[1].toLowerCase() : "";
}

/** The DKIM signing domain ("signed-by"), preferring a signature that actually passed. */
function dkimDomain(headers: MailHeader[]): string {
  const auth = headerAll(headers, "authentication-results").join(" ");
  const passed = auth.match(/dkim=pass[^;]*?\bheader\.d=([A-Za-z0-9.-]+)/i);
  if (passed) return passed[1].toLowerCase();
  const sigs = headerAll(headers, "dkim-signature");
  for (let i = sigs.length - 1; i >= 0; i--) {
    const d = sigs[i].match(/(?:^|[;\s])d=([A-Za-z0-9.-]+)/i);
    if (d) return d[1].toLowerCase();
  }
  return "";
}

/** Whether the message travelled over TLS, read off the Received chain. */
function encryption(headers: MailHeader[]): string {
  const received = headerAll(headers, "received").join(" ");
  if (/esmtps|with tls|\bTLSv?1|\(TLS\)/i.test(received)) return "Standard encryption (TLS)";
  if (/\besmtp\b/i.test(received)) return "No encryption";
  return "";
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);

    const to = message.to.toLowerCase().trim();
    const domains = (env.DOMAINS ?? DEFAULT_DOMAINS)
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (!domains.some((d) => to.endsWith(`@${d}`))) return;

    // `message.from` is the ENVELOPE sender (the hidden Return-Path). For bulk mail that is a
    // machine token like 010001a1dc...-000000@envelope.sup.kernel.sh, which reads like garbage.
    // The header From (parsed.from) is what the sender actually wrote - name plus address.
    const headerFrom = parsed.from ?? null;
    const fromAddress = headerFrom?.address?.trim() || message.from || "";
    const fromName = (headerFrom?.name ?? "").trim();

    const hdrs: MailHeader[] = (parsed.headers ?? []).map((h) => ({ key: String(h.key ?? ""), value: String(h.value ?? "") }));

    const id = crypto.randomUUID();
    const now = Date.now();
    const meta = JSON.stringify({
      id,
      from: fromAddress,
      fromName,
      // Extra header details for the message "details" popover. Whatever a mail does not carry
      // simply stays empty and its row is left out.
      to: formatAddress(parsed.to?.[0]) || header(hdrs, "to") || message.to || "",
      replyTo: formatAddress(parsed.replyTo?.[0]) || header(hdrs, "reply-to"),
      date: header(hdrs, "date"),
      mailedBy: envelopeDomain(message.from ?? ""),
      signedBy: dkimDomain(hdrs),
      encryption: encryption(hdrs),
      subject: parsed.subject ?? "(no subject)",
      receivedAt: new Date(now).toISOString(),
      expiresAt: now + TTL * 1000,
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
