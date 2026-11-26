/**
 * One-time code detection. Senders use three shapes, and only the first was handled before:
 *   digits only   482913
 *   letters+digits A1B2C3
 *   letters only  KQZX
 * Letters-only codes are only accepted in CAPITALS, so ordinary prose right after the word
 * "code" can never become a copy chip.
 */

const KEYWORD = /(?:\b(?:verification|confirmation|security|one[-\s]?time|login|access|sms)[\s-]*)?\b(?:code|otp|pin|passcode|token)\b/i

// Words that sit next to the keyword but are never the code.
const STOP = new Set([
  'code', 'otp', 'pin', 'token', 'your', 'you', 'the', 'this', 'that', 'only', 'please',
  'enter', 'below', 'above', 'sent', 'send', 'expires', 'expire', 'valid', 'here', 'use',
  // The word before "code" is often the keyword's own adjective, and it is often in CAPITALS:
  // "YOUR ACCOUNT VERIFICATION CODE" used to yield a 10-character slice of VERIFICATION.
  'verification', 'confirmation', 'security', 'authentication', 'passcode', 'password',
])

/**
 * Links and UUIDs are packed with things shaped like codes, and the word "token" INSIDE a URL
 * (`...?public_token=public-token-live-620c0996-4644-...`) used to act as the anchor - that is
 * exactly how a magic-link mail ended up offering a chunk of its own tracking token. Both are
 * removed before the search; a real code is never inside a link.
 */
const NOISE = [
  /https?:\/\/\S+/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
]
function scrub(s: string): string {
  return NOISE.reduce((t, re) => t.replace(re, ' '), s)
}

