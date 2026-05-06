import { FlickeringBg } from "./FlickeringBg"
import {
  Zap, Shield, Clock, Globe, RefreshCw, Sparkles,
  Terminal, Copy, Check, ExternalLink, BookOpen,
  Inbox, History, Settings,
} from "lucide-react"
import { useState } from "react"

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
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-foreground/80">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-muted-foreground align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Badge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/15 text-emerald-500",
    DELETE: "bg-destructive/15 text-destructive",
    POST: "bg-primary/15 text-primary",
  }
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${colors[method] ?? "bg-muted text-muted-foreground"}`}>
      {method}
    </span>
  )
}

function Endpoint({
  method, path, desc, params, headers, response, errors, curl, extra,
}: {
  method: string
  path: string
  desc: string
  params?: { name: string; type: string; desc: string }[]
  headers?: { name: string; required: string; desc: string }[]
  response?: string
  errors?: { status: string; body?: string; reason: string }[]
  curl?: string
  extra?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 backdrop-blur-sm overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/40">
        <Badge method={method} />
        <code className="text-xs font-mono text-foreground">{path}</code>
      </div>
      <div className="px-3 py-3 space-y-3">
        <p className="text-xs text-muted-foreground">{desc}</p>

        {params && params.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-foreground/70 mb-1">Path parameters</p>
            <Table
              headers={["Param", "Type", "Description"]}
              rows={params.map(p => [<code className="font-mono">{p.name}</code>, p.type, p.desc])}
            />
          </div>
        )}

        {headers && headers.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-foreground/70 mb-1">Headers</p>
            <Table
              headers={["Header", "Required", "Description"]}
              rows={headers.map(h => [<code className="font-mono">{h.name}</code>, h.required, h.desc])}
            />
          </div>
        )}

        {extra}

        {response && (
          <div>
            <p className="text-[11px] font-semibold text-foreground/70 mb-1">Response</p>
            <CopyBlock code={response} />
          </div>
        )}

        {errors && errors.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-foreground/70 mb-1">Errors</p>
            <Table
              headers={errors[0].body !== undefined ? ["Status", "Body", "Reason"] : ["Status", "Reason"]}
              rows={errors.map(e =>
                e.body !== undefined
                  ? [<code className="font-mono">{e.status}</code>, <code className="font-mono">{e.body}</code>, e.reason]
                  : [<code className="font-mono">{e.status}</code>, e.reason]
              )}
            />
          </div>
        )}

        {curl && (
          <div>
            <p className="text-[11px] font-semibold text-foreground/70 mb-1">Example</p>
            <CopyBlock code={curl} />
          </div>
        )}
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: <Zap className="h-4 w-4 text-primary" />, title: "Instant delivery", desc: "Cloudflare receives SMTP, writes to Upstash Redis, SSE pushes to the browser — all under 1 second." },
  { icon: <Shield className="h-4 w-4 text-primary" />, title: "Zero sign-up", desc: "No account, no OAuth, no tracking. Generate an @kilolabs.space address and start receiving." },
  { icon: <Clock className="h-4 w-4 text-primary" />, title: "Auto-expiry", desc: "Inboxes expire 10 minutes after the last received email. Nothing persists forever." },
  { icon: <Globe className="h-4 w-4 text-primary" />, title: "SSE live stream", desc: "Real-time push via Server-Sent Events. No polling. The inbox updates the moment mail arrives." },
  { icon: <RefreshCw className="h-4 w-4 text-primary" />, title: "Instant regeneration", desc: "Click once to generate a fresh random address. Old address expires on its own." },
  { icon: <Sparkles className="h-4 w-4 text-primary" />, title: "Open source (MIT)", desc: "Full source on GitHub. Self-host on Vercel + Upstash in under 5 minutes." },
]

const DOCK_ITEMS = [
  { icon: <Inbox className="h-4 w-4" />, label: "Inbox", desc: "Your current inbox. Shows unread count badge." },
  { icon: <History className="h-4 w-4" />, label: "History", desc: "Last 50 addresses you've used, with total mail count each." },
  { icon: <BookOpen className="h-4 w-4" />, label: "Docs", desc: "You are here." },
  { icon: <Settings className="h-4 w-4" />, label: "Settings", desc: "Regenerate address, view current inbox address." },
]

export function DocsView() {
  return (
    <div className="relative flex-1 overflow-y-auto">
      <FlickeringBg />
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Documentation</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">KiloMail API Reference</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Base URL: <code className="rounded border border-border bg-muted px-1 py-0.5 text-xs font-mono">https://kilomail.vercel.app</code>
            {" · "}Domain: <code className="rounded border border-border bg-muted px-1 py-0.5 text-xs font-mono">kilolabs.space</code>
          </p>
          <a href="https://github.com/Cryptoistaken" target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ExternalLink className="h-3 w-3" /> View on GitHub
          </a>
        </div>

        {/* Features */}
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

        {/* Data Models */}
        <Section title="Data models">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">MessageMeta <span className="text-muted-foreground font-normal">— inbox list &amp; SSE stream</span></p>
              <Table
                headers={["Field", "Type", "Description"]}
                rows={[
                  [<code className="font-mono">id</code>, "string", "UUID v4"],
                  [<code className="font-mono">from</code>, "string", "Sender address e.g. foo@example.com"],
                  [<code className="font-mono">subject</code>, "string", "RFC 2047 decoded subject line"],
                  [<code className="font-mono">receivedAt</code>, "string", "ISO 8601 timestamp"],
                  [<code className="font-mono">read</code>, "boolean", "Always false from server — read state is client-side only"],
                  [<code className="font-mono">timeAgo</code>, "string", 'Human-readable relative time e.g. "5m ago"'],
                ]}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">MessageFull <span className="text-muted-foreground font-normal">— single message endpoint</span></p>
              <Table
                headers={["Field", "Type", "Description"]}
                rows={[
                  [<code className="font-mono">id</code>, "string", "UUID v4"],
                  [<code className="font-mono">from</code>, "string", "Sender address"],
                  [<code className="font-mono">subject</code>, "string", "RFC 2047 decoded subject line"],
                  [<code className="font-mono">receivedAt</code>, "string", "ISO 8601 timestamp"],
                  [<code className="font-mono">read</code>, "true", "Always true in this response"],
                  [<code className="font-mono">text</code>, "string", "Plain text body (may be empty)"],
                  [<code className="font-mono">html</code>, "string", "HTML body (may be empty)"],
                ]}
              />
            </div>
          </div>
        </Section>

        {/* Endpoints */}
        <Section title="Endpoints">
          <Endpoint
            method="GET"
            path="/api/inbox/:email"
            desc="List all messages in an inbox. Returns metadata only — no body content. Returns [] for unknown addresses. Never returns 404."
            params={[{ name: ":email", type: "string", desc: "URL-encoded address e.g. mybox%40kilolabs.space" }]}
            headers={[{ name: "If-None-Match", required: "No", desc: "Pass a previous ETag value; returns 304 if inbox is unchanged" }]}
            response={`[\n  {\n    "id": "3f2a1b4c-...",\n    "from": "sender@example.com",\n    "subject": "Your OTP code",\n    "receivedAt": "2026-03-15T04:58:16.053Z",\n    "read": false,\n    "timeAgo": "2m ago"\n  }\n]`}
            extra={
              <div>
                <p className="text-[11px] font-semibold text-foreground/70 mb-1">Response headers</p>
                <Table
                  headers={["Header", "Description"]}
                  rows={[
                    [<code className="font-mono">ETag</code>, "Opaque inbox state hash — pass as If-None-Match on next request"],
                    [<code className="font-mono">Cache-Control</code>, "no-cache"],
                  ]}
                />
              </div>
            }
            curl={`curl https://kilomail.vercel.app/api/inbox/mybox%40kilolabs.space`}
          />

          <Endpoint
            method="GET"
            path="/api/inbox/:email/stream"
            desc="Real-time Server-Sent Events stream. Pushes full inbox state whenever it changes. Checks Redis every 800ms, emits only on actual changes. Auto-closes after ~295s — the browser EventSource reconnects automatically."
            params={[{ name: ":email", type: "string", desc: "URL-encoded address" }]}
            response={`data: {"type":"connected"}\n\ndata: {"type":"update","messages":[...]}`}
            extra={
              <div>
                <p className="text-[11px] font-semibold text-foreground/70 mb-1">Event types</p>
                <Table
                  headers={["Type", "Payload", "When"]}
                  rows={[
                    [<code className="font-mono">connected</code>, <code className="font-mono">{"{ \"type\": \"connected\" }"}</code>, "Immediately on open"],
                    [<code className="font-mono">update</code>, <code className="font-mono">{"{ \"type\": \"update\", \"messages\": MessageMeta[] }"}</code>, "When inbox changes"],
                  ]}
                />
              </div>
            }
            curl={`curl -N https://kilomail.vercel.app/api/inbox/mybox%40kilolabs.space/stream`}
          />

          <Endpoint
            method="GET"
            path="/api/inbox/:email/:id"
            desc="Fetch the full body of a single message. Read state is not written back to the server — it's client-side only."
            params={[
              { name: ":email", type: "string", desc: "URL-encoded inbox address" },
              { name: ":id", type: "string", desc: "Message UUID from the inbox list" },
            ]}
            response={`{\n  "id": "3f2a1b4c-...",\n  "from": "sender@example.com",\n  "subject": "Your OTP code",\n  "receivedAt": "2026-03-15T04:58:16.053Z",\n  "read": true,\n  "text": "Your code is 482910",\n  "html": "<div>Your code is <strong>482910</strong></div>"\n}`}
            errors={[
              { status: "404", body: '{ "error": "Not found" }', reason: "Message ID not in inbox" },
              { status: "400", body: '{ "error": "Invalid request" }', reason: "Missing or malformed params" },
            ]}
            curl={`curl https://kilomail.vercel.app/api/inbox/mybox%40kilolabs.space/3f2a1b4c-...`}
          />

          <Endpoint
            method="DELETE"
            path="/api/inbox/:email/:id"
            desc="Permanently delete a message. Removes metadata and body atomically. Inbox TTL is preserved."
            params={[
              { name: ":email", type: "string", desc: "URL-encoded inbox address" },
              { name: ":id", type: "string", desc: "Message UUID" },
            ]}
            response={`{ "ok": true }`}
            errors={[
              { status: "404", body: '{ "error": "Not found" }', reason: "Message ID not in inbox" },
              { status: "400", body: '{ "error": "Invalid request" }', reason: "Missing or malformed params" },
            ]}
            curl={`curl -X DELETE "https://kilomail.vercel.app/api/inbox/mybox%40kilolabs.space/3f2a1b4c-..."`}
          />
        </Section>

        {/* Limits */}
        <Section title="Limits">
          <Table
            headers={["Property", "Value"]}
            rows={[
              ["Inbox TTL", "600s from last received email — resets on each delivery"],
              ["Max messages", "50 per inbox — oldest trimmed first on overflow"],
              ["Domain", "Only @kilolabs.space accepted"],
              ["Read state", "Client-side only — no server write on message open"],
              ["SSE check interval", "800ms — emits only when inbox changes"],
              ["SSE max duration", "~295s — client must reconnect"],
            ]}
          />
        </Section>

        {/* Error format */}
        <Section title="Errors">
          <p className="text-xs text-muted-foreground mb-3">All error responses return JSON with an <code className="rounded border border-border bg-muted px-1 font-mono">error</code> field:</p>
          <CopyBlock code={`{ "error": "Description of what went wrong" }`} />
          <div className="mt-3">
            <Table
              headers={["Status", "Meaning"]}
              rows={[
                [<code className="font-mono">400</code>, "Bad request"],
                [<code className="font-mono">404</code>, "Not found"],
                [<code className="font-mono">405</code>, "Method not allowed"],
              ]}
            />
          </div>
        </Section>

        {/* Quick Reference */}
        <Section title="Quick reference">
          <CopyBlock code={`GET    /api/inbox/:email         → MessageMeta[]   List inbox
GET    /api/inbox/:email/stream  → SSE stream      Real-time updates
GET    /api/inbox/:email/:id     → MessageFull     Fetch message body
DELETE /api/inbox/:email/:id     → { ok: true }    Delete message`} />
        </Section>

        {/* Navigation */}
        <Section title="Navigation (Dock)">
          <div className="space-y-2">
            {DOCK_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 backdrop-blur-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground/70">
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Self-hosting */}
        <Section title="Self-hosting">
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            KiloMail runs on Vercel (Edge Functions) + Upstash Redis + a Cloudflare Email Worker.
            Clone the repo and set these environment variables:
          </p>
          <CopyBlock code={`UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
CF_WORKER_SECRET=your_shared_secret`} />
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            Point your domain's MX record to Cloudflare Email Routing, then set the catch-all route to forward to
            the included <code className="rounded border border-border bg-muted px-1 text-[11px] font-mono">cf-worker/index.ts</code>.
            Deploy the Vercel project and you're done.
          </p>
        </Section>

        {/* Stack */}
        <Section title="Tech stack">
          <div className="flex flex-wrap gap-2">
            {["Cloudflare Email Routing", "Upstash Redis", "Vercel Edge Functions", "React + Vite", "Tailwind CSS", "shadcn/ui", "MagicUI", "TypeScript"].map(t => (
              <span key={t} className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{t}</span>
            ))}
          </div>
        </Section>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 pb-4">
          <Terminal className="h-3 w-3" />
          MIT Licensed · Built by{" "}
          <a href="https://github.com/Cryptoistaken" target="_blank" rel="noopener noreferrer"
            className="hover:text-foreground transition-colors underline underline-offset-2">
            Ratul
          </a>
        </div>

      </div>
    </div>
  )
}
