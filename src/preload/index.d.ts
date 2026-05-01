import {
  BrowserState,
  BookmarkItem,
  HistoryItem,
  DownloadItem,
  BrowserSettings,
  AboutInfo,
  ToastMessage,
  BrowserLayout,
  SidePanelType
} from '../shared/types'

interface FindResult {
  activeMatchOrdinal: number
  matches: number
}

export interface PreloadAPI {
  // Tab commands
  createTab(url?: string): void
  closeTab(tabId: string): void
  switchTab(tabId: string): void
  loadUrl(tabId: string, url: string): void
  goBack(tabId: string): void
  goForward(tabId: string): void
  reload(tabId: string): void
  stop(tabId: string): void
  retryLoad(tabId: string): void
  zoomIn(tabId: string): void
  zoomOut(tabId: string): void
  zoomReset(tabId: string): void
  togglePin(tabId: string): void
  restoreClosed(): void
  moveTab(tabId: string, toIndex: number): void
  openUrl(url: string, newTab?: boolean): void
  tabContextMenu(tabId: string): Promise<void>
  duplicateTab(tabId: string): Promise<void>
  closeOtherTabs(tabId: string): Promise<void>
  closeTabsToRight(tabId: string): Promise<void>

  // Layout
  setUiHeight(height: number): void
  setLayout(layout: BrowserLayout): void
  showPanel(type: SidePanelType): void
  hidePanel(): void

  // Find
  findStart(tabId: string, text: string, options?: { forward?: boolean; matchCase?: boolean }): void
  findNext(tabId: string, forward: boolean): void
  findStop(tabId: string, action: 'clearSelection' | 'keepSelection'): void

  // Bookmarks
  addBookmark(url: string, title: string, favicon: string): Promise<BookmarkItem>
  removeBookmark(url: string): Promise<void>
  getBookmarks(): Promise<BookmarkItem[]>
  updateBookmark(id: string, title: string, url: string): Promise<BookmarkItem[]>
  clearBookmarks(): Promise<void>

  // History
  getHistory(limit?: number, query?: string): Promise<HistoryItem[]>
  clearHistory(): Promise<void>
  removeHistoryEntry(id: string): Promise<void>

  // Downloads
  getDownloads(): Promise<DownloadItem[]>
  openDownloadFile(downloadId: string): Promise<void>
  showInFolder(downloadId: string): Promise<void>
  showDownloadInFolder(downloadId: string): Promise<void>
  removeDownload(downloadId: string): Promise<void>
  clearDownloads(): Promise<void>

  // Settings
  getSettings(): Promise<BrowserSettings>
  updateSettings(settings: Partial<BrowserSettings>): Promise<BrowserSettings>
  resetSettings(): Promise<BrowserSettings>
  selectDownloadPath(): Promise<string | null>
  openUserDataFolder(): Promise<void>

  // Browser state
  getBrowserState(): Promise<BrowserState>
  getAboutInfo(): Promise<AboutInfo>
  copyToClipboard(text: string): Promise<void>

  // Listeners
  onBrowserState(callback: (state: BrowserState) => void): () => void
  onFocusAddressBar(callback: () => void): () => void
  onFocusFind(callback: () => void): () => void
  onToggleBookmark(callback: () => void): () => void
  onFindResult(callback: (result: FindResult) => void): () => void
  onDownloadUpdate(callback: (item: DownloadItem) => void): () => void
  onToast(callback: (msg: ToastMessage) => void): () => void
  onSettings(callback: (settings: BrowserSettings) => void): () => void
  onOpenHistoryPanel(callback: () => void): () => void
  onOpenBookmarksPanel(callback: () => void): () => void
  onOpenDownloadsPanel(callback: () => void): () => void
  onOpenSettingsPanel(callback: () => void): () => void
  onOpenAboutPanel(callback: () => void): () => void
  onAddBookmark(callback: () => void): () => void
  onClearDataConfirm(callback: () => void): () => void
  onPanelType(callback: (type: SidePanelType) => void): () => void
  onPanelClosed(callback: () => void): () => void
}

declare global {
  interface Window {
    api: PreloadAPI
    __closePanel?: () => void
  }
}
