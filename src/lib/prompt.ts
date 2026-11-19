import { siteMode } from './host'

/**
 * What the "Copy prompt" button hands to an agent: the real endpoints, the real rules,
 * nothing it would have to guess. Built at copy time so the host is always correct.
 */
export function agentPrompt(): string {
  const base = siteMode() === 'site'
    ? `https://app.${window.location.hostname.replace(/^www\./, '')}`
    : window.location.origin
  const inbox = (name: string) => `${base}/api/inbox/${name}%40kilomail.tech`

  return `You can receive email with KiloMail — a free disposable inbox with a plain HTTP API. No key, no signup, no rate limit.

1. Pick an address: <name>@kilomail.tech — any name works, mail sent there is stored automatically.
2. List the inbox:
   curl "${inbox('<name>')}"
   → [{ id, from, subject, receivedAt, timeAgo }]
3. Read one message (the code or magic link is in the body):
   curl "${inbox('<name>')}/<id>"
   → { text, html, from, subject, receivedAt }
4. Or wait for mail live (SSE, reconnect when it closes):
   curl -N "${inbox('<name>')}/stream"
   → { "type": "connected" } then { "type": "update", "messages": [...] }

Rules: URL-encode the @ as %40. Use a fresh name for each site, never reuse one across signups. An unknown inbox returns [] instead of 404, so after sending just re-check the list once (~60s); do not poll faster than every 5 seconds. Messages are kept for 30 days.`
}
