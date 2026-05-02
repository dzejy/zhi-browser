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
  setDefaultBrowser(): Promise<void>
  isDefaultBrowser(): Promise<boolean>
  toggleDarkMode(): Promise<boolean>
  getDarkMode(): Promise<boolean>

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
  translatePage(enable: boolean): Promise<void>

  // User scripts
  userscriptGetAll(): Promise<Array<{ id: string; meta: { name: string; version: string; description: string; author: string; match: string[]; [key: string]: unknown }; enabled: boolean; installTime: number; updateTime: number }>>
  userscriptGetCode(id: string): Promise<string>
  userscriptInstall(code: string): Promise<{ id?: string; meta?: Record<string, unknown>; enabled?: boolean; error?: string }>
  userscriptInstallFromUrl(url: string): Promise<{ success?: boolean; id?: string; meta?: Record<string, unknown>; error?: string }>
  userscriptRemove(id: string): Promise<boolean>
  userscriptToggle(id: string, enabled: boolean): Promise<boolean>
  userscriptUpdate(id: string): Promise<{ success: boolean; newVersion?: string; error?: string }>

  // Reader mode
  readerEnter(): Promise<{ success: boolean; article?: unknown; error?: string }>
  readerExit(): Promise<boolean>
  readerCanExtract(): Promise<boolean>

  // Resource sniffer
  snifferGetResources(): Promise<Array<{ id: string; url: string; contentType: string; size: string | null; filename: string; tabId: number; timestamp: number; resourceType: 'video' | 'audio' | 'document' | 'archive' | 'other' }>>
  snifferGetResourcesForTab(tabId: number): Promise<Array<{ id: string; url: string; contentType: string; size: string | null; filename: string; tabId: number; timestamp: number; resourceType: 'video' | 'audio' | 'document' | 'archive' | 'other' }>>
  snifferClearTab(tabId: number): Promise<boolean>

  // External downloader
  downloaderSend(task: { url: string; filename?: string; referer?: string }): Promise<{ success: boolean; error?: string }>
  downloaderDetect(): Promise<Record<string, string | null>>
  downloaderGetConfig(): Promise<{ enabled: boolean; type: string; path: string }>

  // Tab preview
  tabPreviewCapture(tabId: number): Promise<string | null>
  tabPreviewClear(tabId: number): Promise<void>

  // Web panel
  webPanelOpen(url: string): Promise<{ success: boolean }>
  webPanelClose(): Promise<boolean>
  webPanelToggle(): Promise<boolean>
  webPanelNavigate(url: string): Promise<boolean>
  webPanelIsVisible(): Promise<boolean>
  webPanelGetUrl(): Promise<string | null>
  webPanelGetSaved(): Promise<Array<{ url: string; title: string; pinned: boolean }>>
  webPanelSave(panels: Array<{ url: string; title: string; pinned: boolean }>): Promise<boolean>
  webPanelRemove(url: string): Promise<boolean>

  // Mouse gestures
  gestureExecute(action: string, webContentsId: number): Promise<boolean>
  gestureGetConfig(): Promise<Array<{ pattern: string; action: string; label: string }>>

  // Split view
  splitViewOpen(url: string): Promise<{ success: boolean }>
  splitViewClose(): Promise<boolean>
  splitViewGetState(): Promise<{ active: boolean; rightUrl: string | null }>
  splitViewNavigate(url: string): Promise<boolean>
  splitViewGoBack(): Promise<boolean>
  splitViewGoForward(): Promise<boolean>
  splitViewReload(): Promise<boolean>
  splitViewSwap(): Promise<string | false>

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
  onResourceFound(callback: (data: { tabId: number; count: number }) => void): () => void
  onUserScriptInstalled(callback: (data: { name: string }) => void): () => void
}

declare global {
  interface Window {
    api: PreloadAPI
    __closePanel?: () => void
  }
}
