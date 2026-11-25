# AGENTS.md — KiloMail

Read this before changing anything. `CLAUDE.md` has the deep detail (provider plugin system,
worked example); this file is the short version an agent needs to work safely.

## What this is

Disposable email. Two hosts:

| Host | Serves |
| --- | --- |
| `kilomail.tech` | the landing page + `/docs` |
| `app.kilomail.tech` | the inbox (not created yet — see **Host split**) |

The inbox also works on the apex, so shared links keep working.

Stack: React 19 + Vite + Tailwind v4 (shadcn/ui) · Cloudflare Pages Functions + Vercel edge
handlers (`api/`) · Upstash Redis · Cloudflare Email Worker for inbound MIME.

## Commands

```bash
npm run dev                      # vite, API is not running (use /api via the deployed host or wrangler pages dev)
npm run build                    # tsc -b && vite build
npx tsc -b                       # types only
node test/pull-mail.mjs          # refresh the real-mail corpus into test/data/ (gitignored)
bun  test/check-detectors.ts     # what the code/link detectors find and miss
bun  test/verify.ts              # check every found code/link against the mail it came from
```

## Deploying (important)

**A push to `main` has not been enough to update `kilomail.tech`.** The Pages project was found
serving a build several commits old. Deploy explicitly and then confirm the bundle hash changed:

```bash
npm run build
npx wrangler pages deploy dist --project-name kilomail --branch main --commit-dirty=true
# verify: fetch https://kilomail.tech/ and compare assets/index-*.js with dist/index.html
```

`npx wrangler whoami` must show the user's account. Pages builds Functions from `functions/`, so
a new `/api` route needs a line in `functions/api/[[path]].ts` as well as the handler itself.

## Where things are

```
src/hooks/useRoute.ts      real-path router; host split lives here
src/lib/host.ts            siteMode(), appUrl(), resolveAppBase()  (app. subdomain is probed)
src/lib/codes.ts           OTP detector        — every change must be re-measured (see test/)
src/lib/links.ts           verification-link detector — same rule
src/lib/prompt.ts          the "Copy prompt" text (agent setup prompt)
src/lib/history.ts         saved inboxes, MAX_HISTORY = 500
src/index.css              theme tokens + the `.theme3d` / `.theme3l` surface rules (unlayered)
api/                       edge handlers; also bundled by Cloudflare Pages Functions
functions/api/[[path]].ts  the Cloudflare router for /api/* — add new routes here
worker/index.ts            inbound mail -> Redis (Cloudflare Email Worker)
test/                      detector workbench (see test/README.md)
```

## API surface

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/inbox` | mint a random address + its URLs (`?name=` to claim one, 409 if it holds mail) |
| GET | `/api/inbox/:email` | message list, `[]` for unknown, ETag supported |
| GET | `/api/inbox/:email/code` | newest code **or** link in one call, `found:false` (never 404) |
| GET | `/api/inbox/:email/stream` | SSE `connected` / `update` |
| GET | `/api/inbox/:email/:id` | full body |
| DELETE | `/api/inbox/:email/:id` | delete one message |
| DELETE | `/api/inbox/:email` | wipe the inbox and its bodies |
| GET/DELETE/POST | `/api/providers/:provider?action=…` | third-party proxies |

Every endpoint is free, keyless and unthrottled. Keep that claim true or update `/docs`
(`src/app/views/DocsView.tsx`) in the same commit — the page is the contract.

## Detectors are measured, not guessed

`src/lib/codes.ts` and `src/lib/links.ts` are tuned against ~10k real mails. Do not "improve" them
by eye:

1. `node test/pull-mail.mjs` (needs `.dev.vars` — never print those values)
2. change the detector
3. `bun test/verify.ts` — **bad codes must stay 0**; bad links must not grow
4. `bun test/check-detectors.ts` — codes found should not drop

Current baseline: 7,804 codes (0 wrong), 150 links (7 flagged, all real). Showing nothing is
correct when a link only *looks* like a verification link; showing a wrong one is the bug users
report.

`subjectCode()` (the chip drawn straight from the list) only accepts a code next to a code word,
or a subject that is *nothing but* the code. It must never take a bare number from anywhere in a
subject — a timestamp used to turn "… | 2026-11-21 01:18:58" into a chip reading `2026`.

## Themes

Four, cycled by `AnimatedThemeToggler`: `light`, `dark` (Tailwind `.dark`), `3d` (`.dark` +
`.theme3d`), `3l` (`.theme3l`). `3d`/`3l` are the Revyl-inspired pair.

- Tokens live in `src/index.css`; the surface rules there are **unlayered on purpose** so they
  beat Tailwind utilities.
- App panes (`.panel3d`) stay **solid** — a translucent blurred pane over the purple gradient is
  what made the inbox look smeared.
- The landing's hero ramp is `.revyl-ramp` in `src/index.css`, applied from `Landing.tsx`.

## Host split

`siteMode()` decides: `app.*` = inbox, apex = landing, `localhost`/`*.pages.dev`/`*.vercel.app` =
one origin. `app.kilomail.tech` may not exist yet, so `resolveAppBase()` probes it once and the
landing falls back to the current origin. Never hardcode `app.kilomail.tech` in UI code — ask
`appBase()`.

On the apex, a browser that has used an inbox before (localStorage `kilomail_visited`) is sent
straight from `/` to its saved inbox, because that is what opening kilomail.tech means to them.
`https://kilomail.tech/?home` shows the landing page on purpose.

## Redis

```
inbox:<email>   hash   field = message id, value = JSON MessageMeta
body:<id>       string JSON { text, html }
```

30-day TTL, `MAX_MESSAGES = 500` per inbox (trimmed oldest-first on write in `worker/index.ts`,
`api/webhook.ts`, `api/test.ts` — change all three together).

## Do not break

- `src/providers/registry.ts` — auto-discovery, never edit.
- `src/providers/types.ts` — `ProviderPlugin`; a change touches every provider.
- SSE wire format — `{"type":"connected"}` / `{"type":"update","messages":[…]}`.
- `process.env` only in `api/` (and `worker/`), never in `src/` — the browser bundle must stay clean.
- `satisfies ProviderPlugin` on every provider export.
