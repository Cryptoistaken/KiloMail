# KiloMail — project context for Claude

## What it is

Personal disposable email app. Small circle of known users. No public traffic concerns.
Stack: React 19, Vite 7, TypeScript, Tailwind v4, shadcn/ui, Vercel edge functions, Upstash Redis.

## Where things live

| What | Path |
|---|---|
| Plugin interface | `src/providers/types.ts` |
| Auto-discovery registry | `src/providers/registry.ts` |
| Each provider (frontend) | `src/providers/<name>.provider.ts` |
| Each provider (api proxy) | `api/providers/<name>.ts` |
| Shared message types | `src/lib/types.ts` |
| Main app logic | `src/App.tsx` |
| Inbox UI | `src/components/app/InboxView.tsx` |
| Message reader | `src/components/app/MessageView.tsx` |
| Email history | `src/components/app/HistoryView.tsx` |
| Settings panel | `src/components/app/SettingsView.tsx` |

## Current providers

| id | domains | transport | delete |
|---|---|---|---|
| kilolabs | kilolabs.space | SSE (own infra, Redis) | yes |
| hd | tenwmail.com, clowtmail.com | polling 5s (hotmail9.com proxy) | no |
| edu | iunp.edu.rs, warsawuni.edu.pl | SSE (getedumail.com proxy) | no |

## How to add a provider

Read `SKILL.md` — it has the full interface, a complete template for both files, and the exact shapes expected.
Short answer: 2 files, zero edits to anything else.

## Rules

- Never edit `src/providers/registry.ts` — it auto-discovers via `import.meta.glob`
- `src/lib/types.ts` has only `MessageMeta`, `MessageFull`, `Panel` and a few localStorage helpers — keep it that way
- `src/App.tsx` has zero provider-specific logic — keep it that way
- All provider-specific constants (API URLs, passwords, domain→host maps) stay inside the provider files

## Vercel routing note

API files at `api/providers/hd.ts` → route `/api/providers/hd`. Vercel file-based routing, edge runtime.
