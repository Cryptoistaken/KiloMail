# KiloMail

Disposable email web app. Multiple domains, SSE streaming, OTP code detection.

Stack: React 19 · Vite · Tailwind v4 · shadcn/ui · Vercel Edge Functions · Upstash Redis · Cloudflare Email Workers

---

## Architecture

```
Email sent to anything@factoryai.tech (or @kilomail.my.id, @kilosms.web.id, @kilomail.tech)
         ↓
Cloudflare Email Routing (catch-all → Email Worker)
         ↓
worker/index.ts — parses raw MIME, writes JSON to Redis
         ↓
Upstash Redis (inbox hash, body keys with 30-day TTL)
         ↓
Frontend SSE stream
```

---

## Setup

Public URL: **https://kilomail.tech** (`https://kilomail.vercel.app` keeps working as the Vercel
production alias). Every API call in the frontend is same-origin (`/api/...`), so the app works on
any host it is opened on — nothing to change in code when a domain is added.

### 1. Upstash Redis

1. Create a free database at https://console.upstash.com
2. Copy **REST URL** and **REST Token**
3. Add them as Vercel environment variables

### 2. Cloudflare Email Routing

1. In Cloudflare dashboard → **Email** → **Email Routing**
2. Enable Email Routing for each own domain (`factoryai.tech`, `kilomail.my.id`, `kilosms.web.id`, `kilomail.tech`)
3. On every zone, set a **catch-all** rule → action: **Send to Worker** → select `kilomail-email-worker`

### 3. Deploy the Email Worker

```bash
cd worker
bun install
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler deploy
```

### 4. Deploy to Vercel

```bash
cd ..
bun install
npx vercel
```

Set environment variables in Vercel dashboard or CLI:

```bash
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add WEBHOOK_SECRET      # shared with the Cloudflare worker
```

---

## Local Development

```bash
bun install
npx vercel dev
```

---

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | api/, worker/ | Redis connection |
| `UPSTASH_REDIS_REST_TOKEN` | api/, worker/ | Redis auth |
| `WEBHOOK_SECRET` | api/webhook.ts | Validates inbound mail from Cloudflare |
| `TEST_MODE` | api/test.ts | Set to `1` to enable test email injection |
| `DOMAINS` | worker/wrangler.toml | Comma-separated MX domains bound to the email worker |

Secrets are set via `wrangler secret put` for the worker and Vercel env vars for the API.

---

## Adding a Provider

Create two files — see CLAUDE.md for the full walkthrough:

1. `src/providers/<name>.provider.ts` — frontend plugin (auto-discovered)
2. `api/providers/<name>.ts` — Vercel edge proxy

The own domains live in `kilolabs.provider.ts` and read Upstash Redis directly. Everything else is a
third-party inbox behind an `api/providers/<id>.ts` proxy. Public API reference: `#/docs` on the live site.
