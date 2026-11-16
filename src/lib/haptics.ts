/**
 * The touch that answers a finger - weighted, not uniform: a press, a change, or something that
 * cannot be undone should not feel the same. Phones buzz; desktop Chrome has no vibrator and
 * quietly ignores it, so the guard is all the platform detection this needs.
 */
export type Weight = 'light' | 'medium' | 'heavy'

const PATTERNS: Record<Weight, number | number[]> = {
  light: 8,             // an ordinary press: copy, refresh, a tab, the caret
  medium: 22,           // something actually changed: another inbox, a new address, a mail opened
  heavy: [16, 34, 26],  // gone for good: delete, clear all
}

export function buzz(weight: Weight = 'light'): void {
  try { navigator.vibrate?.(PATTERNS[weight]) } catch {}
}

/** Anything a finger is meant to press. */
const PRESSABLE = '[data-buzz], button, a, [role="button"], label, input[type="checkbox"], input[type="radio"], summary'

/**
 * One listener instead of wiring every button. The weight comes from the nearest `data-buzz`, so a
 * chip inside a mail row still feels like the small button it is, and anything that is not a
 * control - plain text, the mail body, scrolling - never buzzes at all.
 */
export function installPressFeedback(): () => void {
  let last = 0
  const onDown = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null
    if (!el) return
    const now = performance.now()
    if (now - last < 90) return // one press, one buzz - never two from nested elements
    last = now
    buzz((el.getAttribute('data-buzz') as Weight | null) ?? 'light')
  }
  document.addEventListener('pointerdown', onDown, { capture: true, passive: true })
  return () => document.removeEventListener('pointerdown', onDown, { capture: true })
}
