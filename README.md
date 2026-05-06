# KiloMail

Disposable temp email service on `kilolabs.space`.

Stack: Bun · Vercel Edge Functions · Upstash Redis · Cloudflare Email Workers · Oat UI

---

## Architecture

```
Email sent to anything@kilolabs.space
         ↓
Cloudflare Email Routing (catch-all → Email Worker)
         ↓
cf-worker/index.ts — parses raw MIME, POSTs JSON to Vercel
         ↓
POST /api/webhook (x-webhook-secret header)
         ↓
Upstash Redis (stored with 10-min TTL)
         ↓
Frontend polls /api/inbox/:email every 4s
```

---

## Setup

### 1. Upstash Redis

1. Create a free database at https://console.upstash.com
2. Copy **REST URL** and **REST Token**
3. Add them as Vercel environment variables

### 2. Cloudflare Email Routing

1. In Cloudflare dashboard → **Email** → **Email Routing**
2. Enable Email Routing for `kilolabs.space`
3. Set a **catch-all** rule → action: **Send to Worker** → select `kilomail-email-worker`
4. Cloudflare will prompt you to add the required MX and TXT records automatically

### 3. Deploy the Email Worker

```bash
cd cf-worker
bun install

# Set secrets (you'll be prompted to type the value)
bun run secret:webhook-url     # e.g. https://kilolabs.space/api/webhook
bun run secret:webhook-secret  # any strong random string

# Deploy
bun run deploy
```

### 4. Deploy to Vercel

```bash
cd ..   # back to project root
bun install
npx vercel
```

Set environment variables in Vercel dashboard or CLI:

```bash
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add WEBHOOK_SECRET   # must match what you set in the CF Worker
```

---

## Local Development

```bash
bun install
cp .env.example .env.local
npx vercel dev
```

---

## Environment Variables

### Vercel (api/)

| Variable | Description |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `WEBHOOK_SECRET` | Shared secret — CF Worker sends this, Vercel verifies it |

### Cloudflare Worker (cf-worker/)

Set via `wrangler secret put`:

| Secret | Description |
|---|---|
| `WEBHOOK_URL` | Full URL to Vercel webhook, e.g. `https://kilolabs.space/api/webhook` |
| `WEBHOOK_SECRET` | Must match the Vercel `WEBHOOK_SECRET` above |
