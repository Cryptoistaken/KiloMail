import { useState, useEffect, useRef } from 'react'
import { Trash2, X, Mail, ChevronLeft, AlignLeft, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { MessageFull } from '@/lib/types'

interface MessageViewProps {
  message: MessageFull | null
  loading: boolean
  onClose: () => void
  onDelete: () => void
}

export function MessageView({ message, loading, onClose, onDelete }: MessageViewProps) {
  const [view, setView] = useState<'html' | 'text'>('html')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => { setView('html') }, [message?.id])

  useEffect(() => {
    if (message?.html && iframeRef.current && view === 'html') {
      const doc = iframeRef.current.contentDocument
      if (!doc) return
      doc.open()
      doc.write(`<!doctype html><html><head><style>
        html,body{margin:0;padding:12px 16px;font-family:sans-serif;font-size:14px;
          background:#fff;color:#111;word-break:break-word;line-height:1.6}
        a{color:#2563eb}img{max-width:100%}
      </style></head><body>${message.html}</body></html>`)
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

  const initials = message.from.slice(0, 2).toUpperCase()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 md:hidden" onClick={onClose}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{message.subject || '(no subject)'}</p>
              <p className="truncate text-xs text-muted-foreground">{message.from}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <span className="mr-2 hidden text-[11px] text-muted-foreground sm:block">
              {new Date(message.receivedAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hidden md:flex" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
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
              sandbox="allow-same-origin"
              className="h-full w-full border-0"
              title="Email body"
            />
          : <pre className="p-5 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {message.text || '(empty body)'}
            </pre>
        }
      </div>
    </div>
  )
}
