/**
 * The one link a verification mail exists for.
 *
 * Nearby words alone are not enough: a newsletter's footer sits next to the word "confirm", and a
 * login notification is full of click-trackers that mention "sign in" while going nowhere useful.
 * So every candidate is scored on what the link itself is — its path, its label, and whether it
 * lives on the sender's own domain — and only a link that actually looks like a verification
 * target is returned. Showing nothing is better than showing the unsubscribe page.
 */

const ACTION =
  /(continue|verif\w*|confirm\w*|sign[-\s]?in|log[-\s]?in|activate|reset|click here|complete|finish|accept|unlock|set up)/i

/** Words in the URL itself that mean "this goes to a verification step". */
const GOOD_PATH = /(verif|confirm|magic|auth|token|activate|reset|signup|sign-up|signin|sign-in|validat|passcode|otp|code|password|login|log-in|account\/verify)/i

/** Links that are never the one someone came for. */
const JUNK =
  /(^https?:\/\/(docs?|help|support|blog|status|developers?)\.|unsubscribe|preferences|opt-?out|privacy|terms|policy|legal|cookie|twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|discord\.(gg|com)|github\.com|mailto:|tel:|\.gif|\.png|\.jpe?g|\.webp|\.svg|\/\.(css|js)\b|help|support|docs?\/|blog|careers|pricing|\/solutions\/|\/products?\/|\/features?\/|\/company\/|\/about\/|\/ls\/click)/i

/** Hosts that exist to count clicks, not to verify anything. */
const CLICK_HOST = /^(cl|click|clicks|email|em|links?|track|tracking|go|t|r|mailer|news|ablink|mailchi|list-manage|createsend|hubspotlinks|trk|eml|cmail)\./i

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
  // A verification link never carries campaign tags, and never wraps another URL inside its
  // path (that is a click counter passing you along).
  if (/[?&]utm_/i.test(url) || /%2f%2f|https?%3a|\/https?:\/\//i.test(url)) return null
  return url
}

/** The registrable-ish part of a host: login.typesafe.ai -> typesafe.ai */
function org(host: string): string {
  const parts = host.toLowerCase().split('.')
  return parts.slice(-2).join('.')
}

/**
 * How much does this URL look like the verification target?
 * 3 = the path itself says verify/auth/token, 2 = it is on the sender's own domain,
 * 2 = the words around it are an action, minus everything that points at a tracker or a homepage.
 */
function score(url: string, label: string, sender?: string): number {
  const u = new URL(url)
  let s = 0
  if (GOOD_PATH.test(u.pathname + u.search + u.hash)) s += 3
  if (ACTION.test(label)) s += 2
  if (sender && org(u.hostname) === org(sender)) s += 2
  if (!u.pathname || u.pathname === '/') s -= 3 // a bare homepage verifies nothing
  if (CLICK_HOST.test(u.hostname)) s -= 2
  if (/(^|\.)(bit\.ly|t\.co|lnk\.to|mailchi\.mp)$/i.test(u.hostname)) s -= 4
  return s
}

/** Discord, GoFundMe and friends hide the real link behind a counter, but the button says what it is. */
const strongLabel = (label: string) => {
  const t = label.trim();
  return t.length <= 60 && /^\W*(?:\S+\s+){0,4}(verify|confirm|activate)\b/i.test(t);
};

const isTracker = (raw: string) => {
  try {
    const u = new URL(trim(raw))
    return CLICK_HOST.test(u.hostname) || /\/ls\/click/i.test(u.pathname)
  } catch {
    return false
  }
}

type Candidate = { url: string; s: number; trusted: boolean }

export function extractActionLink(text?: string, html?: string, from?: string): string | null {
  const sender = from?.split('@')[1]

  const textPart = (text || '').replace(/\s+/g, ' ')
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  const consider = (raw: string, label: string) => {
    const trusted = isTracker(raw) && strongLabel(label)
    const url = clean(raw) ?? (trusted ? trim(decode(raw.trim())) : null)
    if (!url) return
    const key = url.split('#')[0]
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({ url, s: trusted ? 0 : score(url, label, sender), trusted })
  }

  // The mail's own text part first: the sender's words sit right next to the link there.
  for (const m of textPart.matchAll(URL_RE)) {
    const at = m.index ?? 0
    consider(m[0], textPart.slice(Math.max(0, at - 60), at))
  }

  // No text part (or nothing matched): the link's own label says what it does.
  for (const m of (html || '').matchAll(ANCHOR)) {
    consider(m[1], stripTags(m[2]))
  }

  const best = candidates.reduce<Candidate | null>((a, b) => (!a || b.s > a.s ? b : a), null)
  if (!best) return null
  // A tracked link whose button literally says "Verify email" is the verification link.
  if (best.trusted) return best.url
  // A path that says "verify" already earns 3; anything lower is a guess, so say nothing.
  if (best.s < 3) return null
  const u = new URL(best.url)
  const target = u.pathname + u.search + u.hash
  const looksLikeVerification =
    (GOOD_PATH.test(target) || /[?&#](token|code|key|secret|t|stytch_token_type)=/i.test(u.search + u.hash)) &&
    // A plain /login or /signin page is a door, not the link that verifies you.
    !(/^\/?(login|log-in|signin|sign-in)\/?$/i.test(u.pathname) && !u.search && !u.hash)
  return looksLikeVerification ? best.url : null
}
