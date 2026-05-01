import { HistoryItem } from '../shared/types'
import { readJSON, writeJSON } from './storage'

const HISTORY_FILE = 'history.json'
const MAX_HISTORY = 2000

let cache: HistoryItem[] | null = null

export function getHistory(limit?: number, query?: string): HistoryItem[] {
  if (cache === null) {
    cache = readJSON<HistoryItem[]>(HISTORY_FILE, [])
  }
  let results = cache
  if (query) {
    const q = query.toLowerCase()
    results = results.filter(
      (h) => h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q)
    )
  }
  if (limit && limit > 0) {
    results = results.slice(0, limit)
  }
  return results
}

export function addHistory(url: string, title: string): void {
  if (!url || url === 'about:blank') return

  const history = getHistory()

  // Find existing entry for this URL
  const existingIdx = history.findIndex((h) => h.url === url)

  if (existingIdx >= 0) {
    // Update existing entry: bump to top, update title if better
    const existing = history[existingIdx]
    const betterTitle = title && title !== 'New Tab' && title !== url ? title : existing.title
    history.splice(existingIdx, 1)
    history.unshift({ url, title: betterTitle, visitedAt: Date.now() })
  } else {
    const item: HistoryItem = { url, title, visitedAt: Date.now() }
    history.unshift(item)
  }

  // Limit count
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY
  }

  cache = history
  writeJSON(HISTORY_FILE, history)
}

export function clearHistory(): void {
  cache = []
  writeJSON(HISTORY_FILE, [])
}
