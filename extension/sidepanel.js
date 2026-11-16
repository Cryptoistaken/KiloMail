// KiloMail side panel — talks straight to the public API on https://kilomail.tech
// (own domains only: real-time SSE, delete, 30-day retention, no key, no CORS problem).

const BASE = 'https://kilomail.tech'

// Same four domains the site marks "own" (src/providers/kilolabs.provider.ts).
const OWN_DOMAINS = ['kilomail.tech', 'kilomail.my.id', 'kilosms.web.id', 'factoryai.tech']

const EMAIL_KEY = 'kilomail_current_email'
const THEME_KEY = 'theme'

const $ = (id) => document.getElementById(id)
const el = {
  theme: $('theme'), openTab: $('open-tab'),
  newAddr: $('new'), addr: $('addr'), addrName: $('addr-name'), addrDomain: $('addr-domain'),
  copy: $('copy'),
  editor: $('editor'), editName: $('edit-name'), editDomain: $('edit-domain'), editSave: $('edit-save'),
  count: $('count'), live: $('live'), liveText: $('live-text'), refresh: $('refresh'),
  list: $('list'), msg: $('msg'), toast: $('toast'),
}

const icon = (name, cls = 'icon') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/* ---------------------------------------------------------------- storage */

const load = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, v) } catch { /* quota / private mode */ } }

/* ------------------------------------------------------------------ names */

const FIRST = ['james','mary','john','patricia','robert','jennifer','michael','linda','william','elizabeth','david','susan','richard','jessica','joseph','sarah','thomas','karen','charles','emily','daniel','olivia','matthew','sophia','andrew','isabella','joshua','mia','ethan','charlotte','ryan','amelia','kevin','harper','benjamin','evelyn','samuel','abigail','henry','luna','owen','nora','jack','hazel','liam','riley','noah','layla','lucas','claire']
const LAST = ['smith','johnson','williams','brown','jones','garcia','miller','davis','wilson','taylor','anderson','thomas','jackson','white','harris','martin','thompson','robinson','clark','lewis','walker','hall','allen','young','king','wright','scott','green','baker','adams','nelson','carter','mitchell','perez','roberts','turner','phillips','campbell','parker','evans','edwards','collins','stewart','sanchez','morris','rogers','reed','cook','morgan','bell']

const pick = (a) => a[Math.floor(Math.random() * a.length)]

function randomName() {
  const f = pick(FIRST), l = pick(LAST)
  const fmt = Math.floor(Math.random() * 3)
  let base = fmt === 0 ? f + l : fmt === 1 ? f[0] + l : f + l[0].toUpperCase() + l.slice(1)
  if (Math.random() < 0.4) base += Math.floor(100 + Math.random() * 900)
  return base
}

/* ------------------------------------------------------------------ state */

let email = (() => {
  const saved = load(EMAIL_KEY, '')
  if (saved && OWN_DOMAINS.some((d) => saved.endsWith('@' + d))) return saved
  const fresh = `${randomName()}@${OWN_DOMAINS[0]}`
  save(EMAIL_KEY, fresh)
  return fresh
})()

let messages = []
let selectedId = null
let fullMsg = null
let connected = false
let loading = true
let refreshing = false
let busyNew = false

const cache = new Map()          // id -> full message
const readIds = new Set()
const bodyCodes = {}             // id -> code lifted out of the body
let stopStream = null

const AVATAR = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#d946ef', '#f97316']
const SUBJECT_CODE = /\b(\d{4,8})\b/

const currentDomain = () => email.split('@')[1] || OWN_DOMAINS[0]
const inboxUrl = () => `${BASE}/api/inbox/${encodeURIComponent(email)}`

/* -------------------------------------------------------------------- api */

async function loadInbox({ silent = false } = {}) {
  if (!silent) { loading = true; render() }
  try {
    const r = await fetch(inboxUrl(), { cache: 'no-store' })
    const data = await r.json()
    if (Array.isArray(data)) applyMessages(data)
  } catch { /* offline — keep what we have */ }
  finally { loading = false; render() }
}

function applyMessages(list) {
  messages = list.map((m) => ({ ...m, read: readIds.has(m.id) || m.read }))
  render()
  prefetchCodes()
}

function startStream() {
  stopStream?.()
  stopStream = null
  connected = false
  setLive(false)
  try {
    const es = new EventSource(`${inboxUrl()}/stream`)
    es.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === 'connected') setLive(true)
      if (d.type === 'update') applyMessages(d.messages || [])
    }
    es.onerror = () => setLive(false)
    stopStream = () => es.close()
  } catch { /* EventSource unavailable */ }
}

