import { useState } from "react"
import { Trash2, Wifi, WifiOff, Inbox, RefreshCw, Loader2, CheckCheck, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MessageSkeleton } from "./MessageSkeleton"
import type { MessageMeta } from "@/lib/types"

// Deterministic pastel color for a sender string
const AVATAR_COLORS = [
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
]
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

interface InboxViewProps {
  email: string
  messages: MessageMeta[]
  loading: boolean
  connected: boolean
  selected: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onRefresh: () => void
  bodyCodes: Record<string, string>
}

export function InboxView({
  email, messages, loading, connected,
  selected, onSelect, onDelete, onRefresh, bodyCodes,
}: InboxViewProps) {
  // "deleting" = spinner shown, "deleted" = brief green flash, null = idle
  const [deleteState, setDeleteState] = useState<Record<string, "deleting" | "deleted">>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Universal code extraction — works for any sender
  function getCode(msg: MessageMeta): string | null {
    // 1. Try subject: any 4-8 digit sequence anywhere in the subject
    const subjectMatch = msg.subject?.match(/\b(\d{4,8})\b/)
    if (subjectMatch) return subjectMatch[1]
    // 2. Fall back to body code pre-fetched by App
    return bodyCodes[msg.id] ?? null
  }

  const handleCopy = async (e: React.MouseEvent, msg: MessageMeta) => {
    e.stopPropagation()
    const code = getCode(msg)
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopiedId(msg.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeleteState(s => ({ ...s, [id]: "deleting" }))
    try {
      await onDelete(id)
      setDeleteState(s => ({ ...s, [id]: "deleted" }))
      setTimeout(() => setDeleteState(s => { const n = { ...s }; delete n[id]; return n }), 800)
    } catch {
      // reset on failure
      setDeleteState(s => { const n = { ...s }; delete n[id]; return n })
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1 text-xs",
            connected ? "text-emerald-500" : "text-zinc-400"
          )}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{connected ? "live" : "reconnecting…"}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
              <Inbox className="h-6 w-6 text-muted-foreground" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                0
              </span>
            </div>
            <p className="text-sm font-medium">Inbox is empty</p>
            <p className="max-w-55 text-xs text-muted-foreground">
              Send an email to{" "}
              <span className="font-mono text-foreground">{email}</span>{" "}
              and it will appear here in seconds.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {messages.map(msg => {
              const ds = deleteState[msg.id]
              return (
                <div
                  key={msg.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !ds && onSelect(msg.id)}
                  onKeyDown={e => !ds && e.key === "Enter" && onSelect(msg.id)}
                  className={cn(
                    "group flex w-full items-start gap-3 px-4 py-3 cursor-pointer transition-colors",
                    ds === "deleted" ? "bg-emerald-500/10" : "hover:bg-muted/60",
                    selected === msg.id && !ds && "bg-muted",
                    !msg.read && !ds && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    avatarColor(msg.from)
                  )}>
                    {msg.from[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {!msg.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <span className={cn("truncate text-sm", !msg.read ? "font-semibold" : "font-medium")}>
                          {msg.from}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{msg.timeAgo}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{msg.subject || "(no subject)"}</p>
                  </div>
                  {/* Copy code button — for Facebook & Instagram messages with a code in the subject */}
                  {getCode(msg) && (
                    <button
                      onClick={e => handleCopy(e, msg)}
                      title={`Copy code ${getCode(msg)}`}
                      className={cn(
                        "shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
                        copiedId === msg.id
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      )}
                    >
                      {copiedId === msg.id
                        ? <><Check className="h-3 w-3" /> Copied</>
                        : <><Copy className="h-3 w-3" /> {getCode(msg)}</>
                      }
                    </button>
                  )}
                  {/* Delete button — shows spinner while deleting, green check when done */}
                  <button
                    onClick={e => handleDelete(e, msg.id)}
                    disabled={!!ds}
                    className={cn(
                      "ml-1 shrink-0 p-0.5 rounded transition-all",
                      !ds && "opacity-0 group-hover:opacity-100",
                      ds === "deleted" && "opacity-100 text-emerald-500"
                    )}
                  >
                    {ds === "deleting" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : ds === "deleted" ? (
                      <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
