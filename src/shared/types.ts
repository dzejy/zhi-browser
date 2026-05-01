// src/shared/types.ts

export interface TabState {
  id: string
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: LoadError | null
  isPinned: boolean
  zoomFactor: number
  isNewTab: boolean
}

export interface LoadError {
  url: string
  errorCode: number
  errorDescription: string
}

export interface RecentlyClosedTab {
  id?: string
  url: string
  title: string
  favicon: string
  closedAt: number
}

export interface BrowserState {
  tabs: TabState[]
  activeTabId: string
  findState: FindState | null
  downloads: DownloadItem[]
  recentlyClosed: RecentlyClosedTab[]
  toast?: ToastMessage
}

export interface FindState {
  tabId: string
  text: string
  activeMatchOrdinal: number
  matches: number
}

export interface BookmarkItem {
  id?: string
  url: string
  title: string
  favicon: string
  createdAt: number
}

export interface HistoryItem {
  id?: string
  url: string
  title: string
  visitedAt: number
}

export interface DownloadItem {
  id: string
  filename: string
  url: string
  totalBytes: number
  receivedBytes: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  savePath: string
  startedAt: number
}

export interface BrowserSettings {
  searchEngine: 'google' | 'bing' | 'baidu' | 'duckduckgo'
  homepage: string
  newTabBehavior: 'homepage' | 'blank'
  restoreSession: boolean
  downloadPath: string
  askWhereToSaveBeforeDownloading: boolean
  saveHistory: boolean
  saveDownloadsHistory: boolean
  devToolsEnabled: boolean
}

export interface AboutInfo {
  appName: string
  appVersion: string
  electronVersion: string
  chromiumVersion: string
  nodeVersion: string
  userDataPath: string
}

export interface ToastMessage {
  id: string
  text: string
  duration: number
}

export interface PersistedSession {
  tabs: { url: string; title: string; isPinned: boolean }[]
  activeIndex: number
}

export type ZoomAction = 'in' | 'out' | 'reset'

export type SidePanelType = 'bookmarks' | 'history' | 'downloads' | 'settings' | 'about'

export interface BrowserLayout {
  uiViewHeight: number
  pageTop: number
}
