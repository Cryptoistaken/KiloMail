# KiloMail

Disposable email web app. Multiple domains, SSE streaming, OTP code detection.

Stack: React 19 · Vite · Tailwind v4 · shadcn/ui · Vercel Edge Functions · Upstash Redis · Cloudflare Email Workers

**Working on this repo? Read [`AGENTS.md`](AGENTS.md) first** — it has the deploy command, the API
table, and the rules for the code/link detectors.

---

## Features

- **Live inbox** over SSE (own domains only: 30-day retention, real-time, delete).
- **One-time codes** are lifted from the subject and the whole body and offered as a copy chip. Detection
  covers digits (`482913`), letters+digits (`A1B2C3`) and CAPITAL letters only (`KQZX`). Each shape is
  anchored to a code-ish word, so a ZIP code in a mailing address or a CSS hex colour is never offered.
  Logic lives in `src/lib/codes.ts`; bodies are fetched in the background to find codes that only appear there.
- **Verification links** (`src/lib/links.ts`) are scored, not picked: the path has to say
  verify/confirm/magic/token or the button has to say "Verify email". Homepages, privacy policies and
  tracking pixels are never offered. Both detectors are measured against ~10k real mails — see `test/`.
- **Agent API.** `POST /api/inbox` mints an address, `GET /api/inbox/:email/code` returns the newest
  code (or link) in one call. The landing page's *Copy prompt* hands that workflow to a coding agent.
- **Sender identity.** The worker stores the header `From` address plus its display name as `fromName`,
  not Cloudflare's envelope sender (which for bulk mail is a machine token such as
  `010001a1dc...-000000@envelope.sup.kernel.sh`). The list shows the display name when there is one and falls
  back to the sender's domain; the raw address is in the tooltip.
- **Sender picture** — the sender's Gravatar photo, else their site logo, else the letter avatar
  (`src/app/components/SenderAvatar.tsx`).
- **New-mail chime** with a mute button in the dock (`src/lib/sound.ts`). Synthesised, so no audio file ships.
  Browsers only allow audio after the page has been clicked once.
- **History** re-checks every saved inbox in one click and searches both the addresses and the mail inside them.

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

Public URL: **https://kilomail.tech** — a Cloudflare Pages project (`kilomail`) that builds from this
repo and serves both the site and the API. `https://kilomail.vercel.app` serves the same app as a
backup. Every API call in the frontend is same-origin (`/api/...`), so the app works on any host it is
opened on — nothing to change in code when a domain is added.

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

### 4. Deploy the app

**Cloudflare Pages** (primary — serves `kilomail.tech`):

1. Pages project `kilomail` is connected to this repo; build command `npm run build`, output `dist`
2. Add the environment variables `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `WEBHOOK_SECRET` and `NODE_VERSION=22`
3. `nodejs_compat` is enabled so the `api/` handlers can read `process.env`
4. `functions/api/[[path]].ts` routes `/api/*` to those handlers

**A push does not always deploy.** If the live bundle (`assets/index-*.js`) does not change after a
push, ship it yourself and check the hash again:

```bash
npm run build
npx wrangler pages deploy dist --project-name kilomail --branch main --commit-dirty=true
```

`app.kilomail.tech` (the inbox host) is not created yet — add it as a custom domain on the same
Pages project. Until it exists the landing page falls back to the apex, so nothing breaks.

**Vercel** (backup — serves `kilomail.vercel.app`):

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

---

## Browser extension

`extension/` is a Manifest V3 side panel that loads the live site in a full-bleed iframe. It is a thin
wrapper on purpose — the whole app (address editing, history, docs, theme) is the website itself.

- No build step, no API key, nothing to configure; four files total.
- The site sends no `X-Frame-Options` and no CSP, so it frames cleanly — no header-rewriting rules needed.
- `allow="clipboard-read; clipboard-write"` is delegated to the iframe, otherwise the site's copy buttons,
  which need a cross-origin permission grant, would silently fail.
- The panel is its own origin, so its `localStorage` (current address, history) does **not** share with a
  normal browser tab.

Load it: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick the `extension/`
folder. The toolbar icon opens the panel. Hit **Reload** after changing the manifest or the icons.
