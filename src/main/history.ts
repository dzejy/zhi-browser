import { HistoryItem } from '../shared/types'
import { readJSON, writeJSON } from './storage'
import { getSettings } from './settings'

const HISTORY_FILE = 'history.json'
const MAX_HISTORY = 2000

let cache: HistoryItem[] | null = null

function makeHistoryId(url: string, visitedAt: number): string {
  return `${visitedAt}:${url}`
}

function normalizeHistoryItem(item: Partial<HistoryItem>): HistoryItem | null {
  if (typeof item.url !== 'string' || !item.url.trim()) return null
  const url = item.url.trim()
  const visitedAt = typeof item.visitedAt === 'number' ? item.visitedAt : Date.now()
  const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : url

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : makeHistoryId(url, visitedAt),
    url,
    title,
    visitedAt
  }
}

export function getHistory(limit?: number, query?: string): HistoryItem[] {
  if (cache === null) {
    cache = readJSON<Partial<HistoryItem>[]>(HISTORY_FILE, [])
      .map(normalizeHistoryItem)
      .filter((item): item is HistoryItem => item !== null)
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
  if (!getSettings().saveHistory) return
  if (!url || url === 'about:blank') return

  const history = getHistory()
  const visitedAt = Date.now()

  // Find existing entry for this URL
  const existingIdx = history.findIndex((h) => h.url === url)

  if (existingIdx >= 0) {
    // Update existing entry: bump to top, update title if better
    const existing = history[existingIdx]
    const betterTitle =
      title && title !== 'New Tab' && title !== '新标签页' && title !== url ? title : existing.title
    history.splice(existingIdx, 1)
    history.unshift({ id: makeHistoryId(url, visitedAt), url, title: betterTitle, visitedAt })
  } else {
    const item: HistoryItem = { id: makeHistoryId(url, visitedAt), url, title, visitedAt }
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

export function removeHistoryEntry(id: string): void {
  const history = getHistory()
  cache = history.filter((item) => item.id !== id && item.url !== id)
  writeJSON(HISTORY_FILE, cache)
}
