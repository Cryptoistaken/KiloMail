import { Background } from '@/app/components/Background'
import {
  Zap, Shield, Clock, Globe, RefreshCw, Sparkles,
  Terminal, Copy, Check, ExternalLink, BookOpen, ArrowLeft,
} from 'lucide-react'
import { useState } from 'react'
import { ALL_PROVIDERS } from '@/providers/registry'
import type { ProviderPlugin } from '@/providers/types'
import { navigate } from '@/hooks/useHashRoute'

const BASE = 'https://kilomail.vercel.app'

// "Own" = domains we host (Cloudflare worker -> Redis). The rest are third-party inboxes
// reached through /api/providers/:provider proxies.
const OWN_DOMAINS = ALL_PROVIDERS.filter(p => p.id === 'kilolabs').flatMap(p => p.domains)

function providerActions(p: ProviderPlugin): string {
  return ['inbox', ...(p.createEmail ? ['create'] : []), 'read', ...(p.deleteMessage ? ['delete'] : [])].join(' · ')
}

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative mt-2 rounded-lg border border-border bg-muted/60">
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-foreground/90 font-mono">{code}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70 bg-background/50 backdrop-blur-sm mb-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-foreground/80">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-muted-foreground align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-500',
    DELETE: 'bg-destructive/15 text-destructive',
    POST: 'bg-primary/15 text-primary',
  }
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${colors[method] ?? 'bg-muted text-muted-foreground'}`}>
      {method}
    </span>
  )
}

function Endpoint({
  method, path, desc, params, headers, response, errors, curl, extra,
}: {
  method: string; path: string; desc: string
  params?: { name: string; type: string; desc: string }[]
  headers?: { name: string; required: string; desc: string }[]
  response?: string
  errors?: { status: string; body?: string; reason: string }[]
  curl?: string; extra?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 backdrop-blur-sm overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/40">
        <MethodBadge method={method} />
        <code className="text-xs font-mono text-foreground">{path}</code>
      </div>
      <div className="px-3 py-3 space-y-3">
        <p className="text-xs text-muted-foreground">{desc}</p>
        {params && params.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-foreground/70 mb-1">Path parameters</p>
            <Table headers={['Param', 'Type', 'Description']} rows={params.map(p => [<code className="font-mono">{p.name}</code>, p.type, p.desc])} />
          </div>
        )}
        {headers && headers.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-foreground/70 mb-1">Headers</p>
            <Table headers={['Header', 'Required', 'Description']} rows={headers.map(h => [<code className="font-mono">{h.name}</code>, h.required, h.desc])} />
          </div>
        )}
        {extra}
        {response && (<div><p className="text-[11px] font-semibold text-foreground/70 mb-1">Response</p><CopyBlock code={response} /></div>)}
        {errors && errors.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-foreground/70 mb-1">Errors</p>
            <Table
              headers={errors[0].body !== undefined ? ['Status', 'Body', 'Reason'] : ['Status', 'Reason']}
              rows={errors.map(e => e.body !== undefined
                ? [<code className="font-mono">{e.status}</code>, <code className="font-mono">{e.body}</code>, e.reason]
                : [<code className="font-mono">{e.status}</code>, e.reason]
              )}
            />
          </div>
        )}
        {curl && (<div><p className="text-[11px] font-semibold text-foreground/70 mb-1">Example</p><CopyBlock code={curl} /></div>)}
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: <Zap className="h-4 w-4 text-primary" />, title: 'Free, no key', desc: 'Every endpoint is open. No signup, no API key, no token, no rate limits — call it as much as you like.' },
  { icon: <Shield className="h-4 w-4 text-primary" />, title: 'Zero sign-up', desc: 'No account, no OAuth, no tracking. Pick an address and start receiving mail on it.' },
  { icon: <Globe className="h-4 w-4 text-primary" />, title: 'Own + third-party', desc: 'Addresses on our own domains, plus proxies for popular third-party inboxes — same JSON shape for all.' },
  { icon: <Clock className="h-4 w-4 text-primary" />, title: '30-day retention', desc: 'Every message is kept for 30 days, then removed automatically. No manual cleanup.' },
  { icon: <RefreshCw className="h-4 w-4 text-primary" />, title: 'SSE live stream', desc: 'Real-time push via Server-Sent Events on own domains. No polling, no key.' },
  { icon: <Sparkles className="h-4 w-4 text-primary" />, title: 'Open source (MIT)', desc: 'Full source on GitHub. Self-host on Vercel + Cloudflare + Upstash in under 5 minutes.' },
]

export function DocsView() {
  return (
    <div className="relative flex-1 overflow-y-auto">
      <Background />
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-8">
        <button onClick={() => navigate('/inbox')}
          className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to inbox
        </button>

        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Documentation</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">KiloMail public API</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Base URL: <code className="rounded border border-border bg-muted px-1 py-0.5 text-xs font-mono">{BASE}</code>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Domains:{' '}
            {OWN_DOMAINS.map(d => (
              <code key={d} className="mr-1 rounded border border-border bg-muted px-1 py-0.5 text-xs font-mono">{d}</code>
            ))}
          </p>

          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 backdrop-blur-sm">
            <p className="text-xs font-semibold text-foreground">Free · public · no API key · no rate limits</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Every endpoint below is open — no signup, no token, no quota. Pick any address on any domain we
              handle and start reading mail. <code className="rounded bg-muted px-1 font-mono">curl</code> works
              from anywhere; browsers get CORS <code className="rounded bg-muted px-1 font-mono">*</code>.
            </p>
          </div>

          <a href="https://github.com/Cryptoistaken" target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ExternalLink className="h-3 w-3" /> View on GitHub
          </a>
        </div>

        <Section title="Features">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/50 p-3 backdrop-blur-sm">
                <div className="mt-0.5 shrink-0">{f.icon}</div>
                <div>
                  <p className="text-xs font-semibold">{f.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Data models">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">MessageMeta <span className="text-muted-foreground font-normal">— inbox list &amp; SSE stream</span></p>
              <Table headers={['Field', 'Type', 'Description']} rows={[
                [<code className="font-mono">id</code>, 'string', 'UUID v4'],
                [<code className="font-mono">from</code>, 'string', 'Sender address e.g. foo@example.com'],
                [<code className="font-mono">subject</code>, 'string', 'RFC 2047 decoded subject line'],
                [<code className="font-mono">receivedAt</code>, 'string', 'ISO 8601 timestamp'],
                [<code className="font-mono">read</code>, 'boolean', 'Always false from server — read state is client-side only'],
                [<code className="font-mono">timeAgo</code>, 'string', 'Human-readable relative time e.g. "5m ago"'],
              ]} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">MessageFull <span className="text-muted-foreground font-normal">— single message endpoint</span></p>
              <Table headers={['Field', 'Type', 'Description']} rows={[
                [<code className="font-mono">id</code>, 'string', 'UUID v4'],
                [<code className="font-mono">from</code>, 'string', 'Sender address'],
                [<code className="font-mono">subject</code>, 'string', 'RFC 2047 decoded subject line'],
                [<code className="font-mono">receivedAt</code>, 'string', 'ISO 8601 timestamp'],
                [<code className="font-mono">read</code>, 'true', 'Always true in this response'],
                [<code className="font-mono">text</code>, 'string', 'Plain text body (may be empty)'],
                [<code className="font-mono">html</code>, 'string', 'HTML body (may be empty)'],
              ]} />
            </div>
          </div>
        </Section>

        <Section title="Own domains">
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            Mail sent to any of <code className="rounded border border-border bg-muted px-1 font-mono">{OWN_DOMAINS.join(', ')}</code> is
            stored for 30 days and served by these endpoints. No key, no limit.
          </p>
          <Endpoint method="GET" path="/api/inbox/:email"
            desc="List all messages in an inbox. Returns metadata only — no body content. Returns [] for unknown addresses. Never returns 404."
            params={[{ name: ':email', type: 'string', desc: `URL-encoded address e.g. mybox%40${OWN_DOMAINS[0]}` }]}
            headers={[{ name: 'If-None-Match', required: 'No', desc: 'Pass a previous ETag value; returns 304 if inbox is unchanged' }]}
            response={`[\n  {\n    "id": "3f2a1b4c-...",\n    "from": "sender@example.com",\n    "subject": "Your OTP code",\n    "receivedAt": "2026-03-15T04:58:16.053Z",\n    "read": false,\n    "timeAgo": "2m ago"\n  }\n]`}
            extra={
              <div>
                <p className="text-[11px] font-semibold text-foreground/70 mb-1">Response headers</p>
                <Table headers={['Header', 'Description']} rows={[
                  [<code className="font-mono">ETag</code>, 'Opaque inbox state hash — pass as If-None-Match on next request'],
                  [<code className="font-mono">Cache-Control</code>, 'no-cache'],
                ]} />
              </div>
            }
            curl={`curl ${BASE}/api/inbox/mybox%40${OWN_DOMAINS[0]}`}
          />
          <Endpoint method="GET" path="/api/inbox/:email/stream"
            desc="Real-time Server-Sent Events stream. Pushes full inbox state whenever it changes. Checks Redis every 800ms, emits only on actual changes. Auto-closes after ~295s — the browser EventSource reconnects automatically."
            params={[{ name: ':email', type: 'string', desc: 'URL-encoded address' }]}
            response={`data: {"type":"connected"}\n\ndata: {"type":"update","messages":[...]}`}
            extra={
              <div>
                <p className="text-[11px] font-semibold text-foreground/70 mb-1">Event types</p>
                <Table headers={['Type', 'Payload', 'When']} rows={[
                  [<code className="font-mono">connected</code>, <code className="font-mono">{'{ "type": "connected" }'}</code>, 'Immediately on open'],
                  [<code className="font-mono">update</code>, <code className="font-mono">{'{ "type": "update", "messages": MessageMeta[] }'}</code>, 'When inbox changes'],
                ]} />
              </div>
            }
            curl={`curl -N ${BASE}/api/inbox/mybox%40${OWN_DOMAINS[0]}/stream`}
          />
          <Endpoint method="GET" path="/api/inbox/:email/:id"
            desc="Fetch the full body of a single message. Read state is not written back to the server — it's client-side only."
            params={[
              { name: ':email', type: 'string', desc: 'URL-encoded inbox address' },
              { name: ':id', type: 'string', desc: 'Message UUID from the inbox list' },
            ]}
            response={`{\n  "id": "3f2a1b4c-...",\n  "from": "sender@example.com",\n  "subject": "Your OTP code",\n  "receivedAt": "2026-03-15T04:58:16.053Z",\n  "read": true,\n  "text": "Your code is 482910",\n  "html": "<div>Your code is <strong>482910</strong></div>"\n}`}
            errors={[
              { status: '404', body: '{ "error": "Not found" }', reason: 'Message ID not in inbox' },
              { status: '400', body: '{ "error": "Invalid request" }', reason: 'Missing or malformed params' },
            ]}
            curl={`curl ${BASE}/api/inbox/mybox%40${OWN_DOMAINS[0]}/3f2a1b4c-...`}
          />
          <Endpoint method="DELETE" path="/api/inbox/:email/:id"
            desc="Permanently delete a message. Removes metadata and body atomically. Inbox TTL is preserved."
            params={[
              { name: ':email', type: 'string', desc: 'URL-encoded inbox address' },
              { name: ':id', type: 'string', desc: 'Message UUID' },
            ]}
            response={`{ "ok": true }`}
            errors={[
              { status: '404', body: '{ "error": "Not found" }', reason: 'Message ID not in inbox' },
              { status: '400', body: '{ "error": "Invalid request" }', reason: 'Missing or malformed params' },
            ]}
            curl={`curl -X DELETE "${BASE}/api/inbox/mybox%40${OWN_DOMAINS[0]}/3f2a1b4c-..."`}
          />
        </Section>

        <Section title="Third-party inboxes">
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            One proxy per external provider, same free/no-key rules. Every action returns the same{' '}
            <code className="rounded border border-border bg-muted px-1 font-mono">MessageMeta</code> /{' '}
            <code className="rounded border border-border bg-muted px-1 font-mono">MessageFull</code> shapes as above,
            so readers written for own domains work unchanged. Only <code className="rounded border border-border bg-muted px-1 font-mono">action=</code> varies.
          </p>

          <Table headers={['Provider', 'Domains', 'Actions']} rows={
            ALL_PROVIDERS.filter(p => p.id !== 'kilolabs').map(p => [
              <span className="font-mono">{p.id}</span>,
              <span className="font-mono text-[11px]">{p.domains.join(', ')}</span>,
              <span className="font-mono text-[11px]">{providerActions(p)}</span>,
            ])
          } />

          <Endpoint method="GET" path="/api/providers/:provider?action=inbox&email=:email"
            desc="List messages in a third-party inbox. Never errors on an empty or unknown address — returns []."
            params={[
              { name: ':provider', type: 'string', desc: 'Provider id from the table above' },
              { name: 'email', type: 'string', desc: 'Full address to read, any local part' },
            ]}
            response={`[\n  { "id": "mCuvW71Ssy", "from": "sender@example.com", "subject": "Hi", "receivedAt": "2026-10-21T06:07:56.280Z", "read": false, "timeAgo": "1m ago" }\n]`}
            curl={`curl "${BASE}/api/providers/maildrop?action=inbox&email=mybox%40maildrop.cc"`}
          />
          <Endpoint method="GET" path="/api/providers/:provider?action=read&email=:email&id=:id"
            desc="Full body of one message, including text and html."
            params={[
              { name: ':provider', type: 'string', desc: 'Provider id' },
              { name: 'email', type: 'string', desc: 'Address the message belongs to' },
              { name: 'id', type: 'string', desc: 'Message id from action=inbox' },
            ]}
            response={`{ "id": "mCuvW71Ssy", "from": "sender@example.com", "subject": "Hi", "receivedAt": "2026-10-21T06:07:56.280Z", "read": true, "text": "...", "html": "..." }`}
            curl={`curl "${BASE}/api/providers/maildrop?action=read&email=mybox%40maildrop.cc&id=mCuvW71Ssy"`}
          />
          <Endpoint method="POST" path="/api/providers/:provider?action=create"
            desc="Providers that issue addresses (mail.tm, temp-mail.io) create the mailbox first; the address only exists after this call. Providers marked with create in the table also expose createEmail in the web UI."
            params={[{ name: 'name', type: 'string', desc: 'Optional local part to claim (temp-mail.io)' }, { name: 'domain', type: 'string', desc: 'Optional domain to use' }]}
            headers={[{ name: 'Content-Type', required: 'Yes*', desc: '*Only for providers that take a JSON body (mail.tm: { address, password })' }]}
            response={`{ "email": "mybox@yzcalo.com" }`}
            curl={`curl -X POST "${BASE}/api/providers/tempmailio?action=create&domain=yzcalo.com&name=mybox"`}
          />
          <Endpoint method="DELETE" path="/api/providers/:provider?action=delete&email=:email&id=:id"
            desc="Delete one message where the provider supports it (see Actions in the table)."
            params={[
              { name: ':provider', type: 'string', desc: 'Provider id' },
              { name: 'email', type: 'string', desc: 'Address the message belongs to' },
              { name: 'id', type: 'string', desc: 'Message id' },
            ]}
            response={`{ "ok": true }`}
            errors={[{ status: '501', reason: 'Provider has no delete route — check the Actions column' }]}
            curl={`curl -X DELETE "${BASE}/api/providers/maildrop?action=delete&email=mybox%40maildrop.cc&id=mCuvW71Ssy"`}
          />
        </Section>

        <Section title="Limits">
          <Table headers={['Property', 'Value']} rows={[
            ['Rate limits', 'None — no API key, no quota, no throttling'],
            ['API key', 'Not required for any endpoint'],
            ['Retention', '30 days from receipt — expired messages are filtered and pruned'],
            ['Max messages', '50 per inbox — oldest trimmed first on overflow'],
            ['Own domains', OWN_DOMAINS.join(', ')],
            ['Read state', 'Client-side only — no server write on message open'],
            ['SSE check interval', '800ms — emits only when inbox changes'],
            ['SSE max duration', '~295s — client must reconnect'],
          ]} />
        </Section>

        <Section title="Errors">
          <p className="text-xs text-muted-foreground mb-3">All error responses return JSON with an <code className="rounded border border-border bg-muted px-1 font-mono">error</code> field:</p>
          <CopyBlock code={`{ "error": "Description of what went wrong" }`} />
          <div className="mt-3">
            <Table headers={['Status', 'Meaning']} rows={[
              [<code className="font-mono">400</code>, 'Bad request — missing email/id/action'],
              [<code className="font-mono">404</code>, 'Message not found in that inbox'],
              [<code className="font-mono">405</code>, 'Method not allowed'],
              [<code className="font-mono">501</code>, 'Provider does not support this action (e.g. delete)'],
              [<code className="font-mono">502</code>, 'Upstream provider refused or failed the call'],
            ]} />
          </div>
        </Section>

        <Section title="Quick reference">
          <CopyBlock code={`# own domains — 30-day storage            -> ${OWN_DOMAINS.join(', ')}
