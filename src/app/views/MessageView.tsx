import { useState, useEffect, useRef } from 'react'
import { Trash2, X, Mail, ChevronLeft, ChevronDown, AlignLeft, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { SenderAvatar } from '@/app/components/SenderAvatar'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { RollingAgo } from '@/app/components/Rolling'
import { addressOnly, senderAddress, senderDisplayName, senderLabel, senderFull } from '@/lib/sender'
import { agoLabel } from '@/lib/ago'
import { useNow } from '@/hooks/useNow'
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

/** A details-row value: for the sender, the name picked out and the address dimmed, as in the header. */
function DetailValue({ label, value }: { label: string; value: string }) {
  const m = /^(.*?)\s*<([^>]+)>$/.exec(value)
  if (!m || (label !== 'From' && label !== 'Reply-To')) return <>{value}</>
  return (
    <>
      <span className="font-semibold">{m[1]}</span>{' '}
      <span className="text-muted-foreground">{`<${m[2]}>`}</span>
    </>
  )
}

export function MessageView({ message, loading, inboxEmail, onClose, onDelete }: MessageViewProps) {
  const [view, setView] = useState<'html' | 'text'>('html')
  const [showDetails, setShowDetails] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const detailsRef = useRef<HTMLSpanElement>(null)

  useEffect(() => { setView('html'); setShowDetails(false) }, [message?.id])

  // The details float over the message, so close them the way a popup should: click away or Esc.
  useEffect(() => {
    if (!showDetails) return
    const onDown = (e: MouseEvent) => {
      if (!detailsRef.current?.contains(e.target as Node)) setShowDetails(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDetails(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showDetails])

  useEffect(() => {
    if (message?.html && iframeRef.current && view === 'html') {
      const doc = iframeRef.current.contentDocument
      if (!doc) return
      doc.open()
      doc.write(`<!doctype html><html><head><style>
        html,body{margin:0;padding:12px 16px;font-family:sans-serif;font-size:14px;
          background:#fff;color:#111;word-break:break-word;line-height:1.6;overflow-x:hidden}
        a{color:#2563eb}
        img{max-width:100%!important;height:auto!important}
        table{max-width:100%!important}
        table[width],td[width]{width:auto!important}
      </style></head><body>${addTargetBlank(message.html)}</body></html>`)
      doc.close()

      // Fit to width, the way a mail client handles a fixed-width mail: constrain the tables and
      // images above, and if a wide design still overflows, scale the whole body down to fit.
      const inner = doc.defaultView
      const fit = () => {
        const root = doc.documentElement
        const body = doc.body
        if (!root || !body) return
        body.style.transform = ''
        body.style.width = ''
        const have = root.clientWidth
        const need = root.scrollWidth
        if (have > 0 && need > have + 2) {
          const scale = have / need
          body.style.transformOrigin = 'top left'
          body.style.transform = `scale(${scale})`
          body.style.width = `${100 / scale}%`
        }
      }
      fit()
      inner?.addEventListener('load', fit)
      const late = setTimeout(fit, 300) // images can land after load and change the width

      // A click in the mail itself cannot reach the page (that is how iframes work), but we wrote
      // this document, so we can listen inside it and close the details there too.
      const onDown = () => setShowDetails(false)
      doc.addEventListener('mousedown', onDown)

      return () => {
        clearTimeout(late)
        inner?.removeEventListener('load', fit)
        doc.removeEventListener('mousedown', onDown)
      }
    }
  }, [message?.html, message?.id, view])

  // A mail younger than a minute is counted out loud, second by second. This has to sit with the
  // other hooks, above the early returns.
  const now = useNow(!!message?.arrivedMs && Date.now() - message.arrivedMs < 60_000)

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
  /** The anchored arrival is what the ticking label counts from; the header is the fallback. */
  const arrived = message.arrivedMs ?? sent

  // Always "to me": the mail is sitting in the inbox you are reading, and the true To header is
  // in the details rows. A mail client says "to me" for exactly the same reason.

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
      <div className="relative z-20 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 md:hidden" onClick={onClose}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="truncate text-base font-medium">{message.subject || '(no subject)'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {message.html && message.text && (
              <div className="mr-1 flex items-center gap-0.5 rounded-md border border-border p-0.5">
                <button
                  onClick={() => setView('html')}
                  aria-label="HTML view" title="HTML"
                  aria-pressed={view === 'html'}
                  className={cn('grid h-6 w-6 place-items-center rounded',
                    view === 'html' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                >
                  <Code2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setView('text')}
                  aria-label="Plain text view" title="Plain text"
                  aria-pressed={view === 'text'}
                  className={cn('grid h-6 w-6 place-items-center rounded',
                    view === 'text' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDelete(true)} aria-label="Delete message">
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
                <span className="hidden sm:inline"> (<RollingAgo text={agoLabel(arrived, now, 'long')} />)</span>
              </p>
            </div>

            <span ref={detailsRef} className="relative -ml-1 mt-0.5 inline-flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">to me</span>
              <button
                onClick={() => setShowDetails(v => !v)}
                aria-expanded={showDetails}
                aria-label="Message details"
                title={showDetails ? 'Hide details' : 'Show details'}
                className="grid h-4 w-4 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronDown className="h-3 w-3" />
              </button>

              {showDetails && (
                <div className="absolute top-full left-0 z-30 mt-2 grid w-max max-w-[min(26rem,calc(100vw-5rem))] grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-background p-3 shadow-2xl">
                  {details.map(([k, v]) => (
                    <div key={k} className="contents">
                      <span className="text-right text-[11px] text-muted-foreground">{k}:</span>
                      <span className="min-w-0 break-words font-mono text-[11px] leading-relaxed">
                        <DetailValue label={k} value={v} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </span>
          </div>
        </div>

        {message.html && message.text && view === 'text' && (
          <p className="mt-2 text-[11px] text-muted-foreground">Showing the plain-text version</p>
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

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this message?"
          body={`"${message.subject || '(no subject)'}" from ${senderLabel(message)} is removed for good.`}
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDelete() }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
