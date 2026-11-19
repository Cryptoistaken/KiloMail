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

/**
 * False means the browser refused the buzz. Chrome blocks vibration until the page has been
 * tapped once, so a press made before that is refused and has to be replayed afterwards.
 * No vibrator at all (desktop) is not a refusal - there is nothing to retry.
 */
export function buzz(weight: Weight = 'light'): boolean {
  try {
    if (typeof navigator.vibrate !== 'function') return true
    return navigator.vibrate(PATTERNS[weight])
  } catch {
    return true
  }
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
  let refused: Weight | null = null

  const onDown = (e: PointerEvent) => {
    const target = e.target as Element | null
    if (!target?.closest?.(PRESSABLE)) return
    const now = performance.now()
    if (now - last < 90) return // one press, one buzz - never two from nested elements
    last = now
    // The nearest weighted ancestor owns the weight: a dock icon stays `medium` even though the
    // tooltip trigger button inside it is what the finger actually landed on.
    const weight = (target.closest('[data-buzz]')?.getAttribute('data-buzz') as Weight | null) ?? 'light'
    refused = buzz(weight) ? null : weight
  }

  // The first press of a page is refused at pointerdown, before Chrome counts the gesture as a
  // tap; by the click that ends it the activation is there, so replay that one buzz.
  const onClick = () => {
    if (!refused) return
    const weight = refused
    refused = null
    buzz(weight)
  }

  document.addEventListener('pointerdown', onDown, { capture: true, passive: true })
  document.addEventListener('click', onClick, { capture: true, passive: true })
  return () => {
    document.removeEventListener('pointerdown', onDown, { capture: true })
    document.removeEventListener('click', onClick, { capture: true })
  }
}
