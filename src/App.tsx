import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check, Inbox, History, Plus, Shuffle, PencilLine, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Dock, DockIcon } from '@/components/ui/dock'

const Landing = lazy(() =>
  import('@/app/views/Landing').then(m => ({ default: m.Landing }))
)
import { InboxView }   from '@/app/views/InboxView'
import { MessageView } from '@/app/views/MessageView'
import { HistoryView } from '@/app/views/HistoryView'
import { Background }  from '@/app/components/Background'
import { Logo }        from '@/app/components/Logo'

import {
  persistInbox, markVisited,
  getPersistedEmail,
  type Panel, type MessageMeta, type MessageFull,
} from '@/lib/types'
import { saveToHistory, updateMessageCount } from '@/lib/history'
import { useHashRoute, navigate } from '@/hooks/useHashRoute'
import { generateUsername } from '@/lib/names'
import { ALL_PROVIDERS, DOMAINS, DEFAULT_DOMAIN, getProvider } from '@/providers/registry'

function randomUsername(domain: string): string {
  try {
    const p = getProvider(`x@${domain}`)
    if (p.generateUsername) return p.generateUsername(domain)
  } catch {}
  return generateUsername()
}

function randomInbox(domain: string = DEFAULT_DOMAIN): string {
  return `${randomUsername(domain)}@${domain}`
}