async function fetchFull(meta) {
  if (cache.has(meta.id)) return cache.get(meta.id)
  try {
    const r = await fetch(`${inboxUrl()}/${encodeURIComponent(meta.id)}`, { cache: 'no-store' })
    if (!r.ok) return null
    const full = await r.json()
    cache.set(meta.id, full)
    return full
  } catch { return null }
}

/* -------------------------------------------------------- one-time codes */

function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function extractCode(text, html) {
  const src = text.trim() ? text : stripHtml(html)
  const patterns = [
    /confirmation\s+code(?:\s+in\s+the\s+app)?[^\d]+(\d{4,8})/i,
    /(?:code|verification|otp|pin|confirmation|token)[^\d]*(\d{4,8})\b/i,
    /\b(\d{4,8})\b/,
  ]
  for (const p of patterns) {
    const m = src.match(p)
    if (m) return m[1] ?? m[0]
  }
  return null
}

async function prefetchCodes() {
  const targets = messages
    .filter((m) => !bodyCodes[m.id] && !SUBJECT_CODE.test(m.subject || '') && !cache.has(m.id))
    .slice(0, 5)
  if (!targets.length) return
  let found = false
  await Promise.all(targets.map(async (m) => {
    const full = await fetchFull(m)
    if (!full) return
    const code = extractCode(full.text || '', full.html || '')
    if (code) { bodyCodes[m.id] = code; found = true }
  }))
  if (found) render()   // only re-draw when a code actually appeared
}

const codeFor = (m) => bodyCodes[m.id] ?? (m.subject?.match(SUBJECT_CODE)?.[1] ?? null)

/* ------------------------------------------------------------------ theme */

function applyTheme(t) {
  document.documentElement.classList.toggle('dark', t === 'dark')
  el.theme.innerHTML = icon(t === 'dark' ? 'sun' : 'moon')
  save(THEME_KEY, t)
}

/* --------------------------------------------------------------- rendering */

function avatarStyle(seed) {
  const s = String(seed || '?')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const c = AVATAR[h % AVATAR.length]
  return `background:${c}26;color:${c}`
}

function setLive(on) {
  connected = on
  el.live.classList.toggle('on', on)
  el.liveText.textContent = on ? 'live' : 'reconnecting…'
}

function render() {
  el.addrName.textContent = email.split('@')[0]
  el.addrDomain.textContent = '@' + currentDomain()
  el.count.textContent = loading
    ? 'loading…'
    : `${messages.length} message${messages.length === 1 ? '' : 's'}`

  if (loading) { el.list.innerHTML = skeletons(); return }
  if (!messages.length) { el.list.innerHTML = emptyState(); return }
  el.list.innerHTML = messages.map(rowHtml).join('')
}

function rowHtml(m) {
  const code = codeFor(m)
  const initial = (m.from || '?').trim()[0]?.toUpperCase() ?? '?'
  return `<div class="row${m.read ? '' : ' unread'}${m.id === selectedId ? ' selected' : ''}" data-open="${esc(m.id)}" role="button" tabindex="0">
    <div class="avatar" style="${avatarStyle(m.from)}">${esc(initial)}</div>
    <div class="row-main">
      <div class="row-top">
        <div class="row-from">${m.read ? '' : '<span class="dot"></span>'}<span class="from">${esc(m.from)}</span></div>
        <span class="ago">${esc(m.timeAgo || '')}</span>
      </div>
      <p class="subject">${esc(m.subject || '(no subject)')}</p>
    </div>
    ${code ? `<button class="chip" data-code="${esc(code)}" title="Copy code ${esc(code)}">${icon('copy')}${esc(code)}</button>` : ''}
    <button class="row-del" data-del="${esc(m.id)}" title="Delete message" aria-label="Delete message">${icon('trash')}</button>
  </div>`
}

function skeletons() {
  return Array.from({ length: 4 }, () => `<div class="skel-row">
    <div class="skel" style="width:30px;height:30px;border-radius:50%"></div>
    <div style="flex:1">
      <div class="skel" style="width:55%;height:12px;margin-bottom:7px"></div>
      <div class="skel" style="width:80%;height:10px"></div>
    </div>
  </div>`).join('')
}

