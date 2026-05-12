import { useState } from 'react'
import { History, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadHistory, clearHistory, MAX_HISTORY, type HistoryEntry } from '@/lib/history'

interface HistoryViewProps {
  onSwitch: (email: string) => void
  onClear: () => void
}

export function HistoryView({ onSwitch, onClear }: HistoryViewProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory)

  const handleClear = () => {
    clearHistory()
    setEntries([])
    onClear()
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Email History</p>
          <p className="text-xs text-muted-foreground">{entries.length} of {MAX_HISTORY} saved</p>
        </div>
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
                {(entry.messageCount ?? 0) > 0 ? (
                  <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary group-hover:bg-primary/20 transition-colors">
                    <Mail className="h-2.5 w-2.5" />
                    {entry.messageCount}
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
