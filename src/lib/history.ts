export const HISTORY_KEY = "kilomail_history"
export const MAX_HISTORY = 50

export interface HistoryEntry {
  email: string
  usedAt: number
  count: number
  messageCount: number
}

export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function saveToHistory(email: string) {
  const hist = loadHistory()
  const idx = hist.findIndex(e => e.email === email)
  if (idx >= 0) {
    hist[idx].usedAt = Date.now()
    hist[idx].count += 1
  } else {
    hist.unshift({ email, usedAt: Date.now(), count: 1, messageCount: 0 })
  }
  const trimmed = hist.sort((a, b) => b.usedAt - a.usedAt).slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
}

export function updateMessageCount(email: string, count: number) {
  const hist = loadHistory()
  const idx = hist.findIndex(e => e.email === email)
  if (idx >= 0 && hist[idx].messageCount !== count) {
    hist[idx].messageCount = count
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}