function getOrCreateInbox(): string {
  const saved = getPersistedEmail()
  if (saved && DOMAINS.some(d => saved.endsWith(`@${d}`))) return saved
  const fresh = randomInbox()
  persistInbox(fresh)
  return fresh
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function extractCode(text: string, html: string): string | null {
  const src = text.trim() ? text : stripHtml(html)
  const patterns = [
    /confirmation\s+code(?:\s+in\s+the\s+app)?[^\d]+(\d{4,8})/i,
    /(?:code|verification|otp|pin|confirmation|token)[^\d]*(\d{4,8})\b/i,
    /\b(\d{4,8})\b/,
  ]
  for (const p of patterns) {
    const m = src.match(p)
    if (m?.[1]) return m[1]
    if (m?.[0] && p.source === '\\b(\\d{4,8})\\b') return m[0]
  }
  return null
}

function CustomInboxModal({ onConfirm, onClose }: { onConfirm: (email: string) => void; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [domain, setDomain] = useState(DEFAULT_DOMAIN)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

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
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center rounded-lg border border-input bg-muted/30 overflow-hidden focus-within:ring-2 focus-within:ring-ring/60">
          <input
            ref={inputRef} value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
            placeholder="username"
            className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono focus:outline-none min-w-0"
          />
          <span className="text-xs text-muted-foreground font-mono select-none px-1">@</span>
          <select value={domain} onChange={e => setDomain(e.target.value)}
            className="bg-transparent text-xs font-mono pr-3 py-2.5 focus:outline-none text-muted-foreground cursor-pointer">
            {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
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
  const route = useHashRoute()

  const [email,      setEmail]      = useState(() => getOrCreateInbox())
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

  const msgCache   = useRef<Map<string, MessageFull>>(new Map())
  const readIds    = useRef<Set<string>>(new Set())
  const stopStream = useRef<(() => void) | null>(null)
  const newMenuRef = useRef<HTMLDivElement>(null)

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
      if (full) msgCache.current.set(meta.id, full)
      return full
    } catch { return null }
  }, [])

  const prefetchBodyCodes = useCallback(async (addr: string, msgs: MessageMeta[]) => {
    const targets = msgs.filter(m => !/\b\d{4,8}\b/.test(m.subject ?? '') && !msgCache.current.has(m.id))
    if (!targets.length) return
    const results: Record<string, string> = {}
    await Promise.all(targets.map(async m => {
      const full = await fetchFullMsg(addr, m)
      if (!full) return
      const code = extractCode(full.text ?? '', full.html ?? '')
      if (code) results[m.id] = code
    }))
    if (Object.keys(results).length) setBodyCodes(prev => ({ ...prev, ...results }))
  }, [fetchFullMsg])

  const prefetchRef = useRef(prefetchBodyCodes)
  useEffect(() => { prefetchRef.current = prefetchBodyCodes }, [prefetchBodyCodes])

  const resetInbox = (next: string) => {
    persistInbox(next)
    setEmail(next); setMessages([]); setSelectedId(null)
    setFullMsg(null); readIds.current.clear()
    msgCache.current.clear(); setBodyCodes({})
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

  const startStream = useCallback((addr: string) => {
    stopStream.current?.()
    stopStream.current = null
    setConnected(false)
    try {
      const provider = getProvider(addr)
      const stop = provider.streamInbox(
        addr,
        (msgs) => {
          const mapped = msgs.map(m => ({ ...m, read: readIds.current.has(m.id) || m.read }))
          setMessages(mapped)
          updateMessageCount(addr, mapped.length)
          prefetchRef.current(addr, mapped)
        },
        (status) => setConnected(status),
      )
      stopStream.current = stop
    } catch (e) {
      console.error('No provider for', addr, e)
    }
  }, [])

  const loadInbox = useCallback(async (addr: string) => {
    setLoading(true)
    try {
      const provider = getProvider(addr)
      const msgs = await provider.fetchInbox(addr)
      setMessages(msgs)
      prefetchBodyCodes(addr, msgs)
    } catch (e) {
      console.error('loadInbox failed', e)
    } finally {
      setLoading(false)
    }
  }, [prefetchBodyCodes])

  const didAutoCopyRef = useRef(false)
  useEffect(() => {
    if (route !== '/inbox' || didAutoCopyRef.current) return
    didAutoCopyRef.current = true
    autoCopy(email)
  }, [route]) // eslint-disable-line

  useEffect(() => {
    if (route !== '/inbox') return
    saveToHistory(email)
    loadInbox(email)
    startStream(email)
    return () => { stopStream.current?.(); stopStream.current = null }
  }, [route, email, loadInbox, startStream])

  const selectMessage = async (id: string) => {
    setSelectedId(id); readIds.current.add(id)
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

  const deleteMessage = async (id: string) => {
    try {
      const provider = getProvider(email)
      await provider.deleteMessage?.(email, id)
    } catch {}
    setMessages(m => m.filter(msg => msg.id !== id))
    if (selectedId === id) { setSelectedId(null); setFullMsg(null) }
  }

  const copyEmail = () => { navigator.clipboard.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const newInbox  = (domain?: string) => resetInbox(randomInbox(domain ?? DOMAINS[Math.floor(Math.random() * DOMAINS.length)]))
  const switchToEmail = (addr: string) => { resetInbox(addr); setPanel('inbox') }
  const currentDomain = DOMAINS.find(d => email.endsWith(`@${d}`)) ?? DEFAULT_DOMAIN

  const confirmEditRef = useRef(false)
  const confirmEdit = () => {
    if (confirmEditRef.current) return
    confirmEditRef.current = true
    setTimeout(() => { confirmEditRef.current = false }, 100)
    const v = editValue.trim().toLowerCase(); if (!v) { setEditing(false); return }
    const full = v.includes('@') ? v : `${v}@${editDomain}`
    if (!DOMAINS.some(d => full.endsWith(`@${d}`))) { setEditing(false); return }
    resetInbox(full); setEditing(false)
  }

  const unread = messages.filter(m => !m.read).length

  if (route === '/' || route === '')
    return (
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background" />}>
        <Landing onLaunch={() => { markVisited(); navigate('/inbox') }} />
      </Suspense>
    )

  return (
    <TooltipProvider>
      <div className="relative flex h-dvh flex-col bg-background text-foreground overflow-hidden">
        <Background />

        <header className="relative z-10 flex items-center gap-3 border-b border-border/50 bg-background/70 px-4 py-3 backdrop-blur-md sm:px-5">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 shrink-0 hover:opacity-75 transition-opacity">
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
                    {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <Button size="icon" className="h-8 w-8" onMouseDown={e => e.preventDefault()} onClick={confirmEdit}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => { setEditValue(email.split('@')[0]); setEditDomain(currentDomain); setEditing(true) }}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <span className="max-w-[160px] truncate font-mono text-sm">{email.split('@')[0]}</span>
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

        <div className="relative z-10 flex flex-1 gap-3 overflow-hidden p-3">
          <aside className={cn(
            'flex w-full flex-col overflow-hidden rounded-xl border border-border bg-background/90 shadow-sm backdrop-blur-sm md:w-80 md:shrink-0',
            (selectedId || panel !== 'inbox') && 'hidden md:flex'
          )}>
            <InboxView email={email} messages={messages} loading={loading} connected={connected}
              selected={selectedId} onSelect={selectMessage} onDelete={deleteMessage}
              onRefresh={() => loadInbox(email)} bodyCodes={bodyCodes}
              canDelete={!!ALL_PROVIDERS.find(p => p.domains.some(d => email.endsWith(`@${d}`)))?.deleteMessage}
            />
          </aside>
          <main className={cn(
            'flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background/90 shadow-sm backdrop-blur-sm',
            !selectedId && panel === 'inbox' && 'hidden md:flex'
          )}>
            {panel === 'inbox'   && <MessageView message={fullMsg} loading={msgLoading} onClose={() => { setSelectedId(null); setFullMsg(null) }} onDelete={() => selectedId && deleteMessage(selectedId)} />}
            {panel === 'history' && <HistoryView onSwitch={switchToEmail} onClear={() => {}} />}
          </main>
        </div>

        <footer className="relative z-10 flex items-center justify-center pb-3 pt-2">
          {newMenuOpen && (
            <div
              ref={newMenuRef}
              className="absolute bottom-[calc(100%-4px)] left-1/2 -translate-x-1/2 z-50 min-w-[240px] rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-md overflow-hidden"
            >
              <p className="px-3 pt-3 pb-1.5 text-xs font-semibold text-foreground">New random inbox on…</p>
              {DOMAINS.map(d => {
                const provider = ALL_PROVIDERS.find(p => p.domains.includes(d))
                const tag = provider?.id === 'kilolabs' ? 'own' : provider?.id === 'edu' ? 'edu' : '3rd party'
                return (
                  <button key={d}
                    className="flex w-full items-center justify-between gap-2.5 px-3 py-2.5 hover:bg-muted transition-colors"
                    onClick={e => { e.stopPropagation(); setNewMenuOpen(false); newInbox(d) }}
                  >
                    <div className="flex items-center gap-2">
                      <Shuffle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-mono text-sm font-medium">@{d}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{tag}</span>
                  </button>
                )
              })}
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

          <Dock iconSize={40} iconMagnification={62} iconDistance={130}
            className="mt-0 h-[58px] gap-0.5 rounded-2xl border border-border/60 bg-background/80 px-3 shadow-lg shadow-black/10 backdrop-blur-xl dark:bg-background/70 dark:shadow-black/30">
            <DockIcon onClick={() => { setPanel('inbox'); setSelectedId(null); setFullMsg(null) }}>
              <Tooltip>
                <TooltipTrigger>
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

            <DockIcon onClick={() => setPanel('history')}>
              <Tooltip>
                <TooltipTrigger>
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
                <TooltipTrigger>
                  <div className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-10 rounded-full',
                    newMenuOpen && 'bg-muted text-foreground')}>
                    <Plus className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">New inbox (pick domain)</TooltipContent>
              </Tooltip>
            </DockIcon>

            <DockIcon>
              <Tooltip>
                <TooltipTrigger>
                  <div className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-10 rounded-full')}>
                    <AnimatedThemeToggler asDiv className="flex h-full w-full items-center justify-center text-inherit" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Toggle theme</TooltipContent>
              </Tooltip>
            </DockIcon>
          </Dock>
        </footer>

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
