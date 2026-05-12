import type { ProviderPlugin } from "./types"

const modules = import.meta.glob<{ default: ProviderPlugin }>(
  "./*.provider.ts",
  { eager: true },
)

export const ALL_PROVIDERS: ProviderPlugin[] = Object.values(modules)
  .map(m => m.default)
  .filter(p => p?.enabled)

export function getProvider(email: string): ProviderPlugin {
  const domain = email.split("@")[1] ?? ""
  const p = ALL_PROVIDERS.find(p => p.domains.includes(domain))
  if (!p) throw new Error(`No enabled provider for domain: ${domain}`)
  return p
}

export const DOMAINS = ALL_PROVIDERS.flatMap(p => p.domains)

export const DEFAULT_DOMAIN = DOMAINS[0] ?? "kilolabs.space"
