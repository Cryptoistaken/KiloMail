/**
 * The one link a verification mail exists for.
 *
 * Only links that sit next to a word like "Continue" or "Verify" count. Every newsletter is full
 * of links to unsubscribe, tweet or open in a browser, and copying one of those is worse than
 * showing nothing at all.
 */

const ACTION =
  /(continue|verif\w*|confirm\w*|sign[-\s]?in|log[-\s]?in|activate|reset|click here|complete|finish|accept|unlock|set up)/i

// Links that are never the one someone came for.
const JUNK =
  /(unsubscribe|preferences|twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|mailto:|tel:|\.gif|\.png|\.jpg)/i

const URL_RE = /https?:\/\/[^\s"'<>()[\]{}]+/gi
const ANCHOR = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi

const decode = (s: string) =>
  s.replace(/&amp;/gi, '&').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')

/** Trailing punctuation belongs to the sentence, not to the address. */
const trim = (u: string) => u.replace(/[.,;:!?)\]}>'"]+$/, '')

const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

function clean(raw: string): string | null {
  const url = trim(decode(raw.trim()))
  if (!/^https?:\/\/\S+\.\S+/i.test(url) || JUNK.test(url)) return null
  return url
}

export function extractActionLink(text?: string, html?: string): string | null {
  // The mail's own text part first: the sender's words sit right next to the link there.
  const t = (text || '').replace(/\s+/g, ' ')
  for (const m of t.matchAll(URL_RE)) {
    const url = clean(m[0])
    if (!url) continue
    const at = m.index ?? 0
    if (ACTION.test(t.slice(Math.max(0, at - 40), at + m[0].length + 40))) return url
  }

  // No text part (or nothing matched): the link's own label says what it does.
  for (const m of (html || '').matchAll(ANCHOR)) {
    const url = clean(m[1])
    if (url && ACTION.test(stripTags(m[2]))) return url
  }
  return null
}
