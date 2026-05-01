export interface LoadError {
  url: string
  errorCode: number
  errorDescription: string
}

export interface TabState {
  id: string
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: LoadError | null
  zoomFactor: number
}

export interface BrowserState {
  tabs: TabState[]
  activeTabId: string
}

export interface BookmarkItem {
  url: string
  title: string
  favicon: string
  createdAt: number
}

export interface HistoryItem {
  url: string
  title: string
  visitedAt: number
}

export type DownloadState = 'progressing' | 'completed' | 'cancelled' | 'interrupted'

export interface DownloadItem {
  id: string
  filename: string
  url: string
  totalBytes: number
  receivedBytes: number
  state: DownloadState
  savePath: string
}

export interface PersistedSession {
  tabs: {
    url: string
    title: string
  }[]
  activeIndex: number
}

export type ZoomAction = 'in' | 'out' | 'reset'
