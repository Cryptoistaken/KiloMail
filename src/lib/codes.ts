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
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pick(s: string): string | null {
  // Grouped digits like 123-456 - but only when the group actually contains a digit,
  // otherwise "one-time" (from "one-time passcode") looks like a code.
  const grouped = s.match(/\b([A-Za-z0-9]{2,5}(?:-[A-Za-z0-9]{2,5})+)\b/)
  if (grouped && /\d/.test(grouped[1])) return grouped[1]
  const tokens = [...s.matchAll(/[A-Za-z0-9]{4,10}/g)].map(m => m[0])
  return (
    tokens.find(t => /\d/.test(t)) ??
    tokens.find(t => /^[A-Z]{4,10}$/.test(t) && !STOP.has(t.toLowerCase())) ??
    null
  )
}

/** Search the whole mail - plain text first, then the HTML - so codes further down are found. */
export function extractCode(text?: string, html?: string): string | null {
  const hay = scrub([(text || '').trim(), stripHtml(html || '')].filter(Boolean).join('\n'))
  if (!hay) return null

  const near = new RegExp(KEYWORD.source + '[\\s\\S]{0,40}', 'gi')
  for (const w of hay.matchAll(near)) {
    const c = pick(w[0])
    if (c) return c
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
  const s = scrub(subject || '')
  const near = s.match(new RegExp(KEYWORD.source + '[\\s\\S]{0,40}', 'i'))
  const c = near ? pick(near[0]) : null
  if (c) return c

  const digits = s.match(/\b(\d{4,8})\b/)
  if (digits) return digits[1]

  for (const m of s.matchAll(/\b([A-Z0-9]{4,8})\b/g)) {
    if (/[A-Z]/.test(m[1]) && /\d/.test(m[1])) return m[1]
  }
  return null
}
