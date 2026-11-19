import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light' | '3d'

export function useTheme(): Theme {
  const getTheme = (): Theme => {
    const c = document.documentElement.classList
    if (c.contains('theme3d')) return '3d'
    return c.contains('dark') ? 'dark' : 'light'
  }

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
