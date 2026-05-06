import { useState } from "react"
import { RefreshCw, Copy, Check, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { DOMAINS, type KiloDomain } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SettingsViewProps {
  email: string
  onNewInbox: (domain?: KiloDomain) => void
}

export function SettingsView({ email, onNewInbox }: SettingsViewProps) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<KiloDomain>(
    () => (DOMAINS.find(d => email.endsWith(`@${d}`)) ?? DOMAINS[0]) as KiloDomain
  )

  const handleCopy = () => {
    navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleGenerate = () => {
    if (!confirming) { setConfirming(true); return }
    setConfirming(false)
    onNewInbox(selectedDomain)
  }

  return (
    <div className="relative z-10 flex-1 overflow-y-auto">
      <div className="relative z-10 flex flex-col gap-5 p-5 max-w-lg">

        <div>
          <h3 className="text-sm font-semibold">Settings</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Inbox preferences</p>
        </div>

        <Separator />

        {/* Current inbox card */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 backdrop-blur-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current inbox</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs font-mono break-all">
              {email}
            </code>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
              {copied
                ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Inbox auto-expires 10 minutes after the last received email.
          </p>
        </div>

        {/* Generate new address */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 backdrop-blur-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Generate new address</p>
          <p className="text-xs text-muted-foreground">
            Pick a domain, then generate a fresh random address.
          </p>

          {/* Domain pills */}
          <div className="relative z-10 flex flex-wrap gap-2">
            {DOMAINS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => { setSelectedDomain(d); setConfirming(false) }}
                className={cn(
                  "relative z-10 rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer select-none",
                  d === selectedDomain
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background/60 hover:bg-muted"
                )}
              >
                @{d}
              </button>
            ))}
          </div>

          {/* Confirm warning */}
          {confirming && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                New random inbox on <span className="font-mono">@{selectedDomain}</span>. Current inbox expires naturally. Continue?
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant={confirming ? "destructive" : "outline"}
              size="sm"
              onClick={handleGenerate}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {confirming ? `Yes, generate @${selectedDomain}` : "Generate new address"}
            </Button>
            {confirming && (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
