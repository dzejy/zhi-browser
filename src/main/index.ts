import { app, BaseWindow, WebContentsView, ipcMain, clipboard, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { TabManager } from './tabs'
import { readJSON, writeJSON } from './storage'
import {
  addBookmark,
  removeBookmark,
  getBookmarks,
  updateBookmark,
  clearBookmarks
} from './bookmarks'
import { getHistory, clearHistory, removeHistoryEntry } from './history'
import {
  setupDownloadHandler,
  setOnDownloadUpdate,
  setOnDownloadCompleted,
  openDownloadFile,
  showInFolder,
  loadCompletedDownloads,
  getDownloads,
  removeDownload,
  clearDownloads,
  showDownloadInFolder
} from './downloads'
import {
  getSettings,
  getPreferences,
  updatePreferences,
  updateSettings,
  resetSettings,
  resetPreferenceGroup,
  exportPreferencesToFile,
  importPreferencesFromFile,
  selectDownloadPath,
  openUserDataFolder,
  getUserDataPath
} from './settings'
import { buildMenu, popupMenu } from './menu'
import {
  PersistedSession,
  BrowserSettingsPatch,
  BrowserLayout,
  SidePanelType
} from '../shared/types'
import { normalizeUrl, isValidNavigableUrl } from '../shared/preferences'
import { AdBlockController } from './adblockController'
import { registerAdBlockIPC } from './adblockIPC'
import { registerAIIPC } from './aiIPC'
import { setAsDefaultBrowser, isDefaultBrowser } from './default-browser'
import type { AISelectionAction } from '../shared/aiTypes'

let win: BaseWindow
let uiView: WebContentsView
let tabManager: TabManager
let sessionSaved = false
let panelView: WebContentsView | null = null
let panelVisible = false
let panelCloseTimeout: ReturnType<typeof setTimeout> | null = null
let currentPanelType: SidePanelType = 'bookmarks'
let panelReady = false

const UI_SCALE = 1.5
const BASE_TOP_CHROME_HEIGHT = 92
const BASE_MIN_CHROME_HEIGHT = 84
const TOP_CHROME_HEIGHT = Math.round(BASE_TOP_CHROME_HEIGHT * UI_SCALE)
const MIN_CHROME_HEIGHT = Math.round(BASE_MIN_CHROME_HEIGHT * UI_SCALE)
const TITLE_BAR_OVERLAY_HEIGHT = Math.round(34 * UI_SCALE)
const PANEL_WIDTH = 400
const PANEL_RIGHT_MARGIN = 8
let currentChromeHeight = TOP_CHROME_HEIGHT
const SIDE_PANEL_TYPES = new Set<SidePanelType>([
  'bookmarks',
  'history',
  'downloads',
  'settings',
  'about',
  'ai'
])

function sendToUi(channel: string, ...args: unknown[]): void {
  try {
    uiView.webContents.send(channel, ...args)
  } catch {
    /* ui view may not be ready */
  }
}

function sendToPanel(channel: string, ...args: unknown[]): void {
  if (!panelView) return

  const send = (): void => {
    try {
      panelView?.webContents.send(channel, ...args)
    } catch {
      /* panel view may not be ready */
    }
  }

  if (panelReady) {
    send()
  } else {
    panelView.webContents.once('did-finish-load', send)
  }
}

function broadcastBookmarkBarVisibility(visible: boolean): void {
  sendToUi('bookmarkBar:visibility-changed', visible)
  sendToPanel('bookmarkBar:visibility-changed', visible)
}

function broadcastSettings(): void {
  const settings = getSettings()
  sendToUi('browser:settings', settings)
  sendToPanel('browser:settings', settings)
}

function setBookmarkBarVisible(visible: boolean): boolean {
  const updated = updatePreferences({ showBookmarkBar: visible })
  installAppMenu()
  broadcastBookmarkBarVisibility(updated.showBookmarkBar)
  broadcastSettings()
  return updated.showBookmarkBar
}

function toggleBookmarkBarVisible(): boolean {
  return setBookmarkBarVisible(!getPreferences().showBookmarkBar)
}

function broadcastBookmarksChanged(): void {
  const bookmarks = getBookmarks()
  sendToUi('bookmarks:changed', bookmarks)
  sendToPanel('bookmarks:changed', bookmarks)
}

function installAppMenu(): void {
  buildMenu({
    newTab: () => {
      tabManager.createTab()
      sendToUi('browser:focus-address-bar')
    },
    closeTab: () => tabManager.closeTab(tabManager.getActiveTabId()),
    reload: () => tabManager.reload(tabManager.getActiveTabId()),
    zoomIn: () => tabManager.zoomIn(tabManager.getActiveTabId()),
    zoomOut: () => tabManager.zoomOut(tabManager.getActiveTabId()),
    zoomReset: () => tabManager.zoomReset(tabManager.getActiveTabId()),
    toggleDevTools: () => tabManager.toggleDevTools(tabManager.getActiveTabId()),
    focusAddressBar: () => sendToUi('browser:focus-address-bar'),
    findInPage: () => sendToUi('browser:focus-find'),
    showHistory: () => openPanelFromCommand('history'),
    showBookmarks: () => openPanelFromCommand('bookmarks'),
    showDownloads: () => openPanelFromCommand('downloads'),
    showSettings: () => openPanelFromCommand('settings'),
    showAbout: () => openPanelFromCommand('about'),
    reopenClosedTab: () => tabManager.restoreClosed(),
    addBookmark: () => sendToUi('browser:add-bookmark'),
    openUserDataFolder: () => openUserDataFolder(),
    clearBrowsingData: () => {
      openPanelFromCommand('settings')
      sendToPanel('browser:clear-data-confirm')
    },
    isDevToolsEnabled: () => getSettings().devToolsEnabled,
    isBookmarkBarVisible: () => getPreferences().showBookmarkBar,
    setBookmarkBarVisible
  })
}

function openPanelFromCommand(type: SidePanelType): void {
  showPanelView(type)
  sendToUi('browser:open-panel', type)
}

function openSidePanelFromShortcut(type: 'history' | 'downloads'): void {
  openPanelFromCommand(type)
}

function openAIPanelFromAction(action?: AISelectionAction): void {
  showPanelView('ai')
  sendToUi('browser:open-panel', 'ai')
  if (action) {
    setTimeout(() => {
      sendToPanel('ai:trigger-action', action)
    }, 80)
  }
}

function createWindow(): void {
  const prefs = getPreferences()
  const bounds = prefs.windowBounds

  win = new BaseWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 600,
    minHeight: 400,
    title: 'Zhi Browser',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1f2127',
      symbolColor: '#9498a3',
      height: TITLE_BAR_OVERLAY_HEIGHT
    }
  })

  if (bounds.isMaximized) {
    win.maximize()
  }

  uiView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Transparent below the painted chrome, so the page view begins without a filled strip.
  uiView.setBackgroundColor('#00000000')

  win.contentView.addChildView(uiView)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    uiView.webContents.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    uiView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }

  tabManager = new TabManager(
    win,
    uiView,
    () => {
      pushBrowserState()
    },
    openSidePanelFromShortcut,
    openAIPanelFromAction,
    toggleBookmarkBarVisible
  )
  installAppMenu()

  // Create a narrow, right-aligned view for bookmark/history/download/settings panels.
  // The page view remains full-size behind it; no wide transparent overlay is needed.
  panelView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  panelView.setBackgroundColor('#1e2026')
  panelView.webContents.on('did-finish-load', () => {
    panelReady = true
    sendPanelType()
  })
  panelView.webContents.on('did-start-loading', () => {
    panelReady = false
  })

  const adBlockController = new AdBlockController({
    session: session.defaultSession,
    getPreferences,
    updatePreferences,
    sendToUI: (channel, payload) => {
      if (!uiView.webContents.isDestroyed()) {
        uiView.webContents.send(channel, payload)
      }
      if (panelView && !panelView.webContents.isDestroyed()) {
        panelView.webContents.send(channel, payload)
      }
    },
    ignoredWebContentsIds: [uiView.webContents.id, panelView.webContents.id]
  })
  adBlockController.start()
  registerAdBlockIPC({
    controller: adBlockController,
    uiView,
    panelView,
    getActiveTabUrl: () => tabManager.getActiveTabUrl()
  })
  registerAIIPC({
    uiView,
    panelView,
    getActiveWebContents: () => tabManager.getActiveWebContents()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    panelView.webContents.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?panel=true`)
  } else {
    panelView.webContents.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { panel: 'true' }
    })
  }

  // Handle keyboard shortcuts from uiView (address bar, panels, etc.)
  uiView.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const ctrl = input.control || input.meta
    const shift = input.shift
    const key = input.key.toLowerCase()

    if (input.alt && !input.control && !input.meta && !input.shift && key === 'i') {
      event.preventDefault()
      sendToUi('browser:toggle-ai-panel')
      return
    }

    if (ctrl && key === 'w') {
      event.preventDefault()
      tabManager.closeTab(tabManager.getActiveTabId())
      return
    }
    if (ctrl && !shift && key === 't') {
      event.preventDefault()
      tabManager.createTab()
      uiView.webContents.send('browser:focus-address-bar')
      return
    }
    if (ctrl && shift && key === 't') {
      event.preventDefault()
      tabManager.restoreClosed()
      return
    }
    if (ctrl && key === 'l') {
      event.preventDefault()
      uiView.webContents.send('browser:focus-address-bar')
      return
    }
    if ((ctrl && key === 'r') || key === 'f5') {
      event.preventDefault()
      tabManager.reload(tabManager.getActiveTabId())
      return
    }
    if (ctrl && key === 'f') {
      event.preventDefault()
      uiView.webContents.send('browser:focus-find')
      return
    }
    if (ctrl && key === 'd') {
      event.preventDefault()
      uiView.webContents.send('browser:toggle-bookmark')
      return
    }
    if (ctrl && shift && !input.alt && key === 'b') {
      event.preventDefault()
      toggleBookmarkBarVisible()
      return
    }
    if (ctrl && key === 'h') {
      event.preventDefault()
      openSidePanelFromShortcut('history')
      return
    }
    if (ctrl && key === 'j') {
      event.preventDefault()
      openSidePanelFromShortcut('downloads')
      return
    }
    if (ctrl && key === ',') {
      event.preventDefault()
      openPanelFromCommand('settings')
      return
    }
    if (ctrl && (key === '+' || key === '=' || key === 'add')) {
      event.preventDefault()
      tabManager.zoomIn(tabManager.getActiveTabId())
      return
    }
    if (ctrl && (key === '-' || key === 'subtract')) {
      event.preventDefault()
      tabManager.zoomOut(tabManager.getActiveTabId())
      return
    }
    if (ctrl && key === '0') {
      event.preventDefault()
      tabManager.zoomReset(tabManager.getActiveTabId())
      return
    }
    if (ctrl && key === 'tab') {
      event.preventDefault()
      const tabOrder = tabManager.getTabOrder()
      const currentIdx = tabOrder.indexOf(tabManager.getActiveTabId())
      if (shift) {
        const prevIdx = currentIdx <= 0 ? tabOrder.length - 1 : currentIdx - 1
        tabManager.switchTab(tabOrder[prevIdx])
      } else {
        const nextIdx = currentIdx >= tabOrder.length - 1 ? 0 : currentIdx + 1
        tabManager.switchTab(tabOrder[nextIdx])
      }
      return
    }
    if (key === 'escape') {
      event.preventDefault()
      tabManager.stop(tabManager.getActiveTabId())
      return
    }
    if (key === 'f12') {
      event.preventDefault()
      tabManager.toggleDevTools(tabManager.getActiveTabId())
      return
    }
  })

  updateLayout()
  win.on('resize', updateLayout)

  restoreSession()

  // Push initial state once uiView is loaded so renderer gets tabs immediately
  uiView.webContents.once('did-finish-load', () => {
    pushBrowserState()
  })

  win.on('close', () => {
    const isMaximized = win.isMaximized()
    if (!isMaximized) {
      const [width, height] = win.getSize()
      const [x, y] = win.getPosition()
      updatePreferences({
        windowBounds: { x, y, width, height, isMaximized: false }
      })
    } else {
      updatePreferences({
        windowBounds: { ...getPreferences().windowBounds, isMaximized: true }
      })
    }
    saveSession()
    tabManager.destroyAll()
  })
}

function updateLayout(): void {
  tabManager.updateLayout()
  if (panelVisible && panelView) {
    const { width, height } = win.getContentBounds()
    panelView.setBounds({
      x: width - PANEL_WIDTH - PANEL_RIGHT_MARGIN,
      y: currentChromeHeight,
      width: PANEL_WIDTH,
      height: Math.max(0, height - currentChromeHeight)
    })
  }
}

function sendPanelType(): void {
  if (!panelReady || !panelView) return
  panelView.webContents.send('browser:panel-type', currentPanelType)
}

function pushBrowserState(): void {
  const state = tabManager.getBrowserState()
  try {
    uiView.webContents.send('browser:state', state)
  } catch {
    // uiView may not be ready yet
  }
  if (panelReady && panelView && !panelView.webContents.isDestroyed()) {
    try {
      panelView.webContents.send('browser:state', state)
    } catch {
      // panel view may not be ready yet
    }
  }

  const activeTab = tabManager.getActiveTab()
  if (activeTab) {
    win.title = activeTab.title ? `${activeTab.title} - Zhi Browser` : 'Zhi Browser'
  }
}

function saveSession(): void {
  if (sessionSaved) return
  sessionSaved = true

  const sessionData = tabManager.getSessionData()
  writeJSON('session.json', sessionData)
}

function restoreSession(): void {
  const prefs = getPreferences()

  if (prefs.startup.behavior === 'homepage') {
    const normalized = normalizeUrl(prefs.startup.homepageUrl)
    const url = isValidNavigableUrl(prefs.startup.homepageUrl)
      ? normalized || prefs.startup.homepageUrl
      : 'https://www.baidu.com'
    tabManager.createTab(url)
    return
  }

  if (prefs.startup.behavior === 'specificPages') {
    const pages = prefs.startup.specificPages
      .map((page) => normalizeUrl(page) || page)
      .filter((page) => isValidNavigableUrl(page))
    if (pages.length > 0) {
      pages.forEach((page, index) => {
        tabManager.createTab(page, { background: index > 0, insertMode: 'atEnd' })
      })
    } else {
      tabManager.createTab(prefs.startup.newTabUrl || undefined)
    }
    return
  }

  if (prefs.startup.behavior === 'restoreSession') {
    const saved = readJSON<PersistedSession>('session.json', { tabs: [], activeIndex: 0 })
    if (saved.tabs.length > 0) {
      for (let i = 0; i < saved.tabs.length; i++) {
        const tabData = saved.tabs[i]
        const url = tabData.url && tabData.url !== 'about:blank' ? tabData.url : undefined
        tabManager.createTab(url, {
          background: true,
          insertMode: 'atEnd',
          pinned: Boolean(tabData.isPinned)
        })
      }

      const tabOrder = tabManager.getTabOrder()
      const targetIdx = Math.min(saved.activeIndex, tabOrder.length - 1)
      if (targetIdx >= 0 && tabOrder[targetIdx]) {
        tabManager.switchTab(tabOrder[targetIdx])
      }
      return
    }
  }

  tabManager.createTab(prefs.startup.newTabUrl || undefined)
}

function showPanelView(type: SidePanelType): void {
  if (!panelView) return

  const { width, height } = win.getContentBounds()
  currentPanelType = type

  panelView.setBounds({
    x: width - PANEL_WIDTH - PANEL_RIGHT_MARGIN,
    y: currentChromeHeight,
    width: PANEL_WIDTH,
    height: Math.max(0, height - currentChromeHeight)
  })

  sendPanelType()

  if (panelVisible) {
    try {
      win.contentView.removeChildView(panelView)
    } catch {
      // may not be attached
    }
  }
  win.contentView.addChildView(panelView)
  panelVisible = true
  panelView.webContents.focus()
}

function hidePanelView(notifyRenderer = true): void {
  if (!panelView || !panelVisible) return
  try {
    win.contentView.removeChildView(panelView)
  } catch {
    // may not be attached
  }
  panelVisible = false
  if (notifyRenderer) {
    uiView.webContents.send('browser:panel-closed')
  }
}

// ===== IPC Handlers =====

function setupIPC(): void {
  const validateUiSender = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent
  ): boolean => {
    return event.sender === uiView.webContents
  }

  const validateSender = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean => {
    return event.sender === uiView.webContents || event.sender === panelView?.webContents
  }

  const isSidePanelType = (type: unknown): type is SidePanelType => {
    return typeof type === 'string' && SIDE_PANEL_TYPES.has(type as SidePanelType)
  }

  const normalizeLayout = (layout: BrowserLayout): BrowserLayout => {
    const uiViewHeight = Number.isFinite(layout.uiViewHeight)
      ? Math.max(MIN_CHROME_HEIGHT, Math.round(layout.uiViewHeight))
      : TOP_CHROME_HEIGHT
    const pageTop = Number.isFinite(layout.pageTop)
      ? Math.max(MIN_CHROME_HEIGHT, Math.round(layout.pageTop))
      : uiViewHeight

    return { uiViewHeight, pageTop }
  }

  ipcMain.on('ui:set-height', (event, height: number) => {
    if (!validateUiSender(event)) return
    const normalizedHeight = Number.isFinite(height)
      ? Math.max(MIN_CHROME_HEIGHT, Math.round(height))
      : TOP_CHROME_HEIGHT
    currentChromeHeight = normalizedHeight
    tabManager.setLayout({
      uiViewHeight: normalizedHeight,
      pageTop: normalizedHeight
    })
    updateLayout()
  })

  ipcMain.on('ui:set-layout', (event, layout: BrowserLayout) => {
    if (!validateUiSender(event)) return
    const normalized = normalizeLayout(layout)
    currentChromeHeight = normalized.pageTop
    tabManager.setLayout(normalized)
    updateLayout()
  })

  ipcMain.on('panel:show', (event, args: { type?: unknown }) => {
    if (!validateSender(event)) return
    if (!isSidePanelType(args?.type)) return
    const panelType = args.type
    if (panelCloseTimeout) {
      clearTimeout(panelCloseTimeout)
      panelCloseTimeout = null
    }
    showPanelView(panelType)
    if (event.sender === panelView?.webContents) {
      sendToUi('browser:open-panel', panelType)
    }
  })

  ipcMain.on('panel:hide', (event) => {
    if (!validateSender(event)) return
    if (panelCloseTimeout) {
      clearTimeout(panelCloseTimeout)
      panelCloseTimeout = null
    }
    hidePanelView(event.sender !== uiView.webContents)
  })

  ipcMain.handle('menu:popup', (event) => {
    if (!validateUiSender(event)) return
    popupMenu({ window: win })
  })

  ipcMain.handle('default-browser:set', (event) => {
    if (!validateSender(event)) return
    setAsDefaultBrowser()
  })

  ipcMain.handle('default-browser:is-default', (event) => {
    if (!validateSender(event)) return false
    return isDefaultBrowser()
  })

  // Tab commands
  ipcMain.on('tab:create', (event, args: { url?: string }) => {
    if (!validateSender(event)) return
    tabManager.createTab(args?.url)
    if (!args?.url) {
      uiView.webContents.send('browser:focus-address-bar')
    }
  })

  ipcMain.on('tab:close', (event, args: { tabId: string }) => {
    if (!validateSender(event)) return
    tabManager.closeTab(args.tabId)
  })

  ipcMain.on('tab:switch', (event, args: { tabId: string }) => {
    if (!validateSender(event)) return
    tabManager.switchTab(args.tabId)
  })

  ipcMain.on('tab:load-url', (event, args: { tabId: string; url: string }) => {
    if (!validateSender(event)) return
    tabManager.loadUrl(args.tabId, args.url)
  })

  ipcMain.on('tab:back', (event, args: { tabId: string }) => {
    if (!validateSender(event)) return
    tabManager.goBack(args.tabId)
  })

  ipcMain.on('tab:forward', (event, args: { tabId: string }) => {
    if (!validateSender(event)) return
    tabManager.goForward(args.tabId)
  })

  ipcMain.on('tab:reload', (event, args: { tabId: string }) => {
    if (!validateSender(event)) return
    tabManager.reload(args.tabId)
  })

  ipcMain.on('tab:stop', (event, args: { tabId: string }) => {
    if (!validateSender(event)) return
    tabManager.stop(args.tabId)
  })

  ipcMain.on('tab:retry', (event, args: { tabId: string }) => {
    if (!validateSender(event)) return
    tabManager.retryLoad(args.tabId)
  })

  ipcMain.on('tab:zoom', (event, args: { tabId: string; action: 'in' | 'out' | 'reset' }) => {
    if (!validateSender(event)) return
    if (args.action === 'in') tabManager.zoomIn(args.tabId)
    else if (args.action === 'out') tabManager.zoomOut(args.tabId)
    else tabManager.zoomReset(args.tabId)
  })

  ipcMain.on('tab:toggle-pin', (event, args: { tabId: string }) => {
    if (!validateSender(event)) return
    tabManager.togglePin(args.tabId)
  })

  ipcMain.handle('tab:toggle-mute', (event, tabId: string) => {
    if (!validateSender(event)) return
    tabManager.toggleMuteTab(tabId)
  })

  ipcMain.on('tab:restore-closed', (event) => {
    if (!validateSender(event)) return
    tabManager.restoreClosed()
  })

  ipcMain.on('tab:move', (event, args: { tabId: string; toIndex: number }) => {
    if (!validateSender(event)) return
    tabManager.moveTab(args.tabId, args.toIndex)
  })

  ipcMain.on('tab:open-url', (event, args: { url: string; newTab?: boolean }) => {
    if (!validateSender(event)) return
    if (args.newTab) {
      tabManager.createTab(args.url)
    } else {
      tabManager.loadUrl(tabManager.getActiveTabId(), args.url)
    }
  })

  ipcMain.handle('tab:context-menu', (event, tabId: string) => {
    if (!validateSender(event)) return
    tabManager.showTabContextMenu(tabId)
  })

  ipcMain.handle('tab:duplicate', (event, tabId: string) => {
    if (!validateSender(event)) return
    tabManager.duplicateTab(tabId)
  })

  ipcMain.handle('tab:close-others', (event, tabId: string) => {
    if (!validateSender(event)) return
    tabManager.closeOtherTabs(tabId)
  })

  ipcMain.handle('tab:close-right', (event, tabId: string) => {
    if (!validateSender(event)) return
    tabManager.closeTabsToRight(tabId)
  })

  // Browser state sync — renderer requests current state on mount
  ipcMain.handle('browser:get-state', (event) => {
    if (!validateSender(event))
      return { tabs: [], activeTabId: '', findState: null, downloads: [], recentlyClosed: [] }
    return tabManager.getBrowserState()
  })

  ipcMain.handle('bookmarkBar:toggle', (event) => {
    if (!validateSender(event)) return getPreferences().showBookmarkBar
    return toggleBookmarkBarVisible()
  })

  ipcMain.handle('bookmarkBar:get-visible', (event) => {
    if (!validateSender(event)) return true
    return getPreferences().showBookmarkBar
  })

  // Find
  ipcMain.on(
    'find:start',
    (
      event,
      args: { tabId: string; text: string; options?: { forward?: boolean; matchCase?: boolean } }
    ) => {
      if (!validateSender(event)) return
      tabManager.findStart(args.tabId, args.text, args.options)
    }
  )

  ipcMain.on('find:next', (event, args: { tabId: string; forward: boolean }) => {
    if (!validateSender(event)) return
    tabManager.findNext(args.tabId, args.forward)
  })

  ipcMain.on(
    'find:stop',
    (event, args: { tabId: string; action: 'clearSelection' | 'keepSelection' }) => {
      if (!validateSender(event)) return
      tabManager.findStop(args.tabId, args.action)
    }
  )

  // Bookmarks
  ipcMain.handle(
    'bookmark:add-current',
    (event, args: { url: string; title: string; favicon: string }) => {
      if (!validateSender(event)) return null
      const bookmark = addBookmark(args)
      broadcastBookmarksChanged()
      return bookmark
    }
  )

  ipcMain.handle('bookmark:remove', (event, args: { url: string }) => {
    if (!validateSender(event)) return
    removeBookmark(args.url)
    broadcastBookmarksChanged()
  })

  ipcMain.handle('bookmark:list', (event) => {
    if (!validateSender(event)) return []
    return getBookmarks()
  })

  ipcMain.handle('bookmarks:update', (event, id: string, title: string, url: string) => {
    if (!validateSender(event)) return []
    const nextTitle = typeof title === 'string' ? title.trim() : ''
    const nextUrl = typeof url === 'string' ? url.trim() : ''
    if (!id || !nextTitle || !nextUrl) return getBookmarks()
    if (!nextUrl.includes('.') && !nextUrl.includes('://')) return getBookmarks()
    const updated = updateBookmark(id, { title: nextTitle, url: nextUrl })
    broadcastBookmarksChanged()
    return updated
  })

  ipcMain.handle('bookmarks:clear', (event) => {
    if (!validateSender(event)) return
    clearBookmarks()
    broadcastBookmarksChanged()
  })

  // History
  ipcMain.handle('history:list', (event, args?: { limit?: number; query?: string }) => {
    if (!validateSender(event)) return []
    return getHistory(args?.limit, args?.query)
  })

  ipcMain.handle('history:clear', (event) => {
    if (!validateSender(event)) return
    clearHistory()
  })

  ipcMain.handle('history:remove', (event, id: string) => {
    if (!validateSender(event)) return
    removeHistoryEntry(id)
  })

  // Downloads
  ipcMain.on('download:open-file', (event, args: { downloadId: string }) => {
    if (!validateSender(event)) return
    openDownloadFile(args.downloadId)
  })

  ipcMain.on('download:show-in-folder', (event, args: { downloadId: string }) => {
    if (!validateSender(event)) return
    showInFolder(args.downloadId)
  })

  ipcMain.handle('downloads:list', (event) => {
    if (!validateSender(event)) return []
    return getDownloads()
  })

  ipcMain.handle('downloads:open-file', (event, id: string) => {
    if (!validateSender(event)) return
    openDownloadFile(id)
  })

  ipcMain.handle('downloads:show-in-folder', (event, id: string) => {
    if (!validateSender(event)) return
    showDownloadInFolder(id)
  })

  ipcMain.handle('downloads:remove', (event, id: string) => {
    if (!validateSender(event)) return
    removeDownload(id)
    pushBrowserState()
  })

  ipcMain.handle('downloads:clear', (event) => {
    if (!validateSender(event)) return
    clearDownloads()
    pushBrowserState()
  })

  // Settings
  ipcMain.handle('settings:get', (event) => {
    if (!validateSender(event)) return null
    return getSettings()
  })

  ipcMain.handle('settings:update', (event, args: BrowserSettingsPatch) => {
    if (!validateSender(event)) return null
    const updated = updateSettings(args)
    installAppMenu()
    sendToUi('browser:settings', updated)
    sendToPanel('browser:settings', updated)
    broadcastBookmarkBarVisibility(updated.showBookmarkBar)
    return updated
  })

  ipcMain.handle('settings:reset', (event) => {
    if (!validateSender(event)) return null
    const updated = resetSettings()
    installAppMenu()
    sendToUi('browser:settings', updated)
    sendToPanel('browser:settings', updated)
    broadcastBookmarkBarVisibility(updated.showBookmarkBar)
    return updated
  })

  ipcMain.handle('settings:reset-group', (event, group: string) => {
    if (!validateSender(event)) return null
    const updated = resetPreferenceGroup(group)
    installAppMenu()
    sendToUi('browser:settings', updated)
    sendToPanel('browser:settings', updated)
    broadcastBookmarkBarVisibility(updated.showBookmarkBar)
    return updated
  })

  ipcMain.handle('settings:export', async (event) => {
    if (!validateSender(event)) return { success: false }
    return exportPreferencesToFile()
  })

  ipcMain.handle('settings:import', async (event) => {
    if (!validateSender(event)) return { success: false }
    const result = await importPreferencesFromFile()
    if (result.success && result.prefs) {
      installAppMenu()
      sendToUi('browser:settings', result.prefs)
      sendToPanel('browser:settings', result.prefs)
      broadcastBookmarkBarVisibility(result.prefs.showBookmarkBar)
    }
    return result
  })

  ipcMain.handle('settings:select-download-path', async (event) => {
    if (!validateSender(event)) return null
    return selectDownloadPath()
  })

  ipcMain.handle('settings:open-user-data', (event) => {
    if (!validateSender(event)) return
    openUserDataFolder()
  })

  ipcMain.handle('browser:get-about-info', (event) => {
    if (!validateSender(event)) return null
    return {
      appName: 'Zhi Browser',
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron || '',
      chromiumVersion: process.versions.chrome || '',
      nodeVersion: process.versions.node,
      userDataPath: getUserDataPath()
    }
  })

  ipcMain.handle('util:copy-to-clipboard', (event, text: string) => {
    if (!validateSender(event)) return
    if (typeof text === 'string') {
      clipboard.writeText(text)
    }
  })
}

// ===== App lifecycle =====

app.whenReady().then(() => {
  loadCompletedDownloads()
  setupDownloadHandler()
  setOnDownloadUpdate((item) => {
    try {
      uiView.webContents.send('browser:download-update', item)
      pushBrowserState()
    } catch {
      /* ignore */
    }
  })
  setOnDownloadCompleted((item) => {
    try {
      uiView.webContents.send('browser:download-completed', item)
      uiView.webContents.send('browser:toast', {
        id: `download-${item.id}`,
        text: `下载完成：${item.filename}`,
        duration: 2600
      })
      pushBrowserState()
    } catch {
      /* ignore */
    }
  })
  setupIPC()
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  saveSession()
})
