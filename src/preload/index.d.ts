import {
  BrowserState,
  BookmarkItem,
  HistoryItem,
  DownloadItem,
  BrowserSettings,
  BrowserSettingsPatch,
  AboutInfo,
  ToastMessage,
  BrowserLayout,
  SidePanelType,
  AdBlockState,
  AdBlockCurrentSite
} from '../shared/types'
import type {
  AIResponse,
  AISelectionAction,
  AIStatus,
  ExtractedPageContent
} from '../shared/aiTypes'

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
  toggleMuteTab(tabId: string): Promise<void>

  // Layout
  setUiHeight(height: number): void
  setLayout(layout: BrowserLayout): void
  showPanel(type: SidePanelType): void
  hidePanel(): void
  popupMenu(): Promise<void>

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
  toggleBookmarkBar(): Promise<boolean>
  getBookmarkBarVisible(): Promise<boolean>

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
  updateSettings(settings: BrowserSettingsPatch): Promise<BrowserSettings>
  resetSettings(): Promise<BrowserSettings>
  resetPreferenceGroup(group: string): Promise<BrowserSettings>
  exportSettings(): Promise<{ success: boolean; error?: string }>
  importSettings(): Promise<{ success: boolean; error?: string; prefs?: BrowserSettings }>
  selectDownloadPath(): Promise<string | null>
  openUserDataFolder(): Promise<void>

  // AdBlock Zhi
  getAdBlockState(): Promise<AdBlockState>
  setAdBlockEnabled(enabled: boolean): Promise<AdBlockState>
  addAdBlockWhitelist(hostname: string): Promise<AdBlockState>
  removeAdBlockWhitelist(hostname: string): Promise<AdBlockState>
  clearAdBlockCount(): Promise<AdBlockState>
  getCurrentSiteForAdBlock(): Promise<AdBlockCurrentSite>
  toggleCurrentSiteAdBlockWhitelist(): Promise<AdBlockState>

  // AI
  getAIStatus(): Promise<AIStatus>
  testAIConnection(): Promise<{ success: boolean; error?: string }>
  extractCurrentPage(): Promise<ExtractedPageContent | null>
  extractSelection(): Promise<string>
  summarizeCurrentPage(): Promise<AIResponse>
  verifyCurrentPage(): Promise<AIResponse>
  searchCurrentPage(): Promise<AIResponse>
  debateCurrentPage(): Promise<AIResponse>
  youAskCurrentPage(): Promise<AIResponse>
  explainCurrentPage(): Promise<AIResponse>
  askCurrentPage(question: string): Promise<AIResponse>
  chatWithAI(message: string): Promise<AIResponse>
  translateSelection(): Promise<AIResponse>
  explainSelection(): Promise<AIResponse>
  summarizeSelection(): Promise<AIResponse>

  // Browser state
  getBrowserState(): Promise<BrowserState>
  getAboutInfo(): Promise<AboutInfo>
  copyToClipboard(text: string): Promise<void>

  // Listeners
  onBrowserState(callback: (state: BrowserState) => void): () => void
  onFocusAddressBar(callback: () => void): () => void
  onFocusFind(callback: () => void): () => void
  onToggleBookmark(callback: () => void): () => void
  onBookmarkBarChanged(callback: (visible: boolean) => void): () => void
  onBookmarksChanged(callback: (bookmarks: BookmarkItem[]) => void): () => void
  onFindResult(callback: (result: FindResult) => void): () => void
  onDownloadUpdate(callback: (item: DownloadItem) => void): () => void
  onDownloadCompleted(callback: (item: DownloadItem) => void): () => void
  onHoverUrl(callback: (url: string) => void): () => void
  onAdBlockStateChanged(callback: (state: AdBlockState) => void): () => void
  onToast(callback: (msg: ToastMessage) => void): () => void
  onSettings(callback: (settings: BrowserSettings) => void): () => void
  onOpenHistoryPanel(callback: () => void): () => void
  onOpenBookmarksPanel(callback: () => void): () => void
  onOpenDownloadsPanel(callback: () => void): () => void
  onOpenSettingsPanel(callback: () => void): () => void
  onOpenAIPanel(callback: () => void): () => void
  onOpenPanel(callback: (type: SidePanelType) => void): () => void
  onToggleAIPanel(callback: () => void): () => void
  onAITriggerAction(callback: (action: AISelectionAction) => void): () => void
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
