import type {
  BookmarkItem,
  BrowserState,
  DownloadItem,
  HistoryItem,
  ZoomAction
} from '../shared/types'

export interface ZhiBrowserAPI {
  createTab: (url?: string) => void
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
  loadUrl: (tabId: string, url: string) => void
  goBack: (tabId: string) => void
  goForward: (tabId: string) => void
  reload: (tabId: string) => void
  stop: (tabId: string) => void
  zoom: (tabId: string, action: ZoomAction) => void
  requestState: () => void
  addBookmark: (bookmark: Omit<BookmarkItem, 'createdAt'>) => Promise<BookmarkItem | null>
  removeBookmark: (url: string) => Promise<boolean>
  listBookmarks: () => Promise<BookmarkItem[]>
  listHistory: (limit?: number) => Promise<HistoryItem[]>
  clearHistory: () => Promise<boolean>
  onBrowserState: (callback: (state: BrowserState) => void) => () => void
  onFocusAddressBar: (callback: () => void) => () => void
  onDownloadUpdate: (callback: (download: DownloadItem) => void) => () => void
}

declare global {
  interface Window {
    api: ZhiBrowserAPI
  }
}
