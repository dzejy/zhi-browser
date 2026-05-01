import { app, BaseWindow, WebContentsView, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { TabManager } from './tabs'
import { readJSON, writeJSON } from './storage'
import { addBookmark, removeBookmark, getBookmarks } from './bookmarks'
import { getHistory, clearHistory } from './history'
import {
  setupDownloadHandler,
  setOnDownloadUpdate,
  openDownloadFile,
  showInFolder,
  loadCompletedDownloads
} from './downloads'
import { getSettings, updateSettings } from './settings'
import { PersistedSession, BrowserSettings, BrowserLayout, SidePanelType } from '../shared/types'

let win: BaseWindow
let uiView: WebContentsView
let tabManager: TabManager
let sessionSaved = false
let panelView: WebContentsView | null = null
let panelVisible = false
let panelCloseTimeout: ReturnType<typeof setTimeout> | null = null
let currentPanelType: SidePanelType = 'bookmarks'
let panelReady = false

const TOP_CHROME_HEIGHT = 74
const PANEL_WIDTH = 380
const PANEL_HEIGHT = 386
const PANEL_RIGHT_MARGIN = 8
const PANEL_TOP = TOP_CHROME_HEIGHT
const SIDE_PANEL_TYPES = new Set<SidePanelType>(['bookmarks', 'history', 'downloads', 'settings'])

function createWindow(): void {
  win = new BaseWindow({
    width: 1280,
    height: 860,
    minWidth: 600,
    minHeight: 400,
    title: 'Zhi Browser'
  })

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

  tabManager = new TabManager(win, uiView, () => {
    pushBrowserState()
  })

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
  panelView.setBackgroundColor('#2a2a2a')
  panelView.webContents.on('did-finish-load', () => {
    panelReady = true
    sendPanelType()
  })
  panelView.webContents.on('did-start-loading', () => {
    panelReady = false
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
    if (ctrl && key === 'h') {
      event.preventDefault()
      uiView.webContents.send('browser:open-history-panel')
      return
    }
    if (ctrl && key === 'j') {
      event.preventDefault()
      uiView.webContents.send('browser:open-downloads-panel')
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
      const activeTab = tabManager.getActiveTab()
      if (activeTab) activeTab.view.webContents.openDevTools()
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
    saveSession()
    tabManager.destroyAll()
  })
}

function updateLayout(): void {
  tabManager.updateLayout()
  if (panelVisible && panelView) {
    const { width } = win.getContentBounds()
    panelView.setBounds({
      x: width - PANEL_WIDTH - PANEL_RIGHT_MARGIN,
      y: PANEL_TOP,
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT
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

  const activeTab = tabManager.getActiveTab()
  if (activeTab) {
    win.title = activeTab.title ? `${activeTab.title} - Zhi Browser` : 'Zhi Browser'
  }
}

function saveSession(): void {
  if (sessionSaved) return
  sessionSaved = true

  const settings = getSettings()
  if (!settings.restoreSession) return

  const sessionData = tabManager.getSessionData()
  writeJSON('session.json', sessionData)
}

function restoreSession(): void {
  const settings = getSettings()
  if (!settings.restoreSession) {
    tabManager.createTab()
    return
  }

  const saved = readJSON<PersistedSession>('session.json', { tabs: [], activeIndex: 0 })

  if (saved.tabs.length === 0) {
    tabManager.createTab()
    return
  }

  for (let i = 0; i < saved.tabs.length; i++) {
    const tabData = saved.tabs[i]
    const url = tabData.url && tabData.url !== 'about:blank' ? tabData.url : undefined
    const id = tabManager.createTab(url)
    if (tabData.isPinned) {
      tabManager.togglePin(id)
    }
  }

  const tabOrder = tabManager.getTabOrder()
  const targetIdx = Math.min(saved.activeIndex, tabOrder.length - 1)
  if (targetIdx >= 0 && tabOrder[targetIdx]) {
    tabManager.switchTab(tabOrder[targetIdx])
  }
}

function showPanelView(type: SidePanelType): void {
  if (!panelView) return

  const { width } = win.getContentBounds()
  currentPanelType = type

  panelView.setBounds({
    x: width - PANEL_WIDTH - PANEL_RIGHT_MARGIN,
    y: PANEL_TOP,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT
  })

  sendPanelType()

  if (!panelVisible) {
    win.contentView.addChildView(panelView)
    panelVisible = true
  }
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
      ? Math.max(TOP_CHROME_HEIGHT, Math.round(layout.uiViewHeight))
      : TOP_CHROME_HEIGHT
    const pageTop = Number.isFinite(layout.pageTop)
      ? Math.max(TOP_CHROME_HEIGHT, Math.round(layout.pageTop))
      : uiViewHeight

    return { uiViewHeight, pageTop }
  }

  ipcMain.on('ui:set-height', (event, height: number) => {
    if (!validateUiSender(event)) return
    const normalizedHeight = Number.isFinite(height)
      ? Math.max(TOP_CHROME_HEIGHT, Math.round(height))
      : TOP_CHROME_HEIGHT
    tabManager.setLayout({
      uiViewHeight: normalizedHeight,
      pageTop: normalizedHeight
    })
  })

  ipcMain.on('ui:set-layout', (event, layout: BrowserLayout) => {
    if (!validateUiSender(event)) return
    tabManager.setLayout(normalizeLayout(layout))
  })

  ipcMain.on('panel:show', (event, args: { type?: unknown }) => {
    if (!validateUiSender(event)) return
    if (!isSidePanelType(args?.type)) return
    if (panelCloseTimeout) {
      clearTimeout(panelCloseTimeout)
      panelCloseTimeout = null
    }
    showPanelView(args.type)
  })

  ipcMain.on('panel:hide', (event) => {
    if (!validateSender(event)) return
    if (panelCloseTimeout) {
      clearTimeout(panelCloseTimeout)
      panelCloseTimeout = null
    }
    hidePanelView(event.sender !== uiView.webContents)
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

  // Browser state sync — renderer requests current state on mount
  ipcMain.handle('browser:get-state', (event) => {
    if (!validateSender(event))
      return { tabs: [], activeTabId: '', findState: null, downloads: [], recentlyClosed: [] }
    return tabManager.getBrowserState()
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
      return addBookmark(args)
    }
  )

  ipcMain.handle('bookmark:remove', (event, args: { url: string }) => {
    if (!validateSender(event)) return
    removeBookmark(args.url)
  })

  ipcMain.handle('bookmark:list', (event) => {
    if (!validateSender(event)) return []
    return getBookmarks()
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

  // Downloads
  ipcMain.on('download:open-file', (event, args: { downloadId: string }) => {
    if (!validateSender(event)) return
    openDownloadFile(args.downloadId)
  })

  ipcMain.on('download:show-in-folder', (event, args: { downloadId: string }) => {
    if (!validateSender(event)) return
    showInFolder(args.downloadId)
  })

  // Settings
  ipcMain.handle('settings:get', (event) => {
    if (!validateSender(event)) return null
    return getSettings()
  })

  ipcMain.handle('settings:update', (event, args: Partial<BrowserSettings>) => {
    if (!validateSender(event)) return null
    return updateSettings(args)
  })
}

// ===== App lifecycle =====

app.whenReady().then(() => {
  // Remove default application menu so Ctrl+W does not close the window.
  // Tab close is handled via before-input-event in TabManager.
  Menu.setApplicationMenu(null)

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
  setupIPC()
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  saveSession()
})
