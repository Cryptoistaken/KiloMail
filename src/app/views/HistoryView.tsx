import { useEffect, useMemo, useRef, useState } from 'react'
import { History, Mail, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SenderAvatar } from '@/app/components/SenderAvatar'
import { senderFull } from '@/lib/sender'
import { getProvider } from '@/providers/registry'
import { loadHistory, updateMessageCount, clearHistory, MAX_HISTORY, type HistoryEntry } from '@/lib/history'
import type { MessageMeta } from '@/lib/types'

interface HistoryViewProps {
  /** Switch to an address; pass a message id to open that exact mail once the inbox loads. */
  onSwitch: (email: string, openId?: string) => void
  onClear: () => void
}

/** How many inboxes we fetch at once when refreshing/searching the whole history. */
const CHUNK = 4

export function HistoryView({ onSwitch, onClear }: HistoryViewProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory)
  const [inboxes, setInboxes] = useState<Record<string, MessageMeta[]>>({})
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const runRef = useRef(0)

  /** Re-fetch every saved inbox so the counts are real and search can look inside the mail. */
  const reload = async (list: HistoryEntry[]) => {
    if (!list.length) return
    const run = ++runRef.current
    setBusy(true)
    const next: Record<string, MessageMeta[]> = {}
    for (let i = 0; i < list.length; i += CHUNK) {
      await Promise.all(list.slice(i, i + CHUNK).map(async (e) => {
        try {
          const msgs = await getProvider(e.email).fetchInbox(e.email)
          next[e.email] = msgs
          updateMessageCount(e.email, msgs.length)
        } catch { next[e.email] = [] }
      }))
      if (run !== runRef.current) return // a newer refresh started
      setInboxes({ ...next })
    }
    if (run === runRef.current) {
      setBusy(false)
      setEntries(loadHistory())
    }
  }

  useEffect(() => { void reload(loadHistory()) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClear = () => {
    clearHistory()
    setEntries([])
    setInboxes({})
    onClear()
  }

  const q = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (!q) return []
    return entries
      .map(entry => ({
        entry,
        addressHit: entry.email.toLowerCase().includes(q),
        msgs: (inboxes[entry.email] ?? []).filter(m =>
          (m.subject ?? '').toLowerCase().includes(q) ||
          (m.from ?? '').toLowerCase().includes(q) ||
          (m.fromName ?? '').toLowerCase().includes(q)
        ),
      }))
      .filter(r => r.addressHit || r.msgs.length > 0)
  }, [q, entries, inboxes])

  const countFor = (email: string) =>
    inboxes[email] ? inboxes[email].length : (entries.find(e => e.email === email)?.messageCount ?? 0)

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Email History</p>
          <p className="text-xs text-muted-foreground">
            {entries.length} of {MAX_HISTORY} saved{busy ? ' · checking…' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {entries.length > 0 && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              aria-label="Re-check all inboxes" title="Re-check all inboxes"
              onClick={() => { setEntries(loadHistory()); void reload(loadHistory()) }}
              disabled={busy}
            >
              <RefreshCw className={busy ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            </Button>
          )}
          {entries.length > 0 && (
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleClear}
            >
              Clear all
            </Button>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/50">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search addresses and mail…"
              className="min-w-0 flex-1 bg-transparent text-xs focus:outline-none"
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery('')} className="shrink-0 rounded p-0.5 hover:bg-muted">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
              <History className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No history yet</p>
            <p className="max-w-[200px] text-xs text-muted-foreground">
              Previously used addresses will appear here.
            </p>
          </div>
        ) : q ? (
          results.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              {busy ? 'Checking inboxes…' : `No matches for “${query.trim()}”`}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {results.map(({ entry, msgs }) => (
                <div key={entry.email} className="flex flex-col">
                  <button
                    onClick={() => onSwitch(entry.email)}
                    className="group flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{entry.email}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {countFor(entry.email)}
                    </span>
                  </button>
                  {msgs.map(m => (
                    <button
                      key={m.id}
                      onClick={() => onSwitch(entry.email, m.id)}
                      className="flex w-full items-start gap-2.5 bg-muted/20 py-2 pl-6 pr-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <SenderAvatar from={m.from} fromName={m.fromName} className="mt-0.5 h-5 w-5 text-[9px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-foreground">{senderFull(m)}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{m.subject || '(no subject)'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {entries.map(entry => (
              <button
                key={entry.email}
                onClick={() => onSwitch(entry.email)}
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-foreground">{entry.email}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(entry.usedAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                {countFor(entry.email) > 0 ? (
                  <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors group-hover:bg-primary/20">
                    <Mail className="h-2.5 w-2.5" />
                    {countFor(entry.email)}
                  </span>
                ) : (
                  <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    0
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
