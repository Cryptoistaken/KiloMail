import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'icon' | 'logo'
  className?: string
  alt?: string
}

// Pure black on light / pure white on dark — not the theme's off-black/off-white,
// so the mark stays crisp. `currentColor` does the theme switch.
const TONE = 'text-black dark:text-white'

/** Bazel mark, drawn inline so it follows the theme. */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" className={className} focusable="false">
      {/* Solid tile behind the mark, so the diamond's empty corners are filled. Full-bleed, so the
          mark keeps its exact size and position. */}
      <rect width="128" height="128" className="fill-white dark:fill-black" />
      <path
        fill="currentColor"
        d="M31.748.46L.208 32l31.036 31.035l.504.504L63.288 32Zm64.504 0L64.712 32l31.54 31.54l.504-.505L127.79 32ZM64 32.714L32.46 64.252L64 95.792l31.54-31.54Zm-64 .504v30.826l31.244 31.244V64.461Zm128 0L96.965 64.252l-.21.209v30.826L128 64.043ZM32.252 65.469v30.826l31.244 31.244V96.713Zm63.496 0L64.504 96.713v30.826l31.244-31.244Z"
      />
    </svg>
  )
}

export function Logo({ variant = 'icon', className, alt = 'KiloMail' }: LogoProps) {
  if (variant === 'logo') {
    return (
      <span
        role="img"
        aria-label={alt}
        className={cn('inline-flex items-center gap-2', TONE, className)}
      >
        <Mark className="h-6 w-6 shrink-0" />
        <span className="text-base font-semibold tracking-tight">KiloMail</span>
      </span>
    )
  }

  return (
    <span role="img" aria-label={alt} className={cn('inline-flex', TONE, className)}>
      <Mark className="h-full w-full" />
    </span>
  )
}
