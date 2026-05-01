import { BookmarkItem } from '../shared/types'
import { readJSON, writeJSON } from './storage'

const BOOKMARKS_FILE = 'bookmarks.json'

let cache: BookmarkItem[] | null = null

function makeBookmarkId(url: string): string {
  return url
}

function normalizeBookmark(item: Partial<BookmarkItem>): BookmarkItem | null {
  if (typeof item.url !== 'string' || !item.url.trim()) return null
  const url = item.url.trim()
  const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : url

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : makeBookmarkId(url),
    url,
    title,
    favicon: typeof item.favicon === 'string' ? item.favicon : '',
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
  }
}

export function getBookmarks(): BookmarkItem[] {
  if (cache === null) {
    cache = readJSON<Partial<BookmarkItem>[]>(BOOKMARKS_FILE, [])
      .map(normalizeBookmark)
      .filter((item): item is BookmarkItem => item !== null)
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
    id: makeBookmarkId(item.url),
    createdAt: Date.now()
  }
  bookmarks.unshift(newItem)
  cache = bookmarks
  writeJSON(BOOKMARKS_FILE, bookmarks)
  return newItem
}

export function removeBookmark(url: string): void {
  const bookmarks = getBookmarks()
  cache = bookmarks.filter((b) => b.url !== url && b.id !== url)
  writeJSON(BOOKMARKS_FILE, cache)
}

export function updateBookmark(
  id: string,
  updates: { title?: string; url?: string }
): BookmarkItem[] {
  const bookmarks = getBookmarks()
  const index = bookmarks.findIndex((b) => b.id === id || b.url === id)
  if (index === -1) return bookmarks

  const current = bookmarks[index]
  const nextUrl = updates.url?.trim() || current.url
  const nextTitle = updates.title?.trim() || current.title || nextUrl

  bookmarks[index] = {
    ...current,
    id: makeBookmarkId(nextUrl),
    title: nextTitle,
    url: nextUrl
  }
  cache = bookmarks
  writeJSON(BOOKMARKS_FILE, bookmarks)
  return bookmarks
}

export function clearBookmarks(): void {
  cache = []
  writeJSON(BOOKMARKS_FILE, [])
}

export function isBookmarked(url: string): boolean {
  return getBookmarks().some((b) => b.url === url)
}
