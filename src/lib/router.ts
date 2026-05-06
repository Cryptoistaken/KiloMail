// ── Hash router — no install needed, works on Vercel SPA ─────────────────
// Routes:  #/        → Landing (first-time visitors only)
//          #/inbox   → Inbox app
//          #/docs    → Full docs page

import { useState, useEffect } from "react"
import { hasVisitedBefore } from "./types"

function getHash() {
  const h = window.location.hash.replace("#", "") || "/"
  const route = h.startsWith("/") ? h : `/${h}`
  // Returning users skip the landing page entirely
  if (route === "/" && hasVisitedBefore()) return "/inbox"
  return route
}

export function useHashRoute() {
  const [route, setRoute] = useState(getHash)
  useEffect(() => {
    const handler = () => setRoute(getHash())
    window.addEventListener("hashchange", handler)
    return () => window.removeEventListener("hashchange", handler)
  }, [])
  return route
}

export function navigate(path: string) {
  window.location.hash = path
}
