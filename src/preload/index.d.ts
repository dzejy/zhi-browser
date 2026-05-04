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
  AdBlockBlockRecord,
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

interface ProxyNode {
  name: string
  type: string
  alive: boolean
  delay: number | null
}

interface ProxyGroup {
  name: string
  type: string
  now: string
  all: string[]
}

interface ProxyStatus {
  running: boolean
  enabled: boolean
  currentNode: string
  groups: ProxyGroup[]
}

interface PasswordListItem {
  id: string
  url: string
  username: string
  title: string
  createdAt: number
  updatedAt: number
}

interface WebPanelItem {
  id: string
  name: string
  url: string
  icon: string
  order: number
}

interface ExtensionInfo {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  path: string
  url: string
  icons: Record<string, string>
  hasPopup: boolean
  hasOptions: boolean
  permissions: string[]
  hostPermissions: string[]
  installedAt: number
  source: 'local' | 'crx' | 'webstore'
}

type BuiltinDownloadTask = Record<string, unknown>
type DownloadProgress = Record<string, unknown>

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
  toggleDevTools(tabId?: string): Promise<{ success: boolean }>

  // Layout
  setUiHeight(height: number): void
  setLayout(layout: BrowserLayout): void
  showPanel(type: SidePanelType): void
  hidePanel(): void
  popupMenu(): Promise<void>
  toggleFullscreen(): Promise<boolean>
  isFullscreen(): Promise<boolean>
  overlayShow(): void
  overlayHide(): void
  onFullscreenChanged(callback: (fullscreen: boolean) => void): () => void

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
  historyGetAll(options?: {
    limit?: number
    offset?: number
    search?: string
  }): Promise<{ items: HistoryItem[]; total: number }>
  historyDelete(ids: string[]): Promise<{ success: boolean }>
  historyClear(): Promise<{ success: boolean }>
  historySearch(keyword: string): Promise<HistoryItem[]>
  historyGetForAI(query: string): Promise<Array<{ title: string; url: string; time: string }>>

  // Bookmark manager
  bookmarksGetAll(options?: { folder?: string; search?: string }): Promise<BookmarkItem[]>
  bookmarksAdd(entry: {
    url: string
    title: string
    folder?: string
  }): Promise<{ success: boolean; id?: string }>
  bookmarksDelete(ids: string[]): Promise<{ success: boolean }>
  bookmarksUpdate(id: string, updates: Record<string, unknown>): Promise<{ success: boolean }>
  bookmarksGetFolders(): Promise<string[]>
  bookmarksSearch(keyword: string): Promise<BookmarkItem[]>
  bookmarksGetForAI(query: string): Promise<Array<{ title: string; url: string; folder: string }>>

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
  getAdBlockBlockHistory(): Promise<AdBlockBlockRecord[]>
  clearAdBlockBlockHistory(): Promise<AdBlockBlockRecord[]>
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
  aiSearchLibrary(query: string): Promise<AIResponse>
  translateSelection(): Promise<AIResponse>
  explainSelection(): Promise<AIResponse>
  summarizeSelection(): Promise<AIResponse>
  translatePage(enable: boolean): Promise<void>

  // Proxy
  proxyToggle(enable: boolean): Promise<{ success: boolean; error?: string }>
  proxyStatus(): Promise<ProxyStatus>
  proxyUpdateSubscription(
    url: string
  ): Promise<{ success: boolean; nodeCount?: number; error?: string }>
  proxyGetGroups(): Promise<ProxyGroup[]>
  proxyGetNodes(group: string): Promise<ProxyNode[]>
  proxySwitch(group: string, node: string): Promise<{ success: boolean }>
  proxyTestAllDelay(group: string): Promise<Record<string, number>>
  proxyTestNodeDelay(node: string): Promise<{ delay: number }>
  proxyGetLogs(): Promise<string[]>
  proxyGetSubscriptionInfo(): Promise<{
    lastUpdated: number | null
    nodeCount: number
    filePath: string
  }>

  // Passwords
  passwordsGetAll(): Promise<PasswordListItem[]>
  passwordsGetPassword(id: string): Promise<string | null>
  passwordsAdd(data: {
    url: string
    username: string
    password: string
    title: string
  }): Promise<{ success: boolean; id?: string }>
  passwordsUpdate(id: string, data: Record<string, unknown>): Promise<{ success: boolean }>
  passwordsDelete(id: string): Promise<{ success: boolean }>
  passwordsSearch(keyword: string): Promise<PasswordListItem[]>

  // Incognito
  incognitoNewTab(url?: string): Promise<{ success: boolean }>
  incognitoIsActive(): Promise<boolean>
  incognitoClearData(): Promise<{ success: boolean }>

  // User scripts
  userscriptGetAll(): Promise<
    Array<{
      id: string
      meta: {
        name: string
        version: string
        description: string
        author: string
        match: string[]
        [key: string]: unknown
      }
      enabled: boolean
      installTime: number
      updateTime: number
    }>
  >
  userscriptGetCode(id: string): Promise<string>
  userscriptInstall(
    code: string
  ): Promise<{ id?: string; meta?: Record<string, unknown>; enabled?: boolean; error?: string }>
  userscriptInstallFromUrl(
    url: string
  ): Promise<{ success?: boolean; id?: string; meta?: Record<string, unknown>; error?: string }>
  userscriptRemove(id: string): Promise<boolean>
  userscriptToggle(id: string, enabled: boolean): Promise<boolean>
  userscriptUpdate(id: string): Promise<{ success: boolean; newVersion?: string; error?: string }>

  // Extensions
  extensionsGetAll(): Promise<ExtensionInfo[]>
  extensionsInstallLocal(): Promise<ExtensionInfo | null>
  extensionsInstallWebStore(urlOrId: string): Promise<ExtensionInfo>
  extensionsUninstall(id: string): Promise<{ success: boolean }>
  extensionsEnable(id: string): Promise<{ success: boolean }>
  extensionsDisable(id: string): Promise<{ success: boolean }>
  extensionsReload(id: string): Promise<{ success: boolean }>

  // Reader mode
  readerEnter(): Promise<{ success: boolean; article?: unknown; error?: string }>
  readerExit(): Promise<boolean>
  readerCanExtract(): Promise<boolean>

  // Resource sniffer
  snifferGetResources(): Promise<
    Array<{
      id: string
      url: string
      contentType: string
      size: string | null
      filename: string
      tabId: number
      timestamp: number
      resourceType: 'video' | 'audio' | 'document' | 'archive' | 'other'
    }>
  >
  snifferGetResourcesForTab(tabId: number): Promise<
    Array<{
      id: string
      url: string
      contentType: string
      size: string | null
      filename: string
      tabId: number
      timestamp: number
      resourceType: 'video' | 'audio' | 'document' | 'archive' | 'other'
    }>
  >
  snifferClearTab(tabId: number): Promise<boolean>

  // External downloader
  downloaderSend(task: {
    url: string
    filename?: string
    referer?: string
  }): Promise<{ success: boolean; error?: string }>
  downloaderDetect(): Promise<Record<string, string | null>>
  downloaderGetConfig(): Promise<{ enabled: boolean; type: string; path: string }>

  // Builtin downloader
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builtinDownloadStart(options: any): Promise<{ success: boolean; id?: string; error?: string }>
  builtinDownloadPause(id: string): Promise<{ success: boolean }>
  builtinDownloadResume(id: string): Promise<{ success: boolean }>
  builtinDownloadCancel(id: string): Promise<{ success: boolean }>
  builtinDownloadRemove(id: string): Promise<{ success: boolean }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builtinDownloadGetList(): Promise<BuiltinDownloadTask[]>
  builtinDownloadGetTask(id: string): Promise<BuiltinDownloadTask | null>
  builtinDownloadClearCompleted(): Promise<{ success: boolean }>
  builtinDownloadOpenFile(id: string): Promise<{ success: boolean }>
  builtinDownloadOpenFolder(id: string): Promise<{ success: boolean }>
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void

  // Tab preview
  tabPreviewCapture(tabId: number): Promise<string | null>
  tabPreviewClear(tabId: number): Promise<void>
  tabPreviewShow(options: {
    x: number
    y: number
    image?: string
    kind?: 'image' | 'newtab'
  }): Promise<void>
  tabPreviewHide(): Promise<void>

  // Web panel
  webPanelGetAll(): Promise<WebPanelItem[]>
  webPanelAdd(item: { name: string; url: string; icon: string }): Promise<WebPanelItem>
  webPanelRemove(id: string): Promise<boolean>
  webPanelUpdate(
    id: string,
    updates: { name?: string; url?: string; icon?: string }
  ): Promise<boolean>
  webPanelToggle(id: string): Promise<{ visible: boolean; activeId: string | null }>
  webPanelHide(): Promise<boolean>
  webPanelIsVisible(): Promise<boolean>
  webPanelGetActive(): Promise<string | null>
  webPanelSetWidth(width: number): Promise<number>
  webPanelReorder(ids: string[]): Promise<WebPanelItem[]>
  webPanelRelayout(): Promise<boolean>

  // Quick Search
  quickSearchGetEngine(): Promise<string>
  quickSearchSetEngine(engine: string): Promise<boolean>
  quickSearchMenuOpen(payload: {
    x: number
    y: number
    selectedId: string
    engines: Array<{ id: string; name: string; urlTemplate: string; icon: string }>
    appTheme?: string
  }): Promise<string | null>
  themeMenuOpen(payload: {
    x: number
    y: number
    selectedId: string
    themes: Array<{ id: string; name: string; color: string }>
    appTheme?: string
  }): Promise<string | null>

  // Proxy
  proxyToggle(enable: boolean): Promise<{ success: boolean; error?: string }>
  proxyStatus(): Promise<ProxyStatus>

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

  // Workspace
  workspaceGetState(): Promise<{
    workspaces: Array<{
      id: string
      name: string
      icon: string
      color: string
      tabIds: string[]
      pinnedTabIds: string[]
      createdAt: number
      isDefault: boolean
    }>
    activeWorkspaceId: string
    tabLayout: 'horizontal' | 'vertical'
    sidebarWidth: number
    sidebarCollapsed: boolean
    autoCollapse: boolean
  }>
  workspaceGetAll(): Promise<
    Array<{
      id: string
      name: string
      icon: string
      color: string
      tabIds: string[]
      pinnedTabIds: string[]
      createdAt: number
      isDefault: boolean
    }>
  >
  workspaceGetActive(): Promise<{
    id: string
    name: string
    icon: string
    color: string
    tabIds: string[]
    pinnedTabIds: string[]
    createdAt: number
    isDefault: boolean
  }>
  workspaceAdd(data: {
    name: string
    icon: string
    color: string
  }): Promise<{ success: boolean; id?: string }>
  workspaceRemove(id: string): Promise<{ success: boolean }>
  workspaceUpdate(
    id: string,
    updates: Record<string, unknown>
  ): Promise<{ success: boolean }>
  workspaceSwitch(id: string): Promise<{ success: boolean }>
  workspaceAddTab(wsId: string, tabId: string): Promise<{ success: boolean }>
  workspaceRemoveTab(wsId: string, tabId: string): Promise<{ success: boolean }>
  workspacePinTab(wsId: string, tabId: string): Promise<{ success: boolean }>
  workspaceUnpinTab(wsId: string, tabId: string): Promise<{ success: boolean }>
  workspaceSetLayout(layout: 'horizontal' | 'vertical'): Promise<{ success: boolean }>
  workspaceSetSidebarWidth(w: number): Promise<{ success: boolean }>
  workspaceSetSidebarCollapsed(v: boolean): Promise<{ success: boolean }>
  workspaceSetAutoCollapse(v: boolean): Promise<{ success: boolean }>

  // Shortcuts
  shortcutsGetAll(): Promise<
    Array<{
      id: string
      label: string
      category: string
      defaultKey: string
      currentKey: string
      enabled: boolean
      scope: 'global' | 'app'
    }>
  >
  shortcutsUpdate(
    id: string,
    newKey: string
  ): Promise<{ success: boolean; conflict?: { id: string; label: string } }>
  shortcutsToggle(id: string, enabled: boolean): Promise<{ success: boolean }>
  shortcutsReset(id: string): Promise<{
    success: boolean
    item?: {
      id: string
      label: string
      category: string
      defaultKey: string
      currentKey: string
      enabled: boolean
      scope: 'global' | 'app'
    }
  }>
  shortcutsResetAll(): Promise<{ success: boolean }>
  shortcutsOpenSettings(): Promise<{ success: boolean }>
  shortcutsCloseSettings(): Promise<{ success: boolean }>
  onShortcutsChanged(
    callback: (
      list: Array<{
        id: string
        label: string
        category: string
        defaultKey: string
        currentKey: string
        enabled: boolean
        scope: 'global' | 'app'
      }>
    ) => void
  ): () => void

  // Screenshot
  screenshotOpen(): Promise<{ success: boolean }>
  screenshotGetSource(): Promise<{
    dataUrl: string
    width: number
    height: number
    scaleFactor: number
  } | null>
  screenshotComplete(payload: {
    action: 'copy' | 'save' | 'pin'
    dataUrl: string
    rect?: { x: number; y: number; width: number; height: number }
  }): Promise<{ success: boolean }>
  screenshotCancel(): Promise<{ success: boolean }>
  screenshotLongCapture(): Promise<{
    success: boolean
    error?: string
    dataUrl?: string
    slices?: Array<{ dataUrl: string; scrollY: number; height: number }>
  }>
  pinImageClose(): Promise<{ success: boolean }>
  pinImageGetData(): Promise<string | null>
  onScreenshotSource(
    cb: (data: { dataUrl: string; width: number; height: number; scaleFactor: number }) => void
  ): () => void
  onPinImageData(cb: (dataUrl: string) => void): () => void

  // Command Palette
  commandPaletteToggle(): Promise<{ success: boolean }>
  commandPaletteClose(): Promise<{ success: boolean }>
  commandPaletteGetCustom(): Promise<
    Array<{
      id: string
      label: string
      type: 'open-url' | 'run-js' | 'set-pref' | 'launch-app'
      payload: string
      createdAt: number
    }>
  >
  commandPaletteAddCustom(cmd: {
    label: string
    type: 'open-url' | 'run-js' | 'set-pref' | 'launch-app'
    payload: string
  }): Promise<{
    id: string
    label: string
    type: 'open-url' | 'run-js' | 'set-pref' | 'launch-app'
    payload: string
    createdAt: number
  }>
  commandPaletteRemoveCustom(id: string): Promise<{ success: boolean }>
  commandPaletteExecuteCustom(cmd: {
    id: string
    label: string
    type: 'open-url' | 'run-js' | 'set-pref' | 'launch-app'
    payload: string
    createdAt: number
  }): Promise<{ success: boolean }>

  // Hibernation
  hibernationGetList(): Promise<string[]>
  hibernationHibernateTab(tabId: string): Promise<{ success: boolean }>
  hibernationWakeTab(tabId: string): Promise<{ success: boolean }>
  hibernationHibernateOthers(): Promise<{ success: boolean; count: number }>
  hibernationIsHibernated(tabId: string): Promise<boolean>
  hibernationGetPrefs(): Promise<{
    enabled: boolean
    timeoutMinutes: number
    whitelist: string[]
  }>
  hibernationSetPrefs(prefs: {
    enabled?: boolean
    timeoutMinutes?: number
    whitelist?: string[]
  }): Promise<{ success: boolean }>

  // Quick Note
  quickNoteToggle(): Promise<{ success: boolean }>
  quickNoteGetAll(): Promise<
    Array<{ id: string; title: string; content: string; updatedAt: number }>
  >
  quickNoteSave(note: { id: string; title: string; content: string }): Promise<{
    success: boolean
  }>
  quickNoteCreate(): Promise<{
    id: string
    title: string
    content: string
    updatedAt: number
  }>
  quickNoteDelete(id: string): Promise<{ success: boolean }>
  quickNoteClose(): Promise<{ success: boolean }>

  // Password autofill
  passwordAutoCheck(url: string): Promise<
    Array<{ id: string; username: string }>
  >
  passwordAutoSave(data: {
    url: string
    username: string
    password: string
    title: string
  }): Promise<{ success: boolean }>
  passwordAutoFill(id: string, webContentsId?: number): Promise<{
    success: boolean
    username?: string
    password?: string
  }>
  onPasswordSavePrompt(
    cb: (data: {
      url: string
      username: string
      password: string
      existing: boolean
    }) => void
  ): () => void
  onPasswordFillPrompt(
    cb: (data: {
      url: string
      webContentsId: number
      entries: Array<{ id: string; username: string }>
    }) => void
  ): () => void
}

declare global {
  interface Window {
    api: PreloadAPI
    __closePanel?: () => void
  }
}
