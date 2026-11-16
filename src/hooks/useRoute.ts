import { useState, useEffect } from 'react'
import { hasVisitedBefore } from '@/lib/types'

/** kilomail.tech/<email> is the shareable form of an inbox, so an @ in the path means "this inbox". */
export function isEmailPath(path: string): boolean {
  return /^[^/@\s]+@[^/@\s]+\.[^/@\s]+$/.test(path)
}

/** Links from the old #/#/inbox days still land right: the hash is turned into a real path once. */
function current(): string {
  const hash = window.location.hash.replace(/^#/, '')
  const raw = hash.startsWith('/') ? hash : window.location.pathname
  const path = raw.replace(/\/+$/, '') || '/'
  if (hash.startsWith('/')) window.history.replaceState(null, '', path)
  if (path === '/' && hasVisitedBefore()) return '/inbox'
  return path
}

export function useRoute() {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const handler = () => setRoute(current())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])
  return route
}

/** Real paths only - there is no # in the URLs any more. */
export function navigate(path: string, replace = false) {
  if (window.location.pathname === path) return
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
