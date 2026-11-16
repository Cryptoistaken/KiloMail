// New-mail chime, synthesised with the Web Audio API so there is no sound file to ship.
// Browsers keep audio muted until the user touches the page, so App calls unlockAudio()
// on the first pointer event - see the effect there.
const KEY = 'kilomail_sound'

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== '0' } catch { return true }
}

export function setSoundOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch {}
}

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

/** Call once from a real user gesture so the browser permits later playback. */
export function unlockAudio(): void {
  audio()
}

/** Two soft notes (A5 -> D6), quick decay. ~360ms. */
export function playChime(): void {  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime + 0.01
  for (const [freq, offset] of [[880, 0], [1174.66, 0.085]] as const) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const at = t0 + offset
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(0.65, at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.30)
    osc.connect(gain).connect(ac.destination)
    osc.start(at)
    osc.stop(at + 0.35)
  }
}

/**
 * A quiet tick for a button press - deliberately short and dull so it can never be mistaken for the
 * new-mail chime, which is the sound worth recognising. ~45ms.
 */
export function playTap(): void {
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(1400, t0)
  osc.frequency.exponentialRampToValueAtTime(760, t0 + 0.04)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.linearRampToValueAtTime(0.12, t0 + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + 0.06)
}