function emptyState() {
  return `<div class="empty">
    <div class="empty-badge">${icon('inbox')}</div>
    <b>Inbox is empty</b>
    <p>Send an email to<br><code>${esc(email)}</code><br>and it will appear here in seconds.</p>
  </div>`
}

/* ----------------------------------------------------------- message view */

function renderMessage() {
  if (selectedId === null) {
    el.msg.hidden = true
    el.list.hidden = false
    el.msg.innerHTML = ''
    return
  }
  el.list.hidden = true
  el.msg.hidden = false

  const m = fullMsg
  const meta = messages.find((x) => x.id === selectedId)
  const subject = esc(m?.subject || meta?.subject || '(no subject)')
  const from = esc(m?.from || meta?.from || '')
  const when = new Date(m?.receivedAt || meta?.receivedAt || Date.now()).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  if (!m) {
    el.msg.innerHTML = `<div class="msg-head"><div class="msg-headline">
        <button class="icon-btn" data-close title="Back">${icon('back')}</button>
        <div class="title"><p class="subject">${subject}</p><p class="from">${from}</p></div>
      </div></div>
      <div class="msg-placeholder">${icon('loader', 'icon spin')}Loading…</div>`
    return
  }

  const canSwitch = !!(m.html && m.text)
  el.msg.innerHTML = `<div class="msg-head">
      <div class="msg-headline">
        <button class="icon-btn" data-close title="Back">${icon('back')}</button>
        <div class="title"><p class="subject">${subject}</p><p class="from">${from}</p></div>
        <button class="icon-btn" data-del="${esc(selectedId)}" title="Delete message">${icon('trash')}</button>
      </div>
      ${canSwitch ? `<div class="tabs">
        <button class="tab on" data-view="html">HTML</button>
        <button class="tab" data-view="text">Plain text</button>
        <span class="when">${esc(when)}</span>
      </div>` : `<div class="tabs"><span class="when">${esc(when)}</span></div>`}
    </div>
    <div class="msg-body" id="body"></div>`

  paintBody(m, m.html ? 'html' : 'text')
  el.msg.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      el.msg.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t))
      paintBody(m, t.dataset.view)
    }))
}

function paintBody(m, view) {
  const body = $('body')
  if (!body) return
  if (view === 'html' && m.html) {
    const frame = document.createElement('iframe')
    // allow-same-origin so we can rewrite every link; scripts stay off (sandbox + extension CSP),
    // and clicks are forwarded to a real tab, which is what a side panel cannot do itself.
    frame.setAttribute('sandbox', 'allow-same-origin')
    frame.setAttribute('referrerpolicy', 'no-referrer')
    frame.title = 'Email body'
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:14px;font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
        font-size:13px;line-height:1.65;background:#fff;color:#111;word-break:break-word}
      a{color:#2563eb}img{max-width:100%}
    </style></head><body>${String(m.html).replace(/<a\s(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ')}</body></html>`
    frame.addEventListener('load', () => {
      const doc = frame.contentDocument
      if (!doc) return
      doc.addEventListener('click', (e) => {
        const a = e.target?.closest?.('a')
        if (!a) return
        e.preventDefault()
        openExternal(a.href)
      })
      doc.addEventListener('submit', (e) => e.preventDefault())
    })
    body.replaceChildren(frame)
  } else {
    const pre = document.createElement('pre')
    pre.innerHTML = linkify(m.text || '(empty body)')
    body.replaceChildren(pre)
  }
}

function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, (u) => {
    const href = u.replace(/[.,!?;:)]+$/, '')
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`
  })
}

function openExternal(url) {
  if (/^https?:\/\//i.test(url)) chrome.tabs.create({ url })
}

async function openMessage(id) {
  selectedId = id
  readIds.add(id)
  messages = messages.map((m) => (m.id === id ? { ...m, read: true } : m))
  render()
  fullMsg = cache.get(id) ?? null
  renderMessage()
  if (fullMsg) return
  const meta = messages.find((m) => m.id === id)
  const full = meta ? await fetchFull(meta) : null
  if (selectedId !== id) return          // user moved on while we loaded
  fullMsg = full
  renderMessage()
}

function closeMessage() {
  selectedId = null
  fullMsg = null
  renderMessage()
  render()
}

async function removeMessage(id) {
  const row = el.list.querySelector(`[data-open="${CSS.escape(id)}"]`)
  row?.classList.add('removing')
  messages = messages.filter((m) => m.id !== id)
  cache.delete(id)
  delete bodyCodes[id]
  if (selectedId === id) closeMessage()
  render()
  try { await fetch(`${inboxUrl()}/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
  catch { toast('Could not delete') }
}

/* ------------------------------------------------------------ address glue */

function flashPill() {
  el.addr.classList.remove('flash')
  void el.addr.offsetWidth
  el.addr.classList.add('flash')
}

function setEmail(next) {
  email = next
  save(EMAIL_KEY, next)
  messages = []
  selectedId = null
  fullMsg = null
  cache.clear()
  readIds.clear()
  for (const k of Object.keys(bodyCodes)) delete bodyCodes[k]
  closeEditor()
  renderMessage()
  render()
  flashPill()
  loadInbox()
  startStream()
}

function newAddress(domain = currentDomain()) {
  if (busyNew) return
  busyNew = true
  el.newAddr.disabled = true
  setEmail(`${randomName()}@${domain}`)
  setTimeout(() => { busyNew = false; el.newAddr.disabled = false }, 400)
}

function openEditor() {
  const [name, domain] = email.split('@')
  el.editName.value = name
  el.editDomain.replaceChildren(...OWN_DOMAINS.map((d) => new Option('@' + d, d)))
  el.editDomain.value = domain
  el.editor.hidden = false
  el.editName.focus()
  el.editName.select()
}

function closeEditor() { el.editor.hidden = true }

function confirmEdit() {
  const v = el.editName.value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  if (!v) { closeEditor(); return }
  setEmail(`${v}@${el.editDomain.value}`)
}

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(email)
    el.copy.innerHTML = icon('check')
    el.copy.classList.add('done')
    setTimeout(() => { el.copy.innerHTML = icon('copy'); el.copy.classList.remove('done') }, 1400)
    toast('Address copied')
  } catch { toast('Copy failed') }
}

let toastTimer
function toast(text) {
  el.toast.textContent = text
  el.toast.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.toast.hidden = true }, 1600)
}