function stripHtml(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ') // CSS/JS blocks: full of hex colours that look like codes
    // An escaped ampersand is still an ampersand - turning it into a space split link URLs in half
    // and left their query string behind ("...token=mpVim-..."), which then read as a code.
    .replace(/&(?:amp|#38|#x26);/gi, '&')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "It was requested at 26 November 2026, 08:44 UTC" - that 2026 is a date, not a code, and it sat
 * 30 characters after the word "code", which is why it won. A four-digit year only counts as a
 * date when something around it says so, so a real code of 2026 (or 1999) still works.
 */
const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i
function isYearish(s: string, at: number, token: string): boolean {
  if (!/^(19|20)\d{2}$/.test(token)) return false
  const before = s.slice(Math.max(0, at - 18), at)
  const after = s.slice(at + token.length, at + token.length + 12)
  return MONTH.test(before)                    // 26 November 2026
    || /^\s*[-/.]\s*\d{1,2}/.test(after)       // 2026-11-21, 2026/11/21
    || /^\s*,?\s*\d{1,2}:\d{2}/.test(after)    // 2026, 08:44
}

function pick(s: string): string | null {
  // Grouped digits like 123-456 - but only when the group actually contains a digit,
  // otherwise "one-time" (from "one-time passcode") looks like a code.
  const grouped = s.match(/\b([A-Za-z0-9]{2,5}(?:-[A-Za-z0-9]{2,5})+)\b/)
  // A date is not a grouped code: 2026-11-21.
  if (grouped && /\d/.test(grouped[1]) && !/^\d{1,4}-\d{1,2}-\d{1,4}$/.test(grouped[1])) return grouped[1]

  // A token with a digit wins over a word in capitals: "Hello, ROJE BEGUM ... your code Your
  // verification code is 269662" used to hand back the customer's name. The letters-only shape
  // (KQZX, TPYHMZ) is only used when the window holds no number at all.
  let lettersOnly: string | null = null
  // Word boundaries matter: without them a 12-letter word in capitals ("VERIFICATION") is cut
  // down to its first ten characters and offered as a code.
  for (const m of s.matchAll(/\b[A-Za-z0-9]{4,10}\b/g)) {
    const token = m[0]
    const hasDigit = /\d/.test(token)
    if (!hasDigit && !/^[A-Z]{4,10}$/.test(token)) continue
    if (STOP.has(token.toLowerCase())) continue

    // Numbers that are measurements or prices sit right next to their unit ("expires in 10
    // minutes", "$2400"), and a copyright year sits behind a ©. None of those are codes.
    const after = s.slice((m.index ?? 0) + token.length, (m.index ?? 0) + token.length + 12)
    if (/^\s*(%|minutes?|mins?|hours?|hrs?|seconds?|secs?|days?|weeks?|months?|years?)\b/i.test(after)) continue
    const before = s.slice(Math.max(0, (m.index ?? 0) - 2), m.index ?? 0)
    if (/[©#$€£]/.test(before)) continue
    if (isYearish(s, m.index ?? 0, token)) continue

    if (hasDigit) return token
    if (!lettersOnly) lettersOnly = token
  }
  return lettersOnly
}

/**
 * Senders also put the code BEFORE the keyword ("Your login request to TypeSafe 052196 is your
 * one-time code"), which the forward window cannot see. Looking backwards freely would turn a ZIP
 * in a footer ("our office at 94111 ... code") into a code again, so the only words allowed
 * between the token and the keyword are the little ones that build that sentence.
 */
const LINK =
  '(?:[\\s\\-–—]+(?:is|was|are|were|as|the|your|my|our|a|an|this|that|it|one|time|login|sign[\\s-]?in|verification|security|confirmation|access|sms|[A-Z][a-z]{2,12}))*'
const BEFORE = () =>
  new RegExp(`\\b([A-Za-z0-9]{4,10})\\b${LINK}[\\s-]+(?:code|otp|pin|passcode|token)\\b`, 'gi')

/** Search the whole mail - plain text first, then the HTML - so codes further down are found. */
export function extractCode(text?: string, html?: string): string | null {
  const hay = scrub([(text || '').trim(), stripHtml(html || '')].filter(Boolean).join('\n'))
  if (!hay) return null

  // 140 characters, not 40: "use the verification code below to proceed with the mobile linking
  // process. 849515" puts the code 45+ characters after the word it belongs to.
  const near = new RegExp(KEYWORD.source + '[\\s\\S]{0,140}', 'gi')
  for (const w of hay.matchAll(near)) {
    const c = pick(w[0])
    if (c) return c
  }

  for (const w of hay.matchAll(BEFORE())) {
    if (/\d/.test(w[1]) || /^[A-Z]{4,10}$/.test(w[1])) return w[1]
  }

  // A body that is nothing but the code ("482913", "KQZX") is common, so accept it - but only
  // in a very short body. A number buried in a real email is not a code: that is how the ZIP
  // code in a mailing address used to become a copy chip.
  const flat = hay.replace(/\s+/g, ' ').trim()
  if (flat.length <= 40) {
    for (const m of flat.matchAll(/\b([A-Za-z0-9]{4,10})\b/g)) {
      if (/\d/.test(m[1]) || /^[A-Z]{4,10}$/.test(m[1])) return m[1]
    }
  }
  return null
}

/** The copy chip shown straight from the list, before any body is fetched. */
export function subjectCode(subject?: string): string | null {
  const s = scrub(subject || '').trim()
  const near = s.match(new RegExp(KEYWORD.source + '[\\s\\S]{0,40}', 'i'))
  const c = near ? pick(near[0]) : null
  if (c) return c

  // The far more common subject shape puts the code first: "581447 is your verification code".
  for (const w of s.matchAll(BEFORE())) {
    if (/\d/.test(w[1]) || /^[A-Z]{4,10}$/.test(w[1])) return w[1]
  }

  // A subject that is nothing but the code ("482913", "KQZX", "A1B2C3") is common, and the
  // keyword window above cannot see it. A subject that merely *contains* a number is not a code -
  // accepting one turned a timestamp ("… | 2026-11-21 01:18:58") into a chip that copied "2026".
  const bare = s.replace(/^[^\w]+|[^\w]+$/g, '')
  if (/^[A-Za-z0-9]{4,10}$/.test(bare) && (/\d/.test(bare) || /^[A-Z]{4,10}$/.test(bare))) return bare
  return null
}
