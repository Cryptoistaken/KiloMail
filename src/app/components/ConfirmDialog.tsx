import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

/** One question before something is gone for good. Portalled to the body so no panel can clip it. */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        className="relative z-10 w-full max-w-xs rounded-2xl border border-border bg-background p-5 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-sm font-semibold">{title}</h2>
            <p className="mt-1 break-words text-xs text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button autoFocus variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