/* ------------------------------------------------------------------ events */

el.theme.addEventListener('click', () =>
  applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'))

el.openTab.addEventListener('click', () => chrome.tabs.create({ url: `${BASE}/#/inbox` }))

el.newAddr.addEventListener('click', () => newAddress())
el.copy.addEventListener('click', copyAddress)
el.addr.addEventListener('click', openEditor)
el.editSave.addEventListener('click', confirmEdit)
el.editName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmEdit()
  if (e.key === 'Escape') closeEditor()
})

el.refresh.addEventListener('click', async () => {
  if (refreshing) return
  refreshing = true
  el.refresh.classList.add('spin')
  const started = Date.now()
  try { await loadInbox({ silent: true }) } finally {
    // a fetch here takes ~50ms — too fast to see, so hold the spin for 600ms
    const left = 600 - (Date.now() - started)
    if (left > 0) await new Promise((r) => setTimeout(r, left))
    el.refresh.classList.remove('spin')
    refreshing = false
  }
})

el.list.addEventListener('click', (e) => {
  const codeChip = e.target.closest('[data-code]')
  if (codeChip) {
    navigator.clipboard.writeText(codeChip.dataset.code).then(() => {
      codeChip.classList.add('copied')
      codeChip.innerHTML = `${icon('check')}Copied`
      toast('Code copied')
      setTimeout(() => render(), 1200)
    }).catch(() => toast('Copy failed'))
    return
  }
  const del = e.target.closest('[data-del]')
  if (del) { removeMessage(del.dataset.del); return }
  const row = e.target.closest('[data-open]')
  if (row) openMessage(row.dataset.open)
})

el.list.addEventListener('keydown', (e) => {
  const row = e.target.closest('[data-open]')
  if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openMessage(row.dataset.open) }
})

el.msg.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { closeMessage(); return }
  const del = e.target.closest('[data-del]')
  if (del) { removeMessage(del.dataset.del); return }
  const link = e.target.closest('a[href]')
  if (link) { e.preventDefault(); openExternal(link.href) }
})

// New address when the panel is reopened in a fresh session is handled by the stored email.

/* -------------------------------------------------------------------- init */

el.theme.innerHTML = icon('moon')
el.newAddr.innerHTML = icon('shuffle')
el.copy.innerHTML = icon('copy')
el.refresh.innerHTML = icon('refresh')
el.openTab.innerHTML = icon('external')
el.editSave.innerHTML = icon('check')

applyTheme(load(THEME_KEY, matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
render()
loadInbox()
startStream()
