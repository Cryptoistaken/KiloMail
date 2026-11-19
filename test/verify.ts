/**
 * Verify what the detectors return, instead of trusting the count.
 *
 *   bun test/verify.ts
 *
 * Every code and link is checked against the raw mail it came from:
 *  - a code must appear in the body, must not be part of a longer number, a URL, or the sender
 *  - a link must not be an unsubscribe / preferences / social / image / tracking link, and should
 *    live on the sender's own domain with a verification-looking path
 * Anything that fails is printed, so a "fix" that only moves the number is obvious.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extractCode, subjectCode } from "../src/lib/codes";
import { extractActionLink } from "../src/lib/links";

interface Msg {
  inbox: string;
  id: string;
  from: string;
  subject: string;
  body?: { text?: string; html?: string } | null;
}

const inboxes: { email: string; messages: Msg[] }[] = JSON.parse(
  readFileSync(new URL("./data/messages.json", import.meta.url), "utf8"),
);
const all = inboxes.flatMap((i) => i.messages.map((m) => ({ ...m, inbox: i.email })));

const plain = (m: Msg) => (m.body?.text ?? "").replace(/\s+/g, " ");
const stripped = (m: Msg) =>
  (m.body?.html ?? "").replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const BAD_LINK = /(unsubscribe|preferences|optout|opt-out|privacy|terms|twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|mailto:|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|\/\.(css|js)\b)/i;
const GOOD_PATH = /(verif|confirm|magic|auth|token|activate|reset|signup|sign-up|onboard|login|log-in|invite|validat|code|password)/i;

const rows: { id: string; inbox: string; from: string; subject: string; code: string | null; link: string | null }[] = [];
const badCodes: { m: Msg; code: string; why: string }[] = [];
const badLinks: { m: Msg; link: string; why: string }[] = [];

for (const m of all) {
  const code = extractCode(m.body?.text ?? "", m.body?.html ?? "");
  const link = code ? null : extractActionLink(m.body?.text ?? "", m.body?.html ?? "", m.from);
  rows.push({ id: m.id, inbox: m.inbox, from: m.from, subject: m.subject, code, link });

  if (code) {
    const hay = `${plain(m)} ${stripped(m)}`;
    const at = hay.indexOf(code);
    // 1. Does it exist at all? (a decoded entity or a mangled token would not)
    if (at < 0) badCodes.push({ m, code, why: "not in body" });
    // 2. Is it a slice of a longer number? ("482913" inside "4829130")
    else if (/\d/.test(code.slice(-1)) && /\d/.test(hay.charAt(at + code.length))) badCodes.push({ m, code, why: "part of a longer number" });
    // 3. Is it actually a piece of a URL or the sender's address?
    else {
      const around = hay.slice(Math.max(0, at - 40), at + code.length + 10);
      if (/https?:\/\/\S*$/i.test(hay.slice(Math.max(0, at - 60), at)) && /[?&/=]/.test(around)) {
        badCodes.push({ m, code, why: "inside a URL" });
      } else if (m.from.toLowerCase().includes(code.toLowerCase())) {
        badCodes.push({ m, code, why: "part of the sender address" });
      }
      // 4. Too long or letter-heavy to be a code someone types
      else if (code.length > 9 && /^[a-z]+$/i.test(code)) badCodes.push({ m, code, why: "just a word" });
    }
  }

  if (link) {
    let why = "";
    const u = new URL(link);
    const strong = /(verif|confirm|magic|token|auth|oobcode|activate|passcode|otp|code)/i.test(u.pathname + u.search);
    if (BAD_LINK.test(link)) why = "unsubscribe/tracking/image link";
    else if (!strong) why = "path says nothing about verification";
    else {
      const senderDomain = m.from.split("@")[1]?.toLowerCase() ?? "";
      const linkHost = u.hostname.toLowerCase();
      const orgOf = (h: string) => h.split(".").slice(-2).join(".");
      const sameOrg = !!senderDomain && orgOf(linkHost) === orgOf(senderDomain);
      if (!sameOrg && !/\.(vercel\.app|pages\.dev)$/.test(linkHost)) why = "different domain from the sender";
    }
    if (why) badLinks.push({ m, link, why });
  }
}

writeFileSync(new URL("./data/extracted.json", import.meta.url), JSON.stringify(rows, null, 2));

console.log(`messages      ${all.length}`);
console.log(`with a code   ${rows.filter((r) => r.code).length}`);
console.log(`with a link   ${rows.filter((r) => r.link).length}`);
console.log(`bad codes     ${badCodes.length}`);
console.log(`bad links     ${badLinks.length}`);

const dump = (label: string, list: { why: string }[], fmt: (x: any) => string, n = 15) => {
  const byWhy: Record<string, number> = {};
  for (const b of list) byWhy[b.why] = (byWhy[b.why] ?? 0) + 1;
  console.log(`\n── ${label} ── ${JSON.stringify(byWhy)}`);
  for (const b of list.slice(0, n)) console.log(fmt(b));
};

dump("bad codes", badCodes, (b) => `${JSON.stringify(b.code)} (${b.why})  [${b.m.from.slice(0, 34)}] ${b.m.subject.slice(0, 50)}`);
dump("bad links", badLinks, (b) => `${b.link.slice(0, 92)} (${b.why})  [${b.m.from.slice(0, 34)}]`);
