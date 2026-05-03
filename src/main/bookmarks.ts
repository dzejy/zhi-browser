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
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    folder: typeof item.folder === 'string' && item.folder.trim() ? item.folder.trim() : '未分类'
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
    createdAt: Date.now(),
    folder: item.folder || '未分类'
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
  updates: { title?: string; url?: string; folder?: string; favicon?: string }
): BookmarkItem[] {
  const bookmarks = getBookmarks()
  const index = bookmarks.findIndex((b) => b.id === id || b.url === id)
  if (index === -1) return bookmarks

  const current = bookmarks[index]
  const nextUrl = updates.url?.trim() || current.url
  const nextTitle = updates.title?.trim() || current.title || nextUrl
  const nextFolder = updates.folder?.trim() || current.folder || '未分类'

  bookmarks[index] = {
    ...current,
    id: makeBookmarkId(nextUrl),
    title: nextTitle,
    url: nextUrl,
    folder: nextFolder,
    favicon: updates.favicon ?? current.favicon
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

export function addManagedBookmark(entry: {
  url: string
  title: string
  folder?: string
  favicon?: string
}): BookmarkItem {
  return addBookmark({
    id: makeBookmarkId(entry.url),
    url: entry.url,
    title: entry.title,
    favicon: entry.favicon || '',
    folder: entry.folder || '未分类'
  })
}

export function removeBookmarks(ids: string[]): void {
  const idSet = new Set(ids)
  const bookmarks = getBookmarks()
  cache = bookmarks.filter((item) => !idSet.has(item.id || '') && !idSet.has(item.url))
  writeJSON(BOOKMARKS_FILE, cache)
}

export function getBookmarkFolders(): string[] {
  return [...new Set(getBookmarks().map((bookmark) => bookmark.folder || '未分类'))]
}

export function getManagedBookmarks(options?: {
  folder?: string
  search?: string
}): BookmarkItem[] {
  let results = [...getBookmarks()]
  if (options?.folder) {
    results = results.filter((bookmark) => (bookmark.folder || '未分类') === options.folder)
  }
  if (options?.search) {
    const keyword = options.search.toLowerCase()
    results = results.filter(
      (bookmark) =>
        bookmark.title.toLowerCase().includes(keyword) ||
        bookmark.url.toLowerCase().includes(keyword)
    )
  }
  return results
}

export function searchBookmarks(keyword: string): BookmarkItem[] {
  return getManagedBookmarks({ search: keyword }).slice(0, 50)
}

export function getBookmarksForAI(
  query: string
): Array<{ title: string; url: string; folder: string }> {
  const lower = query.toLowerCase()
  return getBookmarks()
    .filter(
      (bookmark) =>
        bookmark.title.toLowerCase().includes(lower) || bookmark.url.toLowerCase().includes(lower)
    )
    .slice(0, 20)
    .map((bookmark) => ({
      title: bookmark.title,
      url: bookmark.url,
      folder: bookmark.folder || '未分类'
    }))
}
