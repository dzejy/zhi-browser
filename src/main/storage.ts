import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { BookmarkItem, HistoryItem, PersistedSession } from '../shared/types'

const SESSION_FILE = 'session.json'
const BOOKMARKS_FILE = 'bookmarks.json'
const HISTORY_FILE = 'history.json'
const HISTORY_LIMIT = 1000

const EMPTY_SESSION: PersistedSession = {
  tabs: [],
  activeIndex: 0
}

export class BrowserStorage {
  private readonly basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  readSession(): PersistedSession {
    return this.readJson<PersistedSession>(SESSION_FILE, EMPTY_SESSION)
  }

  saveSession(session: PersistedSession): void {
    this.writeJson(SESSION_FILE, session)
  }

  listBookmarks(): BookmarkItem[] {
    return this.readJson<BookmarkItem[]>(BOOKMARKS_FILE, [])
  }

  addBookmark(bookmark: BookmarkItem): BookmarkItem {
    const bookmarks = this.listBookmarks()
    const existingIndex = bookmarks.findIndex((item) => item.url === bookmark.url)

    if (existingIndex >= 0) {
      bookmarks[existingIndex] = {
        ...bookmarks[existingIndex],
        title: bookmark.title || bookmarks[existingIndex].title,
        favicon: bookmark.favicon || bookmarks[existingIndex].favicon
      }
    } else {
      bookmarks.unshift(bookmark)
    }

    this.writeJson(BOOKMARKS_FILE, bookmarks)
    return existingIndex >= 0 ? bookmarks[existingIndex] : bookmark
  }

  removeBookmark(url: string): boolean {
    const bookmarks = this.listBookmarks()
    const nextBookmarks = bookmarks.filter((bookmark) => bookmark.url !== url)

    if (nextBookmarks.length === bookmarks.length) {
      return false
    }

    this.writeJson(BOOKMARKS_FILE, nextBookmarks)
    return true
  }

  listHistory(limit = HISTORY_LIMIT): HistoryItem[] {
    const history = this.readJson<HistoryItem[]>(HISTORY_FILE, [])
    return history.slice(0, Math.max(0, limit))
  }

  addHistory(item: HistoryItem): void {
    const history = this.readJson<HistoryItem[]>(HISTORY_FILE, [])
    const nextHistory = [item, ...history.filter((entry) => entry.url !== item.url)].slice(
      0,
      HISTORY_LIMIT
    )

    this.writeJson(HISTORY_FILE, nextHistory)
  }

  clearHistory(): void {
    this.writeJson(HISTORY_FILE, [])
  }

  private readJson<T>(fileName: string, fallback: T): T {
    try {
      const filePath = this.getFilePath(fileName)

      if (!existsSync(filePath)) {
        return fallback
      }

      return JSON.parse(readFileSync(filePath, 'utf-8')) as T
    } catch (error) {
      console.warn(`Failed to read ${fileName}`, error)
      return fallback
    }
  }

  private writeJson<T>(fileName: string, value: T): void {
    try {
      mkdirSync(this.basePath, { recursive: true })
      writeFileSync(this.getFilePath(fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
    } catch (error) {
      console.warn(`Failed to write ${fileName}`, error)
    }
  }

  private getFilePath(fileName: string): string {
    return join(this.basePath, fileName)
  }
}
