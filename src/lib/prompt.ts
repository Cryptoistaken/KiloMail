import { siteMode } from './host'

/**
 * The setup prompt the landing page copies — the KiloMail version of Revyl's
 * "Copy setup prompt": paste it into a coding agent and the agent can do the whole
 * signup loop by itself. Built at copy time so the host is always the real one.
 */
export function agentPrompt(): string {
  const base = siteMode() === 'site'
    ? `https://app.${window.location.hostname.replace(/^www\./, '')}`
    : window.location.origin

  return `Set up KiloMail in this project so you can receive email without an account. No key, no signup, no rate limit.

1. Mint an inbox, then use that exact address wherever a site asks for email:
   curl -X POST ${base}/api/inbox
   → { "email": "kxmwbqzt41@kilomail.tech", "list": "...", "code": "...", "stream": "...", "delete": "..." }
   Pass ?name=mybot if you need a local part you chose. One inbox per signup — never reuse one.

2. Ask for the code instead of reading mail:
   curl ${base}/api/inbox/<email>/code
   → { "found": true, "code": "482910", "link": null, "from": "GitHub", "subject": "Verify your device" }
   Submit "code". If it came back as a button-only mail, "link" holds the verification URL instead.
   "found": false means nothing has arrived yet: wait at least 5 seconds, then call it again.

3. Throw the inbox away when the signup is done:
   curl -X DELETE ${base}/api/inbox/<email>

Full inbox, when you need more than the code: ${base}/api/inbox/<email> returns the list,
${base}/api/inbox/<email>/<id> returns one body, ${base}/api/inbox/<email>/stream pushes changes over SSE.

Rules: URL-encode the address in the path (@ becomes %40). Do not poll faster than once every 5 seconds. Nothing is stored on your side — no account, no cookie, no key.`
}
