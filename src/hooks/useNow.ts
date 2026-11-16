import { useEffect, useState } from 'react'

/**
 * A clock for the "9s ago" labels. It ticks every second only while something is under a minute
 * old (a second-by-second count is only interesting right after mail lands), then every 30s.
 */
export function useNow(fast: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000)
    return () => clearInterval(id)
  }, [fast])
  return now
}