GET    /api/inbox/:email         → MessageMeta[]   List inbox
GET    /api/inbox/:email/stream  → SSE stream      Real-time updates
GET    /api/inbox/:email/:id     → MessageFull     Fetch message body
DELETE /api/inbox/:email/:id     → { ok: true }    Delete message

# third-party inboxes — free, no key, same JSON
GET    /api/providers/:p?action=inbox&email=:e
GET    /api/providers/:p?action=read&email=:e&id=:i
POST   /api/providers/:p?action=create
DELETE /api/providers/:p?action=delete&email=:e&id=:i`} />
        </Section>

        <Section title="Self-hosting">
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            KiloMail runs on Vercel (Edge Functions) + Upstash Redis + a Cloudflare Email Worker. Clone the repo and set these environment variables:
          </p>
          <CopyBlock code={`UPSTASH_REDIS_REST_URL=https://your-db.upstash.io\nUPSTASH_REDIS_REST_TOKEN=your_token\nWEBHOOK_SECRET=your_shared_secret`} />
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            In <code className="rounded border border-border bg-muted px-1 text-[11px] font-mono">worker/wrangler.toml</code> set{' '}
            <code className="rounded border border-border bg-muted px-1 text-[11px] font-mono">DOMAINS</code> to your own domains, enable Cloudflare
            Email Routing on each zone, and point its catch-all route at the included{' '}
            <code className="rounded border border-border bg-muted px-1 text-[11px] font-mono">worker/index.ts</code>.
            Deploy the worker, then the Vercel project — new domains are picked up automatically.
          </p>
        </Section>

        <Section title="Tech stack">
          <div className="flex flex-wrap gap-2">
            {['Cloudflare Email Routing', 'Upstash Redis', 'Vercel Edge Functions', 'React + Vite', 'Tailwind CSS', 'shadcn/ui', 'MagicUI', 'TypeScript'].map(t => (
              <span key={t} className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{t}</span>
            ))}
          </div>
        </Section>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 pb-4">
          <Terminal className="h-3 w-3" />
          MIT Licensed · Built by{' '}
          <a href="https://github.com/Cryptoistaken" target="_blank" rel="noopener noreferrer"
            className="hover:text-foreground transition-colors underline underline-offset-2">
            Ratul
          </a>
        </div>
      </div>
    </div>
  )
}
