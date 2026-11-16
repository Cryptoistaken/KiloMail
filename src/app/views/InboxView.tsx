import { useState } from 'react'
import { Trash2, WifiOff, Wifi, Inbox, RefreshCw, Loader2, CheckCheck, Copy, Check, Link2, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MessageSkeleton } from '@/app/components/MessageSkeleton'
import { SenderAvatar } from '@/app/components/SenderAvatar'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { senderFull, senderLabel, senderSecondary } from '@/lib/sender'
import { subjectCode } from '@/lib/codes'
import type { MessageMeta } from '@/lib/types'

interface InboxViewProps {
  email: string
  messages: MessageMeta[]
  loading: boolean
  connected: boolean
  selected: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onRefresh: () => void
  refreshing: boolean
  bodyCodes: Record<string, string>
  /** The one link a verification mail exists for, when it carries no code. */
  bodyLinks: Record<string, string>
  canDelete: boolean
  /** New-mail sound: on by default, toggled from the list header. */
  sound: boolean
  onToggleSound: () => void
}

export function InboxView({
  email, messages, loading, connected,
  selected, onSelect, onDelete, onRefresh, refreshing, bodyCodes, bodyLinks, canDelete,
  sound, onToggleSound,
}: InboxViewProps) {
  const [deleteState, setDeleteState] = useState<Record<string, 'deleting' | 'deleted'>>({})
  const [confirmMsg, setConfirmMsg] = useState<MessageMeta | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  function getCode(msg: MessageMeta): string | null {
    return subjectCode(msg.subject) ?? bodyCodes[msg.id] ?? null
  }

  /** One chip per row: the code when the mail has one, otherwise the link it exists for. */
  function getLink(msg: MessageMeta): string | null {
    return getCode(msg) ? null : (bodyLinks[msg.id] ?? null)
  }

  const handleCopy = async (e: React.MouseEvent, msg: MessageMeta) => {
    e.stopPropagation()
    const code = getCode(msg)
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopiedId(msg.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyLink = async (e: React.MouseEvent, msg: MessageMeta) => {
    e.stopPropagation()
    const link = getLink(msg)
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopiedLinkId(msg.id)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  const handleDelete = async (id: string) => {
    setDeleteState(s => ({ ...s, [id]: 'deleting' }))
    try {
      await onDelete(id)
      setDeleteState(s => ({ ...s, [id]: 'deleted' }))
      setTimeout(() => setDeleteState(s => { const n = { ...s }; delete n[id]; return n }), 800)
    } catch {
      setDeleteState(s => { const n = { ...s }; delete n[id]; return n })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1 text-xs',
            connected ? 'text-emerald-500' : 'text-zinc-400'
          )}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{connected ? 'live' : 'reconnecting…'}</span>
          </div>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={onToggleSound}
            aria-pressed={sound}
            aria-label={sound ? 'Mute new-mail sound' : 'Unmute new-mail sound'}
            title={sound ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
          >
            {sound
              ? <Volume2 className="h-3.5 w-3.5" />
              : <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={loading || refreshing} aria-label="Refresh inbox">
            <RefreshCw className={cn('h-3.5 w-3.5', (loading || refreshing) && 'animate-spin')} />
          </Button>
        </div>
      </div>

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
              Send an email to{' '}
              <span className="font-mono text-foreground">{email}</span>{' '}
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
                  onKeyDown={e => !ds && e.key === 'Enter' && onSelect(msg.id)}
                  className={cn(
                    'group flex w-full items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                    ds === 'deleted' ? 'bg-emerald-500/10' : 'hover:bg-muted/60',
                    selected === msg.id && !ds && 'bg-muted',
                    !msg.read && !ds && 'bg-primary/5'
                  )}
                >
                  <SenderAvatar from={msg.from} fromName={msg.fromName} className="mt-0.5 h-8 w-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {!msg.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <span
                          title={senderSecondary(msg) ?? undefined}
                          className={cn('truncate text-sm', !msg.read ? 'font-semibold' : 'font-medium')}
                        >
                          {senderFull(msg)}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{msg.timeAgo}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{msg.subject || '(no subject)'}</p>
                  </div>
                  {getCode(msg) && (
                    <button
                      onClick={e => handleCopy(e, msg)}
                      title={`Copy code ${getCode(msg)}`}
                      className={cn(
                        'shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                        copiedId === msg.id
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      )}
                    >
                      {copiedId === msg.id
                        ? <><Check className="h-3 w-3" /> Copied</>
                        : <><Copy className="h-3 w-3" /> {getCode(msg)}</>
                      }
                    </button>
                  )}
                  {getLink(msg) && (
                    <button
                      onClick={e => handleCopyLink(e, msg)}
                      title={`Copy link ${getLink(msg)}`}
                      className={cn(
                        'shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                        copiedLinkId === msg.id
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      )}
                    >
                      {copiedLinkId === msg.id
                        ? <><Check className="h-3 w-3" /> Copied</>
                        : <><Link2 className="h-3 w-3" /> Link</>
                      }
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmMsg(msg) }}
                      disabled={!!ds}
                      className={cn(
                        'ml-1 shrink-0 p-0.5 rounded transition-all',
                        !ds && 'opacity-0 group-hover:opacity-100',
                        ds === 'deleted' && 'opacity-100 text-emerald-500'
                      )}
                    >
                      {ds === 'deleting' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : ds === 'deleted' ? (
                        <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmMsg && (
        <ConfirmDialog
          title="Delete this message?"
          body={`"${confirmMsg.subject || '(no subject)'}" from ${senderLabel(confirmMsg)} is removed for good.`}
          confirmLabel="Delete"
          onConfirm={() => { const id = confirmMsg.id; setConfirmMsg(null); void handleDelete(id) }}
          onClose={() => setConfirmMsg(null)}
        />
      )}
    </div>
  )
}
