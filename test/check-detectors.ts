/**
 * Replay the code / link detectors over the real mail in test/data/messages.json.
 *
 *   bun test/check-detectors.ts          summary
 *   bun test/check-detectors.ts --miss   the mails that ask for a code but got nothing
 *
 * This is the loop that keeps the regexes honest: change src/lib/codes.ts or links.ts,
 * run it again, and the miss count should go down without the wrong-code count going up.
 */
import { readFileSync, existsSync } from "node:fs";
import { extractCode, subjectCode } from "../src/lib/codes";
import { extractActionLink } from "../src/lib/links";

interface Msg {
  inbox: string;
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  body?: { text?: string; html?: string } | null;
}

const file = new URL("./data/messages.json", import.meta.url);
if (!existsSync(file)) {
  console.error("No corpus yet — run `node test/pull-mail.mjs` first.");
  process.exit(1);
}

const inboxes: { email: string; messages: Msg[] }[] = JSON.parse(readFileSync(file, "utf8"));
const all = inboxes.flatMap((i) => i.messages.map((m) => ({ ...m, inbox: i.email })));

/** Does this mail read like it is supposed to carry a code or a verification link? */
const ASKS = /(verif|confirm|sign[-\s]?in|log[-\s]?in|one[-\s]?time|\botp\b|passcode|security code|magic link|activate|reset)/i;

const stats = { total: all.length, code: 0, link: 0, both: 0, none: 0 };
const misses: Msg[] = [];
const oddCodes: { msg: Msg; code: string }[] = [];
const fromSubjectOnly = { subject: 0, body: 0 };

for (const m of all) {
  const text = m.body?.text ?? "";
  const html = m.body?.html ?? "";
  const code = extractCode(text, html);
  const link = code ? null : extractActionLink(text, html, m.from);
  const inSubject = subjectCode(m.subject);

  if (code) stats.code++;
  if (link) stats.link++;
  if (code && link) stats.both++;
  if (!code && !link) stats.none++;

  if (code) {
    if (inSubject === code) fromSubjectOnly.subject++;
    else fromSubjectOnly.body++;
    // A "code" that is long, lowercase or full of prose is usually a false positive.
    if (code.length > 10 || /^[a-z]+$/.test(code)) oddCodes.push({ msg: m, code });
  } else if (!link && ASKS.test(`${m.subject} ${text.slice(0, 4000)}`)) {
    misses.push(m);
  }
}

console.log(`corpus        ${stats.total} messages, ${inboxes.length} inboxes`);
console.log(`code found    ${stats.code}  (${fromSubjectOnly.subject} also in the subject)`);
console.log(`link found    ${stats.link}`);
console.log(`nothing found ${stats.none}`);
console.log(`asks but miss ${misses.length}`);
console.log(`suspicious    ${oddCodes.length}`);

const arg = process.argv[2];
const show = (label: string, list: Msg[], n = 12) => {
  console.log(`\n── ${label} (${list.length}) ──`);
  for (const m of list.slice(0, n)) {
    const text = (m.body?.text ?? m.body?.html ?? "").replace(/\s+/g, " ").replace(/<[^>]*>/g, " ").trim();
    console.log(`\n[${m.from}] ${m.subject}`);
    console.log(text.slice(0, 320));
  }
};

if (arg === "--miss") show("asks for something, detector found nothing", misses, 25);
if (arg === "--odd") {
  console.log(`\n── suspicious codes (${oddCodes.length}) ──`);
  for (const o of oddCodes.slice(0, 25)) console.log(`${JSON.stringify(o.code)}  [${o.msg.from}] ${o.msg.subject}`);
}
if (!arg) console.log("\nUse --miss or --odd to look at the failures.");
