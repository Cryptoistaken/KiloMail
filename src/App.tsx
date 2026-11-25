import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { cn } from '@/lib/utils'
import { Copy, Check, Inbox, History, Plus, Shuffle, PencilLine, BookOpen, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Dock, DockIcon } from '@/components/ui/dock'

const Landing = lazy(() =>
  import('@/app/views/Landing').then(m => ({ default: m.Landing }))
)
const InboxView = lazy(() =>
  import('@/app/views/InboxView').then(m => ({ default: m.InboxView }))
)
const MessageView = lazy(() =>
  import('@/app/views/MessageView').then(m => ({ default: m.MessageView }))
)
const HistoryView = lazy(() =>
  import('@/app/views/HistoryView').then(m => ({ default: m.HistoryView }))
)
const DocsView = lazy(() =>
  import('@/app/views/DocsView').then(m => ({ default: m.DocsView }))
)
import { Background }  from '@/app/components/Background'
import { Logo }        from '@/app/components/Logo'

import {
  persistInbox, markVisited,
  getPersistedEmail, loadReadIds, saveReadIds,
  type Panel, type MessageMeta, type MessageFull,
} from '@/lib/types'
import { saveToHistory, updateMessageCount } from '@/lib/history'
import { useRoute, navigate, isEmailPath } from '@/hooks/useRoute'
import { appBase, resolveAppBase, siteUrl } from '@/lib/host'
import { generateUsername } from '@/lib/names'
import { ALL_PROVIDERS, DOMAINS, DEFAULT_DOMAIN, getProvider } from '@/providers/registry'
import { extractCode, subjectCode } from '@/lib/codes'
import { extractActionLink } from '@/lib/links'
import { arrivalOf } from '@/lib/ago'
import { playChime, soundOn, setSoundOn, unlockAudio } from '@/lib/sound'
import { installPressFeedback } from '@/lib/haptics'

// "Own" = domains we host ourselves (the kilolabs provider: Cloudflare worker -> Redis).
// Every other domain belongs to a third-party inbox that the api/providers proxies talk to.
const OWN_DOMAINS = ALL_PROVIDERS.filter(p => p.id === 'kilolabs').flatMap(p => p.domains)
const THIRD_DOMAINS = DOMAINS.filter(d => !OWN_DOMAINS.includes(d))
// New visitors land on an own domain — it is the one with 30-day retention, SSE and delete.
const DEFAULT_OWN_DOMAIN = OWN_DOMAINS[0] ?? DEFAULT_DOMAIN

function randomUsername(domain: string): string {
  try {
    const p = getProvider(`x@${domain}`)
    if (p.generateUsername) return p.generateUsername(domain)
  } catch {}
  return generateUsername()
}

function randomInbox(domain: string = DEFAULT_OWN_DOMAIN): string {
  return `${randomUsername(domain)}@${domain}`
}

function getOrCreateInbox(): string {
  const saved = getPersistedEmail()
  if (saved && DOMAINS.some(d => saved.endsWith(`@${d}`))) return saved
  const fresh = randomInbox()
  persistInbox(fresh)
  return fresh
}

