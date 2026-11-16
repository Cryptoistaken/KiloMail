/**
 * The little touch that answers a finger. Phones buzz; desktop Chrome has no vibrator and quietly
 * ignores it, so the guard is all the platform detection this needs.
 */
export function buzz(pattern: number | number[] = 8): void {
  try { navigator.vibrate?.(pattern) } catch {}
}

/** Anything a finger is meant to press. */
const PRESSABLE = 'button, a, [role="button"], label, input[type="checkbox"], input[type="radio"], summary'

/**
 * One listener instead of wiring every button: a press buzzes, and (while the sound setting is on)
 * ticks. `data-silent` on an element skips its tick sound - the new-mail chime has its own button.
 */
export function installTapFeedback(soundEnabled: () => boolean, onTap: () => void): () => void {
  const onDown = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null
    if (!el || el.hasAttribute('data-silent')) return
    buzz()
    if (soundEnabled()) onTap()
  }
  document.addEventListener('pointerdown', onDown, { capture: true, passive: true })
  return () => document.removeEventListener('pointerdown', onDown, { capture: true })
}
