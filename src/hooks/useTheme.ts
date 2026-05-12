import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme(): Theme {
  const getTheme = (): Theme =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'

  const [theme, setTheme] = useState<Theme>(getTheme)

  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(getTheme()))
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => obs.disconnect()
  }, [])

  return theme
}