function CustomInboxModal({ onConfirm, onClose }: { onConfirm: (email: string) => void; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [domain, setDomain] = useState(DEFAULT_OWN_DOMAIN)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const domainProvider = ALL_PROVIDERS.find(p => p.domains.includes(domain))
  const usernameLocked = domainProvider?.customUsername === false

  // random-only providers assign the local part, so the field shows what they will give us
  const pickDomain = (d: string) => {
    setDomain(d)
    const p = ALL_PROVIDERS.find(x => x.domains.includes(d))
    if (p?.customUsername === false) setValue(randomUsername(d))
  }

  const submit = () => {
    const v = value.trim().toLowerCase()
    if (!v) return
    onConfirm(v.includes('@') ? v : `${v}@${domain}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold">Custom inbox</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose your username and domain</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center rounded-lg border border-input bg-muted/30 overflow-hidden focus-within:ring-2 focus-within:ring-ring/60">
          <input
            ref={inputRef} value={value}
            onChange={e => setValue(e.target.value)}
            readOnly={usernameLocked}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
            placeholder={usernameLocked ? 'assigned by provider' : 'username'}
            className={`flex-1 bg-transparent px-3 py-2.5 text-sm font-mono focus:outline-none min-w-0 ${usernameLocked ? 'text-muted-foreground cursor-not-allowed' : ''}`}
          />
          <span className="text-xs text-muted-foreground font-mono select-none px-1">@</span>
          <select value={domain} onChange={e => pickDomain(e.target.value)}
            className="bg-transparent text-xs font-mono pr-3 py-2.5 focus:outline-none text-muted-foreground cursor-pointer">
            {ALL_PROVIDERS.filter(p => !p.createEmail).flatMap(p => p.domains).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={submit} disabled={!value.trim()}>Create inbox</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  // kilomail.tech/<email> opens that inbox, so a link can be shared and reopened.
  const routePath = route.replace(/^\//, '')
  const routeEmail = isEmailPath(routePath) ? decodeURIComponent(routePath) : null
  const onInbox = route === '/inbox' || routeEmail !== null

  const [email,      setEmail]      = useState(() => {
    // Opening kilomail.tech/<email> both shows that inbox and makes it the one you come back to.
    if (routeEmail) { persistInbox(routeEmail); return routeEmail }
    return getOrCreateInbox()
  })
  const [editing,    setEditing]    = useState(false)
  const [editValue,  setEditValue]  = useState('')
  const [editDomain, setEditDomain] = useState(DEFAULT_DOMAIN)
  const [messages,   setMessages]   = useState<MessageMeta[]>([])
  const [loading,    setLoading]    = useState(false)
  const [connected,  setConnected]  = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fullMsg,    setFullMsg]    = useState<MessageFull | null>(null)
  const [msgLoading, setMsgLoading] = useState(false)
  const [panel,      setPanel]      = useState<Panel>('inbox')
  const [copied,     setCopied]     = useState(false)
  const [newMenuOpen,  setNewMenuOpen]  = useState(false)
  const [customModal,  setCustomModal]  = useState(false)
  const [bodyCodes,    setBodyCodes]    = useState<Record<string, string>>({})
  const [bodyLinks,    setBodyLinks]    = useState<Record<string, string>>({})
  const [menuTab,      setMenuTab]      = useState<'own' | 'third'>('own')
  const [generating,   setGenerating]   = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)
  const [sound,        setSound]        = useState(soundOn)

  const msgCache   = useRef<Map<string, MessageFull>>(new Map())
  const readIds    = useState(() => new Set(loadReadIds(email)))[0]
  const stopStream = useRef<(() => void) | null>(null)
  const newMenuRef = useRef<HTMLDivElement>(null)
  // New-mail chime bookkeeping: the first stream payload after connecting is the existing
  // inbox, not new mail, so it only arms the chime.
  const chimeArmed = useRef(false)
  const seenIds    = useRef<Set<string>>(new Set())
  const soundRef   = useRef(sound)
  // A message id to open as soon as its inbox finishes loading (clicked from history search).
  const pendingOpen = useRef<string | null>(null)
  useEffect(() => { soundRef.current = sound }, [sound])

  // Browsers keep audio silent until the page has been interacted with, so open the audio
  // context on the first interaction of any kind. Without this the chime gets scheduled on a
  // context that stays 'suspended' and is never actually heard.
  useEffect(() => {
    const unlock = () => unlockAudio()
    const events = ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click'] as const
    events.forEach(e => window.addEventListener(e, unlock, { once: true }))
    return () => events.forEach(e => window.removeEventListener(e, unlock))
  }, [])

  // Every press answers back with a short buzz (phones only).
  useEffect(() => installPressFeedback(), [])

  // Decide once whether the inbox is on app.<domain> or still on this origin, so the landing's
  // button and the copied prompt never point at a host that does not answer.
  useEffect(() => { void resolveAppBase() }, [])

  const autoCopy = useCallback((addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }, [])

  const fetchFullMsg = useCallback(async (addr: string, meta: MessageMeta): Promise<MessageFull | null> => {
    if (msgCache.current.has(meta.id)) return msgCache.current.get(meta.id)!
    try {
      const provider = getProvider(addr)
      const full = await provider.fetchMessage(addr, meta)
      if (full) {
        full.arrivedMs = meta.arrivedMs ?? arrivalOf(meta)
        msgCache.current.set(meta.id, full)
      }
      return full
    } catch { return null }
  }, [])

  const prefetchBodyCodes = useCallback(async (addr: string, msgs: MessageMeta[]) => {
    const targets = msgs.filter(m => !subjectCode(m.subject) && !msgCache.current.has(m.id))
    if (!targets.length) return
    const codes: Record<string, string> = {}
    const links: Record<string, string> = {}
    await Promise.all(targets.map(async m => {
      const full = await fetchFullMsg(addr, m)
      if (!full) return
      const code = extractCode(full.text ?? '', full.html ?? '')
      if (code) codes[m.id] = code
      // A mail that carries a code does not need its link offered too - the list shows one chip.
      else {
        const link = extractActionLink(full.text ?? '', full.html ?? '', full.from)
        if (link) links[m.id] = link
      }
    }))
    if (Object.keys(codes).length) setBodyCodes(prev => ({ ...prev, ...codes }))
    if (Object.keys(links).length) setBodyLinks(prev => ({ ...prev, ...links }))
  }, [fetchFullMsg])

  const prefetchRef = useRef(prefetchBodyCodes)
  useEffect(() => { prefetchRef.current = prefetchBodyCodes }, [prefetchBodyCodes])

  // The newest code - or, when no mail carries one, the newest verification link - goes to the
  // clipboard the moment it is found, so the chip never has to be clicked. One value is copied
  // once; a write the browser refused is retried on the first focus, tap or keypress.
  const lastAutoCopy = useRef<string | null>(null)
  const pendingCopy = useRef<{ value: string; code: boolean } | null>(null)
  const [autoCopied, setAutoCopied] = useState<{ value: string; code: boolean } | null>(null)

  const detected = useMemo(() => {
    const ordered = [...messages].sort(
      (a, b) => (b.arrivedMs ?? arrivalOf(b)) - (a.arrivedMs ?? arrivalOf(a)),
    )
    // The newest mail that carries anything wins; inside it a code beats a link. Picking "any code"
    // anywhere would copy a code from an old mail while a fresh sign-in link sat at the top.
    for (const m of ordered) {
      const code = subjectCode(m.subject) ?? bodyCodes[m.id]
      if (code) return { value: code, code: true }
      const link = bodyLinks[m.id]
      if (link) return { value: link, code: false }
    }
    return null
  }, [messages, bodyCodes, bodyLinks])

  const flushCopy = useCallback(() => {
    const job = pendingCopy.current
    if (!job || lastAutoCopy.current === job.value) return
    const legacyCopy = () => {
      // The async API refuses a cold page in some browsers; the old textarea trick still works
      // once the user has touched the page, and it is what turns a silent failure into a copy.
      const ta = document.createElement('textarea')
      ta.value = job.value
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      if (!ok) throw new Error('copy refused')
    }
    navigator.clipboard.writeText(job.value).catch(legacyCopy).then(() => {
      lastAutoCopy.current = job.value
      pendingCopy.current = null
      setAutoCopied(job)
      setTimeout(() => setAutoCopied(v => (v?.value === job.value ? null : v)), 3000)
    }).catch(() => { /* not focused / not allowed yet - the listeners below try again */ })
  }, [])

  const autoCopyDetected = useCallback((value: string, code: boolean) => {
    if (lastAutoCopy.current === value) return
    pendingCopy.current = { value, code }
    flushCopy()
  }, [flushCopy])

  useEffect(() => { if (detected) autoCopyDetected(detected.value, detected.code) }, [detected, autoCopyDetected])

  // A cold page has no user activation, and Chrome refuses a clipboard write from a tab it does not
  // count as focused. That is why the copy only seemed to happen after pressing Refresh - the click
  // unlocked it. Retry on those same events instead of waiting for that click.
  useEffect(() => {
    const retry = () => { if (pendingCopy.current) flushCopy() }
    const events = ['focus', 'click', 'pointerdown', 'keydown', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, retry, { capture: true }))
    return () => events.forEach(e => window.removeEventListener(e, retry, { capture: true }))
  }, [flushCopy])

  const resetInbox = (next: string) => {
    persistInbox(next)
    setEmail(next); setMessages([]); setSelectedId(null)
    setFullMsg(null)
    // Each inbox keeps its own opened-mail list.
    readIds.clear(); loadReadIds(next).forEach(id => readIds.add(id))
    msgCache.current.clear(); setBodyCodes({}); setBodyLinks({})
    chimeArmed.current = false; seenIds.current = new Set()
    // Kill the previous inbox's stream right now. Waiting for the effect cleanup leaves a
    // window where a late update from the old address lands under the new one, which looks
    // exactly like "it did not refresh".
    stopStream.current?.(); stopStream.current = null
    setConnected(false); setLoading(true)
    autoCopy(next)
  }

  useEffect(() => {
    if (!newMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false)
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [newMenuOpen])

  // The stream runs ~9 minutes, then the browser reconnects within about a second. A short drop
  // like that should not flash "reconnecting…" at the user, so only give up after a few seconds.
  const statusTimer = useRef<number | null>(null)
  const setLiveStatus = useCallback((ok: boolean) => {
    if (statusTimer.current !== null) { clearTimeout(statusTimer.current); statusTimer.current = null }
    if (ok) { setConnected(true); return }
    statusTimer.current = window.setTimeout(() => { statusTimer.current = null; setConnected(false) }, 4000)
  }, [])

  const startStream = useCallback((addr: string) => {
    stopStream.current?.()
    stopStream.current = null
    setConnected(false)
    chimeArmed.current = false
    try {
      const provider = getProvider(addr)
      const stop = provider.streamInbox(
        addr,
        (msgs) => {
          const mapped = msgs.map(m => ({ ...m, read: readIds.has(m.id) || m.read, arrivedMs: arrivalOf(m) }))
          // Chime only for genuinely new mail - never on the first payload after connecting
          // (that is the inbox we already have) and never on a manual refresh.
          const fresh = mapped.some(m => !seenIds.current.has(m.id))
          seenIds.current = new Set(mapped.map(m => m.id))
          if (chimeArmed.current && fresh && soundRef.current) playChime()
          chimeArmed.current = true
          setMessages(mapped)
          updateMessageCount(addr, mapped.length)
          prefetchRef.current(addr, mapped)
        },
        setLiveStatus,
      )
      stopStream.current = stop
    } catch (e) {
      console.error('No provider for', addr, e)
    }
  }, [setLiveStatus])

  const loadInbox = useCallback(async (addr: string) => {
    setLoading(true)
    try {
      const provider = getProvider(addr)
      const msgs = await provider.fetchInbox(addr)
      // Opened mails stay opened across reloads - the API always says unread.
      setMessages(msgs.map(m => ({ ...m, read: readIds.has(m.id) || m.read, arrivedMs: arrivalOf(m) })))
      prefetchBodyCodes(addr, msgs)
    } catch (e) {
      console.error('loadInbox failed', e)
    } finally {
      setLoading(false)
    }
  }, [prefetchBodyCodes])

  const didAutoCopyRef = useRef(false)
  useEffect(() => {
    if (!onInbox || didAutoCopyRef.current) return
    didAutoCopyRef.current = true
    autoCopy(email)
  }, [route]) // eslint-disable-line

  // A real path, not a hash. Following a link (or pressing Back) opens that inbox; a change made
  // in the app is ignored here, which is what keeps the two from fighting each other.
  const lastRoute = useRef(route)
  useEffect(() => {
    if (lastRoute.current === route) return
    lastRoute.current = route
    if (routeEmail && routeEmail.toLowerCase() !== email.toLowerCase()) resetInbox(routeEmail)
  }, [route]) // eslint-disable-line

  // Share what you are reading: the address bar always shows the inbox that is open.
  useEffect(() => {
    if (onInbox && email) navigate(`/${email}`, true)
  }, [onInbox, email])

  useEffect(() => {
    if (!onInbox) return
    saveToHistory(email)
    loadInbox(email)
    startStream(email)
    // Sleep while the tab is hidden: drop the stream, reconnect on return
    // The stream stays open while the tab is hidden - that is exactly when a new-mail chime
    // matters. Coming back re-fetches, in case anything was missed while away.
    const onVisibility = () => {
      if (!document.hidden) loadInbox(email)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stopStream.current?.(); stopStream.current = null
      if (statusTimer.current !== null) { clearTimeout(statusTimer.current); statusTimer.current = null }
    }
  }, [route, email, loadInbox, startStream])

  const selectMessage = async (id: string) => {
    setSelectedId(id); readIds.add(id); saveReadIds(email, [...readIds])
    setMessages(m => m.map(msg => msg.id === id ? { ...msg, read: true } : msg))
    if (msgCache.current.has(id)) {
      setFullMsg(msgCache.current.get(id)!); setMsgLoading(false); return
    }
    setMsgLoading(true); setFullMsg(null)
    try {
      const meta = messages.find(m => m.id === id)
      const full = meta ? await fetchFullMsg(email, meta) : null
      setFullMsg(full)
    } finally { setMsgLoading(false) }
  }

  // A history search result was clicked: once that inbox has loaded, open the exact message.
  useEffect(() => {
    const id = pendingOpen.current
    if (!id || !messages.some(m => m.id === id)) return
    pendingOpen.current = null
    void selectMessage(id)
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteMessage = async (id: string) => {
    try {
      const provider = getProvider(email)
      await provider.deleteMessage?.(email, id)
    } catch {}
    setMessages(m => m.filter(msg => msg.id !== id))
    if (selectedId === id) { setSelectedId(null); setFullMsg(null) }
  }

  const copyEmail = () => { navigator.clipboard.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const newInbox  = async (domain?: string) => {
    const d = domain ?? DOMAINS[Math.floor(Math.random() * DOMAINS.length)]
    const p = getProvider(`x@${d}`)
    if (p.createEmail) {
      const real = await p.createEmail(d)
      resetInbox(real)
    } else {
      resetInbox(randomInbox(d))
    }
  }
  // Switching address always reloads that inbox (the route + email effect fetches it, and
  // resetInbox drops the old stream), and a click from a history search also opens the exact
  // message that matched.
  const switchToEmail = (addr: string, openId?: string) => {
    resetInbox(addr)
    pendingOpen.current = openId ?? null
    setPanel('inbox')
  }

  // One click = a fresh address on the domain we are already on (history is saved by the inbox effect).
  // No spinning icon here — the address itself animates in, which is the real feedback.
  const spinEmail = () => {
    if (generating) return
    setGenerating(true)
    setTimeout(() => setGenerating(false), 500)
    newInbox(currentDomain)
  }

  // A fetch here takes ~50ms, which is too fast to see, so the spin is held for 600ms.
  const refreshInbox = async () => {
    if (refreshing) return
    setRefreshing(true)
    const started = Date.now()
    try { await loadInbox(email) } finally {
      const left = 600 - (Date.now() - started)
      if (left > 0) await new Promise(r => setTimeout(r, left))
      setRefreshing(false)
    }
  }
  const currentDomain = DOMAINS.find(d => email.endsWith(`@${d}`)) ?? email.split("@")[1] ?? DEFAULT_DOMAIN
  const currentProvider = ALL_PROVIDERS.find(p => p.domains.some(d => email.endsWith(`@${d}`)))
  const canEditName = currentProvider?.customUsername !== false

  const confirmEditRef = useRef(false)
  const confirmEdit = () => {
    if (confirmEditRef.current) return
    confirmEditRef.current = true
    setTimeout(() => { confirmEditRef.current = false }, 100)
    const v = editValue.trim().toLowerCase(); if (!v) { setEditing(false); return }
    const full = v.includes('@') ? v : `${v}@${editDomain}`
    if (!DOMAINS.some(d => full.endsWith(`@${d}`))) { setEditing(false); return }
    const targetProvider = ALL_PROVIDERS.find(p => p.domains.some(d => full.endsWith(`@${d}`)))
    const finalEmail = targetProvider?.customUsername === false ? `${randomUsername(editDomain)}@${editDomain}` : full
    resetInbox(finalEmail); setEditing(false)
  }

  if (route === '/docs')
    return (
      <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-background" />}>
          <DocsView />
        </Suspense>
        <Analytics />
      </div>
    )

  const unread = messages.filter(m => !m.read).length

  if (route === '/' || route === '')
    return (
      <>
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background" />}>
          <Landing onLaunch={() => {
            // The inbox may live on app.<domain>, or on this origin until that subdomain is
            // added; resolveAppBase decided once on load which one actually answers.
            const base = appBase()
            if (base === window.location.origin) { markVisited(); navigate('/inbox'); return }
            window.location.href = `${base}/inbox`
          }} />
        </Suspense>
        <Analytics />
      </>
    )

  return (
    <TooltipProvider>
      <div className="relative flex h-dvh flex-col bg-background text-foreground overflow-hidden">
        <Background />

        <header className="appheader relative z-10 flex items-center gap-3 border-b border-border/50 bg-background/70 px-4 py-3 backdrop-blur-md sm:px-5">
          <button onClick={() => { const site = siteUrl(); if (site) window.location.href = site; else navigate('/') }} className="hidden sm:flex items-center gap-2.5 shrink-0 hover:opacity-75 transition-opacity">
            <Logo variant="icon" className="h-7 w-7" />
            <span className="hidden sm:block text-sm font-semibold tracking-tight">KiloMail</span>
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            {editing ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center h-8 rounded-lg border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring/60">
                  <input autoFocus value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { confirmEdit(); return } if (e.key === 'Escape') setEditing(false) }}
                    placeholder="username"
                    className="h-full w-32 bg-transparent px-3 text-sm font-mono focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground font-mono select-none">@</span>
                   <select value={editDomain} onChange={e => setEditDomain(e.target.value)}
                    className="h-full bg-transparent text-xs font-mono pr-2 focus:outline-none text-muted-foreground cursor-pointer">
                    {ALL_PROVIDERS.filter(p => !p.createEmail).flatMap(p => p.domains).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <Button aria-label="Confirm" size="icon" className="h-8 w-8" data-buzz="medium" onMouseDown={e => e.preventDefault()} onClick={confirmEdit}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger aria-label="New address on this domain">
                    <Button variant="ghost" size="icon"
                      className="h-8 w-8 shrink-0 transition-transform active:scale-90"
                      data-buzz="medium"
                      disabled={generating} onClick={spinEmail}>
                      <Shuffle className={cn('h-4 w-4', generating && 'opacity-50')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New address · @{currentDomain}</TooltipContent>
                </Tooltip>
                {canEditName ? (
                  <button
                    key={email}
                    onClick={() => { setEditValue(email.split('@')[0]); setEditDomain(currentDomain); setEditing(true) }}
                    className="flex w-[15rem] min-w-0 animate-in fade-in-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 duration-200 transition-colors hover:bg-muted active:scale-[0.98] sm:w-[19rem]"
                  >
                    <span className="min-w-0 flex-1 truncate text-left font-mono text-sm">{email.split('@')[0]}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">@{currentDomain}</span>
                    <PencilLine className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                ) : (
                  <div key={email} className="flex w-[15rem] min-w-0 animate-in fade-in-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 duration-200 sm:w-[19rem]">
                    <span className="min-w-0 flex-1 truncate text-left font-mono text-sm">{email.split('@')[0]}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">@{currentDomain}</span>
                  </div>
                )}
                <Tooltip>
                  <TooltipTrigger aria-label="Copy address">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyEmail}>
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy address</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger aria-label="API docs" className="absolute right-4 top-1/2 hidden -translate-y-1/2 sm:right-5 sm:flex">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/docs')}>
                <BookOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>API docs</TooltipContent>
          </Tooltip>
        </header>

        <main className="relative z-10 flex flex-1 gap-3 overflow-hidden p-3">
          <aside className={cn(
            'panel3d flex w-full flex-col overflow-hidden rounded-xl border border-border bg-background/90 shadow-sm backdrop-blur-sm md:w-80 md:shrink-0',
            (selectedId || panel !== 'inbox') && 'hidden md:flex'
          )}>
            <Suspense fallback={<div className="flex flex-1 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" /></div>}>
              <InboxView email={email} messages={messages} loading={loading} connected={connected}
                selected={selectedId} onSelect={selectMessage}
                onRefresh={refreshInbox} refreshing={refreshing} bodyCodes={bodyCodes} bodyLinks={bodyLinks}
                sound={sound} onToggleSound={() => setSound(s => {
                  const next = !s
                  setSoundOn(next)
                  // Turning it on plays the arrival sound once, so you know what to listen for.
                  if (next) { unlockAudio(); playChime() }
                  return next
                })}
              />
            </Suspense>
          </aside>
          <section className={cn(
            'panel3d flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background/90 shadow-sm backdrop-blur-sm',
            !selectedId && panel === 'inbox' && 'hidden md:flex'
          )}>
            {panel === 'inbox'   && <Suspense fallback={<div className="flex flex-1 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" /></div>}><MessageView message={fullMsg} loading={msgLoading} inboxEmail={email} onClose={() => { setSelectedId(null); setFullMsg(null) }} onDelete={() => selectedId && deleteMessage(selectedId)} /></Suspense>}
            {panel === 'history' && <Suspense fallback={<div className="flex flex-1 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" /></div>}><HistoryView onSwitch={switchToEmail} onClear={() => {}} /></Suspense>}
          </section>
        </main>

        <footer className="relative z-10 flex items-center justify-center pb-3 pt-2">
          {newMenuOpen && (
            <div
              ref={newMenuRef}
              className="absolute bottom-[calc(100%-4px)] left-1/2 -translate-x-1/2 z-50 min-w-[240px] rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-md overflow-hidden"
            >
              <p className="px-3 pt-3 pb-2 text-xs font-semibold text-foreground">New random inbox on…</p>
              <div className="mx-2 mb-1 flex gap-0.5 rounded-lg bg-muted p-0.5">
                {([['own', `Own (${OWN_DOMAINS.length})`], ['third', `3rd party (${THIRD_DOMAINS.length})`]] as const).map(([key, label]) => (
                  <button key={key}
                    onClick={e => { e.stopPropagation(); setMenuTab(key) }}
                    className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      menuTab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  >{label}</button>
                ))}
              </div>
              <div className="max-h-[52vh] overflow-y-auto">
                {(menuTab === 'own' ? OWN_DOMAINS : THIRD_DOMAINS).map(d => (
                  <button key={d}
                    className="flex w-full items-center justify-between gap-2.5 px-3 py-2.5 hover:bg-muted transition-colors"
                    onClick={e => { e.stopPropagation(); setNewMenuOpen(false); newInbox(d) }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Shuffle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-sm font-medium">@{d}</span>
                    </div>
                    <span className={cn('shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px]',
                      menuTab === 'own' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                      {menuTab === 'own' ? 'own' : '3rd party'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="h-px bg-border mx-2 my-1" />
              <button
                className="flex w-full items-center gap-2.5 px-3 py-2.5 pb-3 hover:bg-muted transition-colors"
                onClick={e => { e.stopPropagation(); setNewMenuOpen(false); setCustomModal(true) }}
              >
                <PencilLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-sm">Custom address…</span>
              </button>
            </div>
          )}

          <Dock
            className="mt-0 h-[66px] gap-1.5 rounded-2xl border border-border/60 bg-background/80 px-3 shadow-lg shadow-black/10 backdrop-blur-xl dark:bg-background/70 dark:shadow-black/30">
            <DockIcon data-buzz="medium" onClick={() => { setPanel('inbox'); setSelectedId(null); setFullMsg(null) }}>
              <Tooltip>
                <TooltipTrigger aria-label="Inbox">
                  <div className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative size-10 rounded-full',
                    panel === 'inbox' && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground')}>
                    <Inbox className="size-4" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white leading-none">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Inbox</TooltipContent>
              </Tooltip>
            </DockIcon>

            <DockIcon data-buzz="medium" onClick={() => setPanel('history')}>
              <Tooltip>
                <TooltipTrigger aria-label="History">
                  <div className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-10 rounded-full',
                    panel === 'history' && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground')}>
                    <History className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">History</TooltipContent>
              </Tooltip>
            </DockIcon>

            <DockIcon onClick={() => setNewMenuOpen(o => !o)}>
              <Tooltip>
                <TooltipTrigger aria-label="New inbox">
                  <div className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-10 rounded-full',
                    newMenuOpen && 'bg-muted text-foreground')}>
                    <Plus className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">New inbox (pick domain)</TooltipContent>
              </Tooltip>
            </DockIcon>

            <DockIcon data-buzz="medium" onClick={spinEmail}>
              <Tooltip>
                <TooltipTrigger aria-label="New address on this domain">
                  <div className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-10 rounded-full',
                    generating && 'bg-muted text-foreground')}>
                    <Shuffle className={cn('size-4', generating && 'opacity-50')} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">New address · @{currentDomain}</TooltipContent>
              </Tooltip>
            </DockIcon>

            <DockIcon>
              <Tooltip>
                <TooltipTrigger aria-label="Toggle theme">
                  <div className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-10 rounded-full')}>
                    <AnimatedThemeToggler asDiv className="flex h-full w-full items-center justify-center text-inherit" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Toggle theme</TooltipContent>
              </Tooltip>
            </DockIcon>
          </Dock>
        </footer>

        {autoCopied && (
          <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 truncate rounded-full border border-border bg-card px-4 py-2 text-xs text-card-foreground shadow-lg">
            Copied {autoCopied.code ? 'code' : 'link'} · {autoCopied.value.length > 36 ? `${autoCopied.value.slice(0, 36)}…` : autoCopied.value}
          </div>
        )}

        {customModal && (
          <CustomInboxModal
            onConfirm={(addr) => { resetInbox(addr); setCustomModal(false) }}
            onClose={() => setCustomModal(false)}
          />
        )}
      </div>
      <Analytics />
    </TooltipProvider>
  )
}
