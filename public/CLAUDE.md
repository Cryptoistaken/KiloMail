# Dropnal — AI Context File

This file is for Claude. Read this before touching anything in this project.

---

## What this project is

A long-term reusable frontend template for building websites and web apps.
Stack: Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui + MagicUI.
Every new website starts from this repo.

---

## Stack & versions (verified March 2026)

| Package | In use | Latest stable | Status |
|---|---|---|---|
| vite | ^7.3.1 | 7.3.1 | ✅ Current |
| react | ^19.2.0 | 19.x | ✅ Current |
| typescript | ~5.9.3 | 5.x | ✅ Current |
| tailwindcss | ^4.2.1 | 4.2.1 | ✅ Current |
| @tailwindcss/vite | ^4.2.1 | 4.2.1 | ✅ Current |
| shadcn (CLI) | ^4.0.5 | 4.x (CLI v4 March 2026) | ✅ Current |
| lucide-react | ^0.577.0 | 0.5x | ✅ Current |
| @fontsource-variable/geist | ^5.2.8 | 5.x | ✅ Current |
| tw-animate-css | ^1.4.0 | 1.x | ✅ Current |

---

## Project structure

```
src/
  components/
    ui/          ← shadcn components (owned code, not a package)
    magicui/     ← MagicUI components (owned code, not a package)
  lib/
    utils.ts     ← cn() helper (clsx + tailwind-merge)
  App.tsx        ← minimal entry point, replace per project
  index.css      ← Tailwind import + full CSS variable theme
  main.tsx       ← React root mount
```

---

## How Tailwind v4 works here (IMPORTANT — very different from v3)

- **No `tailwind.config.js`**. All config lives in `src/index.css` using `@theme`.
- Theme tokens are CSS variables in `src/index.css` under `:root` and `.dark`.
- The Vite plugin (`@tailwindcss/vite`) handles everything. No PostCSS config needed.
- `@import "tailwindcss"` at top of `index.css` is the only directive needed.
- Content scanning is automatic — no content array to configure.
- Colors use OKLCH format (`oklch(L C H)`) for better vibrancy and dark mode.

**Adding a custom color:**
```css
/* in src/index.css inside @theme inline { } */
--color-brand: oklch(0.6 0.2 250);
/* then use as: bg-brand, text-brand, border-brand */
```

**DO NOT:**
- Create `tailwind.config.js` or `tailwind.config.ts`
- Use `@tailwind base/components/utilities` directives (v3 syntax)
- Install `autoprefixer` or `postcss-import` (v4 handles these automatically)

---

## How shadcn works here

Style: **base-nova** (compact, reduced padding — good for dense UIs).
Base color: **neutral**. CSS variables: on. Primitive: **Base UI** (not Radix).

`components.json` controls all paths. Never move `src/components/ui/` or
`src/lib/utils.ts` without updating `components.json`.

**Add a component:**
```bash
npx shadcn@latest add <component-name>
# Examples:
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add sheet
npx shadcn@latest add table
npx shadcn@latest add form
```

Files land in `src/components/ui/`. They are owned code — edit freely.

**Other useful CLI commands (shadcn CLI v4):**
```bash
npx shadcn@latest init          # re-scaffold if starting fresh
npx shadcn@latest docs          # open docs for a component
npx shadcn@latest --diff        # see upstream changes to your components
```

---

## How MagicUI works here

MagicUI = animated/motion UI components (shimmer, marquee, bento grids, etc.).
They are added via the shadcn CLI using remote registry URLs.
Files land in `src/components/magicui/`.

**`magicui-cli` IS BROKEN** — PostHog analytics crash on startup, package is
2 years stale. Never use `npx magicui-cli`. Always use shadcn CLI instead:

```bash
npx shadcn@latest add "https://magicui.design/r/<component-name>"

# Common components:
npx shadcn@latest add "https://magicui.design/r/animated-gradient-text"
npx shadcn@latest add "https://magicui.design/r/shimmer-button"
npx shadcn@latest add "https://magicui.design/r/bento-grid"
npx shadcn@latest add "https://magicui.design/r/marquee"
npx shadcn@latest add "https://magicui.design/r/number-ticker"
npx shadcn@latest add "https://magicui.design/r/text-reveal"
npx shadcn@latest add "https://magicui.design/r/blur-fade"
npx shadcn@latest add "https://magicui.design/r/animated-beam"
```

Browse all: https://magicui.design/docs

**Known bug:** After adding a MagicUI component, check the file for import paths
like `/lib/utils` — should be `@/lib/utils`. Fix manually if found.
This is a shadcn CLI bug with third-party registries (shadcn issue #7818).

---

## Path alias

`@/` → `src/`. Configured in `vite.config.ts` and `tsconfig.app.json`.

```ts
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Marquee } from "@/components/magicui/marquee"
```

---

## Font

Geist Variable is the default sans font (`@fontsource-variable/geist`).
Set in `index.css`:
```css
--font-sans: 'Geist Variable', sans-serif;
```

To swap: replace the `@fontsource-variable/...` package, update the
`@import` in `index.css`, update `--font-sans`.

---

## CSS variable reference (src/index.css)

| Variable | Purpose |
|---|---|
| `--background` / `--foreground` | Page bg and body text |
| `--primary` / `--primary-foreground` | Primary action color |
| `--secondary` / `--secondary-foreground` | Secondary action |
| `--muted` / `--muted-foreground` | Subdued bg and text |
| `--accent` / `--accent-foreground` | Highlight areas |
| `--destructive` | Danger/error color |
| `--border` | Default border |
| `--input` | Input field border |
| `--ring` | Focus ring |
| `--radius` | Base radius (components scale off this) |
| `--font-sans` | Body font |
| `--sidebar-*` | Sidebar-specific tokens |
| `--chart-1` to `--chart-5` | Chart color palette |

---

## Starting a new project from this template

```powershell
Copy-Item "B:\Studio\Tools\Dropnal" "B:\Studio\Tools\MyNewSite" -Recurse -Exclude node_modules,.git
cd "B:\Studio\Tools\MyNewSite"
npm install
npm run dev
```

Then just replace `src/App.tsx` and start building.

Also update `name` in `package.json` to match your project name.

---

## Things to watch when upgrading

### Vite 8 (expected late 2026)
- Rolldown (Rust-based bundler) becomes the default — currently opt-in via `rolldown-vite`
- Node.js 20.19+ or 22.12+ required (already the case for Vite 7)
- Migration guide: https://vite.dev/guide/migration

### Tailwind v4 minor updates (4.x)
- Minor updates are backward compatible
- `start-*` and `end-*` utilities deprecated in 4.2 → use `inset-s-*` / `inset-e-*`
- No config file to update when upgrading, just CSS

### shadcn CLI updates
- CLI v4 dropped March 2026 — re-run `npx shadcn@latest init` if behavior seems wrong
- Use `--diff` flag to see upstream changes to your local components
- `--base` flag lets you switch primitive library (Radix vs Base UI)

### React
- React 19 is stable. No breaking changes expected soon.
- This is an SPA — no RSC (`rsc: false` in `components.json`)

---

## Commands

```bash
npm run dev       # dev server → localhost:5173
npm run build     # production build
npm run preview   # preview production build locally
npm run lint      # ESLint check
```
