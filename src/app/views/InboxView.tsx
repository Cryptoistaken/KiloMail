import { useState } from 'react'
import { WifiOff, Wifi, Inbox, RefreshCw, Copy, Check, Link2, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MessageSkeleton } from '@/app/components/MessageSkeleton'
import { SenderAvatar } from '@/app/components/SenderAvatar'
import { senderLabel, senderSecondary } from '@/lib/sender'
import { subjectCode } from '@/lib/codes'
import { agoLabel } from '@/lib/ago'
import { RollingAgo } from '@/app/components/Rolling'
import { useNow } from '@/hooks/useNow'
import type { MessageMeta } from '@/lib/types'

interface InboxViewProps {
  email: string
  messages: MessageMeta[]
  loading: boolean
  connected: boolean
  selected: string | null
  onSelect: (id: string) => void
  onRefresh: () => void
  refreshing: boolean
  bodyCodes: Record<string, string>
  /** The one link a verification mail exists for, when it carries no code. */
  bodyLinks: Record<string, string>
  /** New-mail sound: on by default, toggled from the list header. */
  sound: boolean
  onToggleSound: () => void
}

export function InboxView({
  email, messages, loading, connected,
  selected, onSelect, onRefresh, refreshing, bodyCodes, bodyLinks,
  sound, onToggleSound,
}: InboxViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  // Mail younger than a minute is counted out loud, second by second.
  const fresh = messages.some(m => Date.now() - (m.arrivedMs ?? Date.now()) < 60_000)
  const now = useNow(fresh)

  /** The API's own "5m ago" is the fallback when a provider gave us nothing to anchor to. */
  function arrival(msg: MessageMeta): string {
    return msg.arrivedMs === undefined ? msg.timeAgo : agoLabel(msg.arrivedMs, now)
  }

  function getCode(msg: MessageMeta): string | null {
    return subjectCode(msg.subject) ?? bodyCodes[msg.id] ?? null
  }

  /** One chip per row: the code when the mail has one, otherwise the link it exists for. */
  function getLink(msg: MessageMeta): string | null {
    return getCode(msg) ? null : (bodyLinks[msg.id] ?? null)
  }

  /** Chip text: at most ten characters, so no address or code can stretch the row. */
  const shortLink = (msg: MessageMeta) => (getLink(msg) ?? '').replace(/^https?:\/\//i, '').slice(0, 10)
  const shortCode = (msg: MessageMeta) => (getCode(msg) ?? '').slice(0, 10)

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
            {messages.map(msg => (
                <div
                  key={msg.id}
                  role="button"
                  tabIndex={0}
                  data-buzz="medium"
                  onClick={() => onSelect(msg.id)}
                  onKeyDown={e => e.key === 'Enter' && onSelect(msg.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/60',
                    selected === msg.id && 'bg-muted',
                    !msg.read && 'bg-primary/5'
                  )}
                >
                  <SenderAvatar from={msg.from} fromName={msg.fromName} className="mt-0.5 h-8 w-8 text-xs" />
                  <div className="min-w-[6rem] flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {!msg.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <span
                          title={senderSecondary(msg) ?? undefined}
                          className={cn('truncate text-sm', !msg.read ? 'font-semibold' : 'font-medium')}
                        >
                          {senderLabel(msg)}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground"><RollingAgo text={arrival(msg)} /></span>
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
                        : <><Copy className="h-3 w-3" /> {shortCode(msg)}</>
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
                        : <><Link2 className="h-3 w-3" /> {shortLink(msg)}</>
                      }
                    </button>
                  )}
                </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
