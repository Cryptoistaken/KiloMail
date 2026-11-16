import { useState, useEffect, useRef } from 'react'
import { Trash2, X, Mail, ChevronLeft, ChevronDown, AlignLeft, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { SenderAvatar } from '@/app/components/SenderAvatar'
import { cn } from '@/lib/utils'
import { addressOnly, senderAddress, senderDisplayName, senderLabel, senderFull } from '@/lib/sender'
import type { MessageFull } from '@/lib/types'

interface MessageViewProps {
  message: MessageFull | null
  loading: boolean
  /** The inbox being read, so the To line can say "me" like a mail client does. */
  inboxEmail: string
  onClose: () => void
  onDelete: () => void
}

function linkify(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+)/g
  return text.replace(urlRegex, (url) => {
    const href = url.replace(/[.,!?;:)]+$/, '')
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${href}</a>`
  })
}

function addTargetBlank(html: string): string {
  return html.replace(/<a\s(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ')
}

/** "3 minutes ago" - the relative half of "9:30 PM (3 minutes ago)". */
function agoLabel(when: number): string {
  const mins = Math.round((Date.now() - when) / 60_000)
  if (!Number.isFinite(mins)) return ''
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** The sender's own Date header when there is a usable one, otherwise when it arrived. */
function sentAt(message: MessageFull): number {
  const header = message.date ? Date.parse(message.date) : NaN
  return Number.isFinite(header) ? header : new Date(message.receivedAt).getTime()
}

function clockTime(ms: number): string {
  const d = new Date(ms)
  const sameDay = d.toDateString() === new Date().toDateString()
  return d.toLocaleString(undefined, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function MessageView({ message, loading, inboxEmail, onClose, onDelete }: MessageViewProps) {
  const [view, setView] = useState<'html' | 'text'>('html')
  const [showDetails, setShowDetails] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => { setView('html'); setShowDetails(false) }, [message?.id])

  useEffect(() => {
    if (message?.html && iframeRef.current && view === 'html') {
      const doc = iframeRef.current.contentDocument
      if (!doc) return
      doc.open()
      doc.write(`<!doctype html><html><head><style>
        html,body{margin:0;padding:12px 16px;font-family:sans-serif;font-size:14px;
          background:#fff;color:#111;word-break:break-word;line-height:1.6}
        a{color:#2563eb}img{max-width:100%}
      </style></head><body>${addTargetBlank(message.html)}</body></html>`)
      doc.close()
    }
  }, [message?.html, message?.id, view])

  if (loading) return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-3/4" />
      <Separator />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )

  if (!message) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
          <Mail className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">Select a message to read</p>
      </div>
    </div>
  )

  const name = senderDisplayName(message)
  const fromAddress = senderAddress(message.from)
  const sent = sentAt(message)

  // "to me" when the mail was addressed to the inbox being read, like a mail client shows it.
  const toAddress = message.to ? addressOnly(message.to) : ''
  const recipient = !toAddress
    ? inboxEmail
    : toAddress.toLowerCase() === inboxEmail.toLowerCase() ? 'me' : toAddress

  const dateValue = message.date && Number.isNaN(Date.parse(message.date))
    ? message.date
    : new Date(sent).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  // Only worth showing Reply-To when it is not simply From again.
  const replyToRow = message.replyTo && addressOnly(message.replyTo).toLowerCase() !== fromAddress.toLowerCase()
    ? [['Reply-To', message.replyTo] as const]
    : []

  const details: ReadonlyArray<readonly [string, string]> = [
    ['From', senderFull(message)],
    ...replyToRow,
    ['To', message.to || inboxEmail],
    ['Date', dateValue],
    ['Subject', message.subject || '(no subject)'],
    ...(message.mailedBy ? [['Mailed-by', message.mailedBy] as const] : []),
    ...(message.signedBy ? [['Signed-by', message.signedBy] as const] : []),
    ...(message.encryption ? [['Security', message.encryption] as const] : []),
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 md:hidden" onClick={onClose}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="truncate text-base font-medium">{message.subject || '(no subject)'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={onDelete} aria-label="Delete message">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hidden md:flex" onClick={onClose} aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <SenderAvatar from={message.from} fromName={message.fromName} className="h-9 w-9 text-[11px]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm" title={fromAddress}>
                {name
                  ? <>
                      <span className="font-semibold">{name}</span>{' '}
                      <span className="text-muted-foreground">&lt;{fromAddress}&gt;</span>
                    </>
                  : <span className="font-semibold">{senderLabel(message)}</span>}
              </p>
              <p className="shrink-0 text-[11px] text-muted-foreground">
                {clockTime(sent)}
                <span className="hidden sm:inline"> ({agoLabel(sent)})</span>
              </p>
            </div>

            <button
              onClick={() => setShowDetails(v => !v)}
              aria-expanded={showDetails}
              title={showDetails ? 'Hide details' : 'Show details'}
              className="-ml-1 mt-0.5 flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              to {recipient}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showDetails && 'rotate-180')} />
            </button>

            {showDetails && (
              <div className="mt-2 grid grid-cols-[74px_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/30 p-2.5">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <span className="text-right text-[11px] text-muted-foreground">{k}</span>
                    <span className="break-words font-mono text-[11px] leading-relaxed">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {message.html && message.text && (
          <div className="mt-2.5 flex items-center gap-1">
            <button
              onClick={() => setView('html')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                view === 'html'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Code2 className="h-3 w-3" /> HTML
            </button>
            <button
              onClick={() => setView('text')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                view === 'text'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <AlignLeft className="h-3 w-3" /> Plain text
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {message.html && view === 'html'
          ? <iframe
              ref={iframeRef}
              // allow-popups lets email links open a tab; allow-popups-to-escape-sandbox stops the
              // opened tab from inheriting this sandbox, which left it script-less and cookie-less
              // (blank / broken page) - copy-pasting the same URL into a fresh tab worked because
              // that tab has no sandbox at all.
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              className="h-full w-full border-0"
              title="Email body"
            />
          : <pre className="p-5 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground"
               dangerouslySetInnerHTML={{ __html: linkify(message.text || '(empty body)') }} />

        }
      </div>
    </div>
  )
}
