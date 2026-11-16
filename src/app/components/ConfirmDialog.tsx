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

/**
 * One question before something is gone for good. Portalled to the body so no panel can clip it:
 * a warning roundel, the question and what it affects, then the two answers on a footer bar.
 */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-in items-center justify-center fade-in-0 p-4 duration-150"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative z-10 w-full max-w-sm animate-in overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl fade-in-0 zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5 px-5 pt-5 pb-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-sm font-semibold leading-5 text-foreground">
              {title}
            </h2>
            <p id="confirm-body" className="mt-1.5 text-xs leading-relaxed break-words text-muted-foreground">
              {body}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-4 py-3">
          <Button
            autoFocus
            variant="ghost"
            size="sm"
            className="h-8 min-w-[5rem] text-xs"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 min-w-[5rem] text-xs"
            data-buzz="heavy"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
