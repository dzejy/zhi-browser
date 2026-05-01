import { BookmarkItem } from '../shared/types'
import { readJSON, writeJSON } from './storage'

const BOOKMARKS_FILE = 'bookmarks.json'

let cache: BookmarkItem[] | null = null

export function getBookmarks(): BookmarkItem[] {
  if (cache === null) {
    cache = readJSON<BookmarkItem[]>(BOOKMARKS_FILE, [])
  }
  return cache
}

export function addBookmark(item: Omit<BookmarkItem, 'createdAt'>): BookmarkItem {
  const bookmarks = getBookmarks()
  // 去重
  const existing = bookmarks.find((b) => b.url === item.url)
  if (existing) return existing

  const newItem: BookmarkItem = {
    ...item,
    createdAt: Date.now()
  }
  bookmarks.unshift(newItem)
  cache = bookmarks
  writeJSON(BOOKMARKS_FILE, bookmarks)
  return newItem
}

export function removeBookmark(url: string): void {
  const bookmarks = getBookmarks()
  cache = bookmarks.filter((b) => b.url !== url)
  writeJSON(BOOKMARKS_FILE, cache)
}

export function isBookmarked(url: string): boolean {
  return getBookmarks().some((b) => b.url === url)
}
