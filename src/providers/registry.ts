// ── Provider registry ──────────────────────────────────────────────────────
//
// Uses import.meta.glob to auto-discover every *.provider.ts in this folder.
// To add a provider: drop a new file here. To remove: delete the file.
// To disable without deleting: set enabled: false in the provider file.
//
// No changes to this file are ever needed.

import type { ProviderPlugin } from "./types"

const modules = import.meta.glob<{ default: ProviderPlugin }>(
  "./*.provider.ts",
  { eager: true },
)

export const ALL_PROVIDERS: ProviderPlugin[] = Object.values(modules)
  .map(m => m.default)
  .filter(p => p?.enabled)

/** Resolve the correct provider for a given email address. */
export function getProvider(email: string): ProviderPlugin {
  const domain = email.split("@")[1] ?? ""
  const p = ALL_PROVIDERS.find(p => p.domains.includes(domain))
  if (!p) throw new Error(`No enabled provider for domain: ${domain}`)
  return p
}

/** All domains across all enabled providers — used to build pickers. */
export const DOMAINS = ALL_PROVIDERS.flatMap(p => p.domains)

/** First domain of the first enabled provider — used as the default. */
export const DEFAULT_DOMAIN = DOMAINS[0] ?? "kilolabs.space"
