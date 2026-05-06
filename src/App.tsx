import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react"
import { cn } from "@/lib/utils"
import { Copy, Check, Inbox, History, Plus, Shuffle, PencilLine, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { Dock, DockIcon } from "@/components/ui/dock"

const Landing = lazy(() =>
  import("@/components/app/Landing").then(m => ({ default: m.Landing }))
)
import { InboxView } from "@/components/app/InboxView"
import { MessageView } from "@/components/app/MessageView"
import { HistoryView } from "@/components/app/HistoryView"
import { FlickeringBg } from "@/components/app/FlickeringBg"
import { KiloMailLogo } from "@/components/app/KiloMailLogo"

import {
  DOMAIN, DOMAINS, BASE, randomInbox, randomDomain,
  getOrCreateInbox, persistInbox, markVisited,
  isHDDomain, isEduDomain,
  type KiloDomain, type Panel, type MessageMeta, type MessageFull,
} from "@/lib/types"
import { saveToHistory, updateMessageCount } from "@/lib/history"
import { useHashRoute, navigate } from "@/lib/router"

// ── Custom inbox modal ────────────────────────────────────────────────────
function CustomInboxModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (email: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState("")
  const [domain, setDomain] = useState<KiloDomain>(DOMAIN)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = () => {
    const v = value.trim().toLowerCase()
    if (!v) return
    // if they typed a full address respect it, otherwise append chosen domain
    const full = v.includes("@") ? v : `${v}@${domain}`
    onConfirm(full)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold">Custom inbox</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose your username and domain</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Username + domain row */}
        <div className="flex items-center rounded-lg border border-input bg-muted/30 overflow-hidden focus-within:ring-2 focus-within:ring-ring/60">
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose() }}
            placeholder="username"
            className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono focus:outline-none min-w-0"
          />
          <span className="text-xs text-muted-foreground font-mono select-none px-1">@</span>
          <select
            value={domain}
            onChange={e => setDomain(e.target.value as KiloDomain)}
            className="bg-transparent text-xs font-mono pr-3 py-2.5 focus:outline-none text-muted-foreground cursor-pointer"
          >
            {DOMAINS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={submit} disabled={!value.trim()}>
            Create inbox
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const route = useHashRoute()

  const [email,        setEmail]        = useState(() => getOrCreateInbox())
  const [editing,      setEditing]      = useState(false)
  const [editValue,    setEditValue]    = useState("")
  const [editDomain,   setEditDomain]   = useState<KiloDomain>(DOMAIN)
  const [messages,     setMessages]     = useState<MessageMeta[]>([])
  const [loading,      setLoading]      = useState(false)
  const [connected,    setConnected]    = useState(false)
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [fullMsg,      setFullMsg]      = useState<MessageFull | null>(null)
  const [msgLoading,   setMsgLoading]   = useState(false)
  const msgCache       = useRef<Map<string, MessageFull>>(new Map())
  const [panel,        setPanel]        = useState<Panel>("inbox")
  const [copied,       setCopied]       = useState(false)
  const [newMenuOpen,    setNewMenuOpen]    = useState(false)
  const [customModal,    setCustomModal]    = useState(false)


  const esRef            = useRef<EventSource | null>(null)
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null)
  const readIds          = useRef<Set<string>>(new Set())
  const newMenuRef       = useRef<HTMLDivElement>(null)


  // Auto-copy an address to clipboard; shows checkmark on success
  const autoCopy = useCallback((addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => { /* permission denied — silently ignore */ })
  }, [])

  // Codes extracted from message bodies (for cards whose subject has no code)
  const [bodyCodes, setBodyCodes] = useState<Record<string, string>>({})

  const fetchFullMsg = useCallback(async (addr: string, meta: MessageMeta): Promise<MessageFull | null> => {
    if (msgCache.current.has(meta.id)) return msgCache.current.get(meta.id)!
    try {
      let res: Response
      if (isHDDomain(addr)) {
        const time = Math.floor(new Date(meta.receivedAt).getTime() / 1000)
        res = await fetch(`${BASE}/api/hd?action=read&email=${encodeURIComponent(addr)}&emlid=${encodeURIComponent(meta.id)}&time=${time}`)
      } else if (isEduDomain(addr)) {
        res = await fetch(`${BASE}/api/edu?action=read&email=${encodeURIComponent(addr)}&uid=${encodeURIComponent(meta.id)}`)
      } else {
        res = await fetch(`${BASE}/api/inbox/${encodeURIComponent(addr)}/${encodeURIComponent(meta.id)}`)
      }
      const full = await res.json() as MessageFull
      msgCache.current.set(meta.id, full)
      return full
    } catch { return null }
  }, [])

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim()
  }

  function extractCodeFromBody(text: string, html: string): string | null {
    const src = text.trim() ? text : stripHtml(html)
    const patterns = [
      /confirmation\s+code(?:\s+in\s+the\s+app)?[^\d]+(\d{4,8})/i,
      /(?:code|verification|otp|pin|confirmation|token)[^\d]*(\d{4,8})\b/i,
      /\b(\d{4,8})\b/,
    ]
    for (const p of patterns) {
      const m = src.match(p)
      if (m?.[1]) return m[1]
      if (m?.[0] && p.source === "\\b(\\d{4,8})\\b") return m[0]
    }
    return null
  }

  const prefetchBodyCodes = useCallback(async (addr: string, msgs: MessageMeta[]) => {
    const targets = msgs.filter(m => {
      // Skip if subject already contains a 4-8 digit code
      if (/\b\d{4,8}\b/.test(m.subject ?? "")) return false
      if (msgCache.current.has(m.id)) return false
      return true
    })
    if (!targets.length) return
    const results: Record<string, string> = {}
    await Promise.all(targets.map(async m => {
      const full = await fetchFullMsg(addr, m)
      if (!full) return
      const code = extractCodeFromBody(full.text ?? "", full.html ?? "")
      if (code) results[m.id] = code
    }))
    if (Object.keys(results).length) setBodyCodes(prev => ({ ...prev, ...results }))
  }, [fetchFullMsg])

  // Always-current ref so stream handlers never capture a stale closure
  const prefetchBodyCodesRef = useRef(prefetchBodyCodes)
  useEffect(() => { prefetchBodyCodesRef.current = prefetchBodyCodes }, [prefetchBodyCodes])

  const resetInbox = (next: string) => {
    persistInbox(next)
    setEmail(next); setMessages([]); setSelectedId(null)
    setFullMsg(null); readIds.current.clear()
    msgCache.current.clear(); setBodyCodes({})
    autoCopy(next)
  }

  // Close new-inbox dropdown when clicking outside
  useEffect(() => {
    if (!newMenuOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      // close if clicking outside the dropdown panel itself
      if (newMenuRef.current && !newMenuRef.current.contains(target)) {
        setNewMenuOpen(false)
      }
    }
    // Use capture so it fires before the + DockIcon's onClick toggle
    document.addEventListener("mousedown", handler, true)
    return () => document.removeEventListener("mousedown", handler, true)
  }, [newMenuOpen])

  const startStream = useCallback((addr: string) => {
    // Stop any existing stream or poll
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    setConnected(false)

    if (isHDDomain(addr)) {
      // ── HD domains: HTTP polling every 5 s via proxy ──────────────────
      const fetchHD = async () => {
        try {
          const res = await fetch(`${BASE}/api/hd?action=inbox&email=${encodeURIComponent(addr)}`)
          if (!res.ok) return
          const msgs = (await res.json()) as MessageMeta[]
          if (Array.isArray(msgs)) {
            const mapped = msgs.map(m => ({ ...m, read: readIds.current.has(m.id) || m.read }))
            setMessages(mapped)
            updateMessageCount(addr, mapped.length)
            prefetchBodyCodesRef.current(addr, mapped)
            setConnected(true)
          }
        } catch { setConnected(false) }
      }
      fetchHD()
      pollRef.current = setInterval(fetchHD, 5000)
      return null
    }

    if (isEduDomain(addr)) {
      // ── EDU domains: SSE stream via /api/edu?action=stream ─────────────
      const es = new EventSource(`${BASE}/api/edu?action=stream&email=${encodeURIComponent(addr)}`)
      esRef.current = es
      es.onmessage = (e) => {
        const d = JSON.parse(e.data)
        if (d.type === "connected") setConnected(true)
        if (d.type === "update") {
          const msgs = (d.messages as MessageMeta[]).map(m => ({ ...m, read: readIds.current.has(m.id) }))
          setMessages(msgs)
          updateMessageCount(addr, msgs.length)
          prefetchBodyCodesRef.current(addr, msgs)
        }
      }
      es.onerror = () => setConnected(false)
      return es
    }

    // ── kilolabs.space: SSE stream ─────────────────────────────────────
    const es = new EventSource(`${BASE}/api/inbox/${encodeURIComponent(addr)}/stream`)
    esRef.current = es
    es.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === "connected") setConnected(true)
      if (d.type === "update") {
        const msgs = (d.messages as MessageMeta[]).map(m => ({ ...m, read: readIds.current.has(m.id) }))
        setMessages(msgs)
        updateMessageCount(addr, msgs.length)
        prefetchBodyCodesRef.current(addr, msgs)
      }
    }
    es.onerror = () => setConnected(false)
    return es
  }, [])

  const loadInbox = useCallback(async (addr: string) => {
    setLoading(true)
    try {
      const url = isHDDomain(addr)
        ? `${BASE}/api/hd?action=inbox&email=${encodeURIComponent(addr)}`
        : isEduDomain(addr)
          ? `${BASE}/api/edu?action=inbox&email=${encodeURIComponent(addr)}`
          : `${BASE}/api/inbox/${encodeURIComponent(addr)}`
      const res = await fetch(url)
      const data = await res.json()
      const msgs = Array.isArray(data) ? data : []
      setMessages(msgs)
      prefetchBodyCodes(addr, msgs)
    } finally { setLoading(false) }
  }, [prefetchBodyCodes])

  // Auto-copy on first arrival at /inbox (one-shot, separate from stream effect)
  const didAutoCopyRef = useRef(false)
  useEffect(() => {
    if (route !== "/inbox" || didAutoCopyRef.current) return
    didAutoCopyRef.current = true
    autoCopy(email)
  }, [route]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (route !== "/inbox") return
    saveToHistory(email)
    loadInbox(email)
    const es = startStream(email)
    return () => {
      if (es) es.close()
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [route, email, loadInbox, startStream])

  const selectMessage = async (id: string) => {
    setSelectedId(id); readIds.current.add(id)
    setMessages(m => m.map(msg => msg.id === id ? { ...msg, read: true } : msg))
    // Serve from cache instantly if available
    if (msgCache.current.has(id)) {
      setFullMsg(msgCache.current.get(id)!)
      setMsgLoading(false)
      return
    }
    setMsgLoading(true); setFullMsg(null)
    try {
      const meta = messages.find(m => m.id === id)
      const full = meta ? await fetchFullMsg(email, meta) : null
      setFullMsg(full)
    } finally { setMsgLoading(false) }
  }

  const deleteMessage = async (id: string) => {
    if (!isHDDomain(email)) {
      await fetch(`${BASE}/api/inbox/${encodeURIComponent(email)}/${encodeURIComponent(id)}`, { method: "DELETE" })
    }
    // HD domains: remove from local state only (no delete API available)
    setMessages(m => m.filter(msg => msg.id !== id))
    if (selectedId === id) { setSelectedId(null); setFullMsg(null) }
  }

  const copyEmail = () => {
    navigator.clipboard.writeText(email); setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const newInbox      = (domain?: KiloDomain) => resetInbox(randomInbox(domain ?? randomDomain()))
  const switchToEmail = (addr: string) => { resetInbox(addr); setPanel("inbox") }
  const currentDomain = (DOMAINS.find(d => email.endsWith(`@${d}`)) ?? DOMAIN) as KiloDomain

  const confirmEditRef = useRef(false)
  const confirmEdit = () => {
    if (confirmEditRef.current) return
    confirmEditRef.current = true
    setTimeout(() => { confirmEditRef.current = false }, 100)
    const v = editValue.trim().toLowerCase(); if (!v) { setEditing(false); return }
    const full = v.includes("@") ? v : `${v}@${editDomain}`
    if (!DOMAINS.some(d => full.endsWith(`@${d}`))) { setEditing(false); return }
    resetInbox(full); setEditing(false)
  }

  const unread = messages.filter(m => !m.read).length

  if (route === "/" || route === "")
    return (
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background" />}>
        <Landing onLaunch={() => { markVisited(); navigate("/inbox") }} />
      </Suspense>
    )

  return (
    <TooltipProvider>
      <div className="relative flex h-dvh flex-col bg-background text-foreground overflow-hidden">
        <FlickeringBg />

        {/* ── Header ── */}
        <header className="relative z-10 flex items-center gap-3 border-b border-border/50 bg-background/70 px-4 py-3 backdrop-blur-md sm:px-5">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 shrink-0 hover:opacity-75 transition-opacity">
            <KiloMailLogo variant="icon" className="h-7 w-7" />
            <span className="hidden sm:block text-sm font-semibold tracking-tight">KiloMail</span>
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            {editing ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center h-8 rounded-lg border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring/60">
                  <input autoFocus value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { confirmEdit(); return } if (e.key === "Escape") setEditing(false) }}
                    placeholder="username"
                    className="h-full w-32 bg-transparent px-3 text-sm font-mono focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground font-mono select-none">@</span>
                  <select
                    value={editDomain}
                    onChange={e => { setEditDomain(e.target.value as KiloDomain) }}
                    className="h-full bg-transparent text-xs font-mono pr-2 focus:outline-none text-muted-foreground cursor-pointer"
                  >
                    {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <Button size="icon" className="h-8 w-8" onMouseDown={e => e.preventDefault()} onClick={confirmEdit}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                {/* Full address pill — click anywhere to edit username + domain */}
                <button
                  onClick={() => { setEditValue(email.split("@")[0]); setEditDomain(currentDomain); setEditing(true) }}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <span className="max-w-[160px] truncate font-mono text-sm">{email.split("@")[0]}</span>
                  <span className="font-mono text-xs text-muted-foreground">@{currentDomain}</span>
                  <PencilLine className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>

                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyEmail}>
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy address</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </header>

        {/* ── Body ── */}
        <div className="relative z-10 flex flex-1 gap-3 overflow-hidden p-3">
          <aside className={cn(
            "flex w-full flex-col overflow-hidden rounded-xl border border-border bg-background/90 shadow-sm backdrop-blur-sm md:w-80 md:shrink-0",
            (selectedId || panel !== "inbox") && "hidden md:flex"
          )}>
            <InboxView email={email} messages={messages} loading={loading} connected={connected}
              selected={selectedId} onSelect={selectMessage} onDelete={deleteMessage}
              onRefresh={() => loadInbox(email)} bodyCodes={bodyCodes} />
          </aside>
          <main className={cn(
            "flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background/90 shadow-sm backdrop-blur-sm",
            !selectedId && panel === "inbox" && "hidden md:flex"
          )}>
            {panel === "inbox"   && <MessageView message={fullMsg} loading={msgLoading} onClose={() => { setSelectedId(null); setFullMsg(null) }} onDelete={() => selectedId && deleteMessage(selectedId)} />}
            {panel === "history" && <HistoryView onSwitch={switchToEmail} onClear={() => {}} />}
          </main>
        </div>

        {/* ── Dock ── */}
        <footer className="relative z-10 flex items-center justify-center pb-3 pt-2">

          {/* New inbox dropdown — rendered outside <Dock> so it doesn't break renderChildren */}
          {newMenuOpen && (
            <div
              ref={newMenuRef}
              className="absolute bottom-[calc(100%-4px)] left-1/2 -translate-x-1/2 z-50 min-w-[240px] rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-md overflow-hidden"
            >
              <p className="px-3 pt-3 pb-1.5 text-xs font-semibold text-foreground">New random inbox on…</p>
              {DOMAINS.map(d => (
                <button
                  key={d}
                  className="flex w-full items-center justify-between gap-2.5 px-3 py-2.5 hover:bg-muted transition-colors"
                  onClick={e => { e.stopPropagation(); setNewMenuOpen(false); newInbox(d) }}
                >
                  <div className="flex items-center gap-2">
                    <Shuffle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-sm font-medium">@{d}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                    {d === "kilolabs.space" ? "own" : isEduDomain(`x@${d}`) ? "edu" : "3rd party"}
                  </span>
                </button>
              ))}
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
            iconSize={40}
            iconMagnification={62}
            iconDistance={130}
            className="mt-0 h-[58px] gap-0.5 rounded-2xl border border-border/60 bg-background/80 px-3 shadow-lg shadow-black/10 backdrop-blur-xl dark:bg-background/70 dark:shadow-black/30"
          >

            {/* Inbox */}
            <DockIcon onClick={() => { setPanel("inbox"); setSelectedId(null); setFullMsg(null) }}>
              <Tooltip>
                <TooltipTrigger>
                  <div className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "relative size-10 rounded-full",
                    panel === "inbox" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}>
                    <Inbox className="size-4" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white leading-none">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Inbox</TooltipContent>
              </Tooltip>
            </DockIcon>

            {/* History */}
            <DockIcon onClick={() => setPanel("history")}>
              <Tooltip>
                <TooltipTrigger>
                  <div className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-10 rounded-full",
                    panel === "history" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}>
                    <History className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">History</TooltipContent>
              </Tooltip>
            </DockIcon>

            {/* + New inbox */}
            <DockIcon onClick={() => setNewMenuOpen(o => !o)}>
              <Tooltip>
                <TooltipTrigger>
                  <div className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-10 rounded-full",
                    newMenuOpen && "bg-muted text-foreground"
                  )}>
                    <Plus className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">New inbox (pick domain)</TooltipContent>
              </Tooltip>
            </DockIcon>

            {/* Theme toggle */}
            <DockIcon>
              <Tooltip>
                <TooltipTrigger>
                  <div className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-10 rounded-full"
                  )}>
                    <AnimatedThemeToggler
                      asDiv
                      className="flex h-full w-full items-center justify-center text-inherit"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Toggle theme</TooltipContent>
              </Tooltip>
            </DockIcon>

          </Dock>
        </footer>

        {/* ── Custom inbox modal ── */}
        {customModal && (
          <CustomInboxModal
            onConfirm={(addr) => { resetInbox(addr); setCustomModal(false) }}
            onClose={() => setCustomModal(false)}
          />
        )}

      </div>
    </TooltipProvider>
  )
}
