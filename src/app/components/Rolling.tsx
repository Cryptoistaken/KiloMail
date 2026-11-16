/**
 * Digits that roll into place when they change, like an odometer - no animation library, because
 * a changed digit is keyed by its own character, so React remounts it and the CSS animation replays.
 * Unchanged digits keep their key and their position, and only the widest window moves.
 */
export function Rolling({ text }: { text: string }) {
  return (
    <span className="inline-flex overflow-hidden align-bottom">
      {[...text].map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          className="inline-block animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
        >
          {ch}
        </span>
      ))}
    </span>
  )
}

/** "15s ago" with the number rolling: the digits move, the "s ago" sits still. */
export function RollingAgo({ text }: { text: string }) {
  const m = /^(\d+)(.*)$/.exec(text)
  if (!m) return <>{text}</>
  return (
    <>
      <Rolling text={m[1]} />
      {m[2]}
    </>
  )
}
