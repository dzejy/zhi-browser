import { app, BaseWindow, BrowserWindow, WebContentsView, ipcMain, clipboard, session, screen, dialog } from 'electron'
import { appendFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'node:url'
import { is } from '@electron-toolkit/utils'
import { TabManager } from './tabs'
import { readJSON, writeJSON } from './storage'
import {
  addBookmark,
  addManagedBookmark,
  removeBookmark,
  removeBookmarks,
  getBookmarks,
  getManagedBookmarks,
  getBookmarkFolders,
  getBookmarksForAI,
  searchBookmarks,
  updateBookmark,
  clearBookmarks
} from './bookmarks'
import {
  getHistory,
  getHistoryPage,
  getHistoryForAI,
  searchHistory,
  clearHistory,
  removeHistoryEntry,
  removeHistoryEntries
} from './history'
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
import {
  DARK_BG_COLOR,
  CHROME_BG_COLOR,
  getWindowBackgroundColor,
  registerDarkModeHandlers
} from './darkMode'
import { registerTranslateHandlers } from './translate'
import type { AISelectionAction } from '../shared/aiTypes'
import { registerUserScriptIPC } from './userscript/ipc-handler'
import { registerReaderHandlers } from './reader'
import { registerSnifferHandlers } from './sniffer'
import { registerDownloaderHandlers, registerBuiltinDownloaderHandlers } from './downloader'
import { registerTabPreviewHandlers } from './tab-preview'
import {
  registerWebPanelHandlers,
  getWebPanelOffset,
  getWebPanelRailWidth,
  hideWebPanel
} from './web-panel'
import { registerMouseGestureHandlers } from './mouse-gesture'
import { executeGestureAction } from './mouse-gesture-actions'
import {
  registerSplitViewHandlers,
  relayoutSplitView,
  isSplitViewActive,
  getLeftViewWidth
} from './split-view'
import { registerProxyHandlers, proxyAutoStart } from './proxy'
import { registerPasswordHandlers } from './passwords'
import { getIncognitoSession, registerIncognitoHandlers } from './incognito'
import { registerWorkspaceHandlers } from './workspace'
import { getEffectiveSidebarWidth } from './workspace/store'
import {
  initShortcuts,
  registerShortcutHandlers,
  startShortcuts,
  registerAction,
  dispatchAppShortcut
} from './shortcuts'
import {
  captureLongScreenshotToClipboard,
  registerScreenshotHandlers,
  openScreenshotWindow
} from './screenshot'
import {
  initCommandPalette,
  registerCommandPaletteHandlers,
  toggleCommandPalette
} from './command-palette'
import { registerHibernationHandlers, initHibernation, hibernateOthers } from './hibernation'
import { initQuickNote, registerQuickNoteHandlers, toggleQuickNote } from './quick-note'
import { registerPasswordHandlers as registerPasswordAutoHandlers } from './password'
import { getExtensionSystem } from './extensions'

const IS_DEV_VARIANT = process.env['ZHI_BROWSER_VARIANT'] === 'dev'
const APP_DISPLAY_NAME = process.env['ZHI_BROWSER_APP_NAME'] || (IS_DEV_VARIANT ? 'Zhi Browser Dev' : 'Zhi Browser')
const WINDOW_BRAND = IS_DEV_VARIANT ? 'Zhi Browser [DEV]' : 'Zhi Browser'

let win: BaseWindow
let uiView: WebContentsView
let tabManager: TabManager
let sessionSaved = false
let panelView: WebContentsView | null = null
let panelVisible = false
let panelCloseTimeout: ReturnType<typeof setTimeout> | null = null
let currentPanelType: SidePanelType = 'bookmarks'
let panelReady = false
let ensurePanelLoaded: (() => void) | null = null
let quickSearchMenuWindow: BrowserWindow | null = null
let themeMenuWindow: BrowserWindow | null = null
let pendingStartupUrl: string | null = null
let appIsQuitting = false

const STARTUP_FILE_EXTENSIONS = new Set(['.html', '.htm', '.xhtml', '.svg'])

function getStartupIntentLogPath(): string {
  try {
    return join(app.getPath('userData'), 'startup-intent.log')
  } catch {
    return join(process.cwd(), 'startup-intent.log')
  }
}

function logStartupIntent(message: string, payload?: unknown): void {
  const line =
    `${new Date().toISOString()} ${message}` +
    (typeof payload === 'undefined' ? '' : ` ${JSON.stringify(payload)}`)
  try {
    appendFileSync(getStartupIntentLogPath(), line + '\n', { encoding: 'utf8' })
  } catch {
    /* ignore logging failures */
  }
  if (typeof payload === 'undefined') console.info(message)
  else console.info(message, payload)
}

function isMainWindowAlive(): boolean {
  try {
    return typeof win !== 'undefined' && Boolean(win) && !win.isDestroyed()
  } catch {
    return false
  }
}

function focusMainWindow(): boolean {
  if (!isMainWindowAlive()) return false
  try {
    if (win.isMinimized()) win.restore()
    win.focus()
    return true
  } catch {
    return false
  }
}

function ensureMainWindow(): boolean {
  if (appIsQuitting) return false
  if (isMainWindowAlive()) return true

  sessionSaved = false
  try {
    createWindow()
    return true
  } catch (err) {
    console.error('[main-window] failed to recreate window', err)
    return false
  }
}

function extractUrlFromArgs(args: string[], workingDirectory?: string): string | null {
  const normalizeCandidate = (value: string): string => value.trim().replace(/^"|"$/g, '')
  const isSchemeUrl = (value: string): boolean => /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)
  const isSwitch = (value: string): boolean => /^--?\w+/.test(value)
  const isProjectEntry = (value: string): boolean => value === '.' || value === './' || value === '.\\'
  const hasAllowedFileExtension = (value: string): boolean => {
    const normalized = value.replace(/\\/g, '/').toLowerCase()
    const clean = normalized.split(/[?#]/, 1)[0]
    for (const ext of STARTUP_FILE_EXTENSIONS) {
      if (clean.endsWith(ext)) return true
    }
    return false
  }
  const toFileUrlIfLocalFile = (value: string): string | null => {
    if (!value || isSwitch(value) || isProjectEntry(value) || !hasAllowedFileExtension(value)) {
      return null
    }
    const candidates = new Set<string>()
    if (workingDirectory) candidates.add(resolve(workingDirectory, value))
    candidates.add(resolve(value))
    candidates.add(value)
    for (const resolved of candidates) {
      if (!existsSync(resolved)) continue
      try {
        if (!statSync(resolved).isFile()) continue
        return pathToFileURL(resolved).toString()
      } catch {
        continue
      }
    }
    return null
  }
  const extractEmbeddedPath = (value: string): string | null => {
    const match = value.match(/[a-zA-Z]:\\[^:*?"<>|\r\n]+\.(html?|xhtml|svg)/i)
    if (!match) return null
    return toFileUrlIfLocalFile(match[0])
  }

  logStartupIntent('[startup-intent] parse args begin', { args, workingDirectory })
  const userArgs = args.slice(1)
  for (let i = userArgs.length - 1; i >= 0; i--) {
    const rawArg = userArgs[i]
    const arg = normalizeCandidate(rawArg)
    if (!arg || isSwitch(arg) || isProjectEntry(arg)) continue

    if (/^https?:\/\//i.test(arg) || /^file:\/\//i.test(arg) || /^zhi:\/\//i.test(arg)) {
      logStartupIntent('[startup-intent] matched url argument', { raw: rawArg, normalized: arg })
      return arg
    }

    if (isSchemeUrl(arg)) {
      logStartupIntent('[startup-intent] matched generic scheme argument', { raw: rawArg, normalized: arg })
      return arg
    }

    const localFileUrl = toFileUrlIfLocalFile(arg)
    if (localFileUrl) {
      logStartupIntent('[startup-intent] matched local file argument', {
        raw: rawArg,
        normalized: arg,
        resolved: localFileUrl
      })
      return localFileUrl
    }

    const embeddedFileUrl = extractEmbeddedPath(arg)
    if (embeddedFileUrl) {
      logStartupIntent('[startup-intent] matched embedded local file argument', {
        raw: rawArg,
        normalized: arg,
        resolved: embeddedFileUrl
      })
      return embeddedFileUrl
    }
  }
  logStartupIntent('[startup-intent] no explicit startup target found')
  return null
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    const url = extractUrlFromArgs(commandLine, workingDirectory)
    logStartupIntent('[startup-intent] second-instance', { commandLine, workingDirectory, url })
    if (!ensureMainWindow()) {
      pendingStartupUrl = url
      return
    }
    focusMainWindow()
    if (url) {
      if (tabManager) {
        tabManager.createTab(url)
      }
    }
  })
}

function getMenuThemePalette(themeId: string): {
  bg: string
  bg2: string
  text: string
  muted: string
  border: string
  hover: string
  activeA: string
  activeB: string
} {
  const map: Record<string, { bg: string; bg2: string; text: string; muted: string; border: string; hover: string; activeA: string; activeB: string }> = {
    void: { bg: '#11151f', bg2: '#1f2533', text: '#e5ebf5', muted: '#9aa7bc', border: 'rgba(148,163,184,.2)', hover: 'rgba(96,165,250,.12)', activeA: 'rgba(37,99,235,.24)', activeB: 'rgba(37,99,235,.08)' },
    ocean: { bg: '#102338', bg2: '#16324a', text: '#d8e8f0', muted: '#7ea8be', border: 'rgba(100,180,240,.22)', hover: 'rgba(100,180,240,.16)', activeA: 'rgba(56,189,248,.24)', activeB: 'rgba(56,189,248,.08)' },
    nebula: { bg: '#1a1225', bg2: '#2a1d3d', text: '#e0d8f0', muted: '#b09ac9', border: 'rgba(160,100,240,.22)', hover: 'rgba(160,100,240,.16)', activeA: 'rgba(168,85,247,.24)', activeB: 'rgba(168,85,247,.08)' },
    forest: { bg: '#112017', bg2: '#1c3528', text: '#d4e8dc', muted: '#86b69a', border: 'rgba(80,200,120,.2)', hover: 'rgba(80,200,120,.14)', activeA: 'rgba(34,197,94,.24)', activeB: 'rgba(34,197,94,.08)' },
    charcoal: { bg: '#1b1815', bg2: '#2c2926', text: '#e8e2dc', muted: '#b8aa9b', border: 'rgba(200,160,120,.2)', hover: 'rgba(200,160,120,.14)', activeA: 'rgba(245,158,11,.2)', activeB: 'rgba(245,158,11,.08)' },
    light: { bg: '#ffffff', bg2: '#f3f4f7', text: '#1d1d1f', muted: '#6e6e73', border: 'rgba(0,0,0,.14)', hover: 'rgba(0,0,0,.05)', activeA: 'rgba(59,130,246,.18)', activeB: 'rgba(59,130,246,.08)' },
    apple: { bg: '#1c1c1e', bg2: '#2c2c2e', text: '#f5f5f7', muted: '#a4a4aa', border: 'rgba(255,255,255,.14)', hover: 'rgba(255,255,255,.08)', activeA: 'rgba(96,165,250,.22)', activeB: 'rgba(96,165,250,.08)' }
  }
  return map[themeId] || map['void']
}

const UI_SCALE = 1.5
const BASE_TOP_CHROME_HEIGHT = 92
const BASE_MIN_CHROME_HEIGHT = 84
const TOP_CHROME_HEIGHT = Math.round(BASE_TOP_CHROME_HEIGHT * UI_SCALE)
const MIN_CHROME_HEIGHT = Math.round(BASE_MIN_CHROME_HEIGHT * UI_SCALE)
const TITLE_BAR_OVERLAY_HEIGHT = Math.round(34 * UI_SCALE)
const FULLSCREEN_BUTTON_SIZE = Math.round(36 * UI_SCALE)
const PANEL_WIDTH = 400
const PANEL_RIGHT_MARGIN = 8
let currentChromeHeight = TOP_CHROME_HEIGHT
let lastWindowedLayout: BrowserLayout = {
  uiViewHeight: TOP_CHROME_HEIGHT,
  pageTop: TOP_CHROME_HEIGHT,
  uiViewWidth: null
}
const SIDE_PANEL_TYPES = new Set<SidePanelType>([
  'bookmarks',
  'history',
  'downloads',
  'settings',
  'proxy',
  'about',
  'ai',
  'scripts',
  'webpanel',
  'sniffer'
])

function isUiViewAlive(): boolean {
  try {
    return typeof uiView !== 'undefined' && Boolean(uiView) && !uiView.webContents.isDestroyed()
  } catch {
    return false
  }
}

function isPanelViewAlive(): boolean {
  try {
    const view = panelView
    return view !== null && !view.webContents.isDestroyed()
  } catch {
    return false
  }
}

function sendToUi(channel: string, ...args: unknown[]): void {
  if (!isUiViewAlive()) return
  try {
    uiView.webContents.send(channel, ...args)
  } catch {
    /* ui view may not be ready */
  }
}

function sendToPanel(channel: string, ...args: unknown[]): void {
  if (!isPanelViewAlive()) return

  const send = (): void => {
    if (!isPanelViewAlive()) return
    try {
      panelView?.webContents.send(channel, ...args)
    } catch {
      /* panel view may not be ready */
    }
  }

  if (panelReady) {
    send()
  } else {
    panelView?.webContents.once('did-finish-load', send)
  }
}

function isTrustedRendererShell(sender: Electron.WebContents): boolean {
  let url = ''
  try {
    if (sender.isDestroyed()) return false
    url = sender.getURL()
  } catch {
    return false
  }
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return url.startsWith(process.env['ELECTRON_RENDERER_URL'])
  }
  return url.startsWith('file://') && url.replace(/\\/g, '/').includes('/renderer/index.html')
}

function validateSender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
  return (
    (isUiViewAlive() && event.sender === uiView.webContents) ||
    (isPanelViewAlive() && event.sender === panelView?.webContents) ||
    isTrustedRendererShell(event.sender)
  )
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
    newIncognitoTab: () => {
      tabManager.createTab(undefined, { session: getIncognitoSession(), incognito: true })
      sendToUi('browser:focus-address-bar')
    },
    openFile: () => {
      dialog
        .showOpenDialog({
          title: '打开文件',
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: '网页文件', extensions: ['html', 'htm', 'xhtml', 'svg'] },
            { name: '所有文件', extensions: ['*'] }
          ]
        })
        .then((result) => {
          if (result.canceled) return
          for (const filePath of result.filePaths) {
            const fileUrl = pathToFileURL(filePath).toString()
            tabManager.createTab(fileUrl)
          }
        })
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
    showCommandPalette: () => toggleCommandPalette(),
    startScreenshot: () => {
      openScreenshotWindow().catch(() => {})
    },
    openQuickNote: () => toggleQuickNote(),
    hibernateOtherTabs: () => {
      hibernateOthers().catch(() => {})
    },
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

function collapseTransientChromeFromPage(): void {
  hidePanelView(true)
  hideWebPanel()
  sendToUi('browser:panel-closed')
  try {
    if (quickSearchMenuWindow && !quickSearchMenuWindow.isDestroyed()) {
      quickSearchMenuWindow.close()
    }
  } catch {
    /* ignore */
  }
  try {
    if (themeMenuWindow && !themeMenuWindow.isDestroyed()) {
      themeMenuWindow.close()
    }
  } catch {
    /* ignore */
  }
}

function getVerticalTabWidth(): number {
  if (isFullscreenChromeMode()) return 0
  return getEffectiveSidebarWidth()
}

function isFullscreenChromeMode(): boolean {
  if (!isMainWindowAlive()) return currentChromeHeight === 0
  try {
    return win.isFullScreen() || currentChromeHeight === 0
  } catch {
    return currentChromeHeight === 0
  }
}

function applyBrowserLayout(layout: BrowserLayout): void {
  currentChromeHeight = layout.pageTop
  tabManager.setLayout(layout)
  updateLayout()
}

function handleFullscreenChanged(fullscreen: boolean): void {
  if (fullscreen) {
    hidePanelView(false)
    applyBrowserLayout({
      uiViewHeight: FULLSCREEN_BUTTON_SIZE,
      uiViewWidth: FULLSCREEN_BUTTON_SIZE,
      pageTop: 0
    })
  } else {
    applyBrowserLayout(lastWindowedLayout)
  }

  sendToUi('window:fullscreen-changed', fullscreen)
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
    title: WINDOW_BRAND,
    backgroundColor: prefs.webDarkMode ? DARK_BG_COLOR : CHROME_BG_COLOR,
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
    openAIPanelFromAction,
    (payload) => {
      sendToUi('userscript:installed', payload)
      sendToPanel('userscript:installed', payload)
    },
    collapseTransientChromeFromPage
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
  registerPasswordHandlers()
  registerWorkspaceHandlers({
    onLayoutChanged: () => updateLayout(),
    validateSender
  })
  initShortcuts()
  registerShortcutHandlers()
  initCommandPalette(
    () => win,
    () => tabManager.getActiveWebContents(),
    (url) => tabManager.createTab(url)
  )
  initQuickNote(() => win)
  // Wire shortcut actions to their handlers
  registerAction('screenshot:capture', () => { openScreenshotWindow().catch(() => {}) })
  registerAction('screenshot:pin', () => { openScreenshotWindow().catch(() => {}) })
  registerAction('screenshot:long', () => {
    const wc = tabManager.getActiveWebContents()
    captureLongScreenshotToClipboard(wc).catch(() => {})
  })
  registerAction('command-palette:toggle', () => { toggleCommandPalette() })
  registerAction('quick-note:toggle', () => { toggleQuickNote() })
  registerAction('tab:hibernate-others', () => { hibernateOthers().catch(() => {}) })
  registerAction('translate:page', () => {
    const wc = tabManager.getActiveWebContents()
    if (wc) {
      import('./translate/orchestrator').then(m => m.translatePage(wc)).catch(() => {})
    }
  })
  registerAction('reader:toggle', () => {
    const wc = tabManager.getActiveWebContents()
    if (wc) wc.send('reader:toggle')
  })
  registerAction('proxy:toggle', () => {
    import('./proxy/core').then(m => {
      const running = m.isCoreRunning()
      if (running) {
        m.stopCore()
      } else {
        import('./proxy/subscription').then(s => m.startCore(s.getConfigPath())).catch(() => {})
      }
    }).catch(() => {})
  })
  registerAction('darkmode:toggle', () => {
    import('./darkMode').then(m => {
      const next = !m.isDarkMode()
      const settings = getSettings()
      if (updateSettings({ ...settings, webDarkMode: next })) {
        m.refreshAllTabsDarkMode(() => tabManager.getAllTabViews()).catch(() => {})
      }
    }).catch(() => {})
  })

  // App-scope shortcut actions (window-local, dispatched via before-input-event)
  registerAction('tab:new', () => {
    tabManager.createTab()
    sendToUi('browser:focus-address-bar')
  })
  registerAction('tab:close', () => tabManager.closeTab(tabManager.getActiveTabId()))
  registerAction('tab:restore', () => tabManager.restoreClosed())
  registerAction('tab:next', () => {
    const order = tabManager.getTabOrder()
    if (order.length === 0) return
    const idx = order.indexOf(tabManager.getActiveTabId())
    const next = idx >= order.length - 1 ? 0 : idx + 1
    tabManager.switchTab(order[next])
  })
  registerAction('tab:prev', () => {
    const order = tabManager.getTabOrder()
    if (order.length === 0) return
    const idx = order.indexOf(tabManager.getActiveTabId())
    const prev = idx <= 0 ? order.length - 1 : idx - 1
    tabManager.switchTab(order[prev])
  })
  for (let i = 1; i <= 8; i++) {
    const targetIndex = i - 1
    registerAction(`tab:switch:${i}`, () => {
      const order = tabManager.getTabOrder()
      if (targetIndex < order.length) tabManager.switchTab(order[targetIndex])
    })
  }
  registerAction('tab:switch:last', () => {
    const order = tabManager.getTabOrder()
    if (order.length > 0) tabManager.switchTab(order[order.length - 1])
  })
  registerAction('tab:incognito-new', () => {
    tabManager.createTab(undefined, { session: getIncognitoSession(), incognito: true })
    sendToUi('browser:focus-address-bar')
  })

  registerAction('nav:back', () => tabManager.goBack(tabManager.getActiveTabId()))
  registerAction('nav:forward', () => tabManager.goForward(tabManager.getActiveTabId()))
  registerAction('nav:reload', () => tabManager.reload(tabManager.getActiveTabId()))
  registerAction('nav:reload-alt', () => tabManager.reload(tabManager.getActiveTabId()))
  registerAction('nav:hard-reload', () => {
    const wc = tabManager.getActiveWebContents()
    if (wc) wc.reloadIgnoringCache()
  })
  registerAction('nav:stop', () => tabManager.stop(tabManager.getActiveTabId()))
  registerAction('nav:home', () => {
    const homepage = (getPreferences().startup.homepageUrl || '').trim() || 'zhi://newtab'
    tabManager.loadUrl(tabManager.getActiveTabId(), homepage)
  })

  registerAction('page:find', () => sendToUi('browser:focus-find'))
  registerAction('page:zoom-in', () => {
    const id = tabManager.getActiveTabId()
    tabManager.zoomIn(id)
    const tab = tabManager.getActiveTab()
    if (tab) {
      sendToUi('browser:toast', {
        id: 'zoom',
        text: `缩放：${Math.round(tab.zoomFactor * 100)}%`,
        duration: 2000
      })
    }
  })
  registerAction('page:zoom-out', () => {
    const id = tabManager.getActiveTabId()
    tabManager.zoomOut(id)
    const tab = tabManager.getActiveTab()
    if (tab) {
      sendToUi('browser:toast', {
        id: 'zoom',
        text: `缩放：${Math.round(tab.zoomFactor * 100)}%`,
        duration: 2000
      })
    }
  })
  registerAction('page:zoom-reset', () => {
    tabManager.zoomReset(tabManager.getActiveTabId())
    sendToUi('browser:toast', { id: 'zoom', text: '缩放：100%', duration: 2000 })
  })
  registerAction('page:fullscreen', () => {
    if (!isMainWindowAlive()) return
    try {
      win.setFullScreen(!win.isFullScreen())
    } catch {
      /* window may have been destroyed while handling the shortcut */
    }
  })
  registerAction('page:print', () => {
    const wc = tabManager.getActiveWebContents()
    if (wc) {
      try {
        wc.print({ silent: false, printBackground: true })
      } catch {
        /* user cancelled */
      }
    }
  })
  registerAction('page:view-source', () => {
    const url = tabManager.getActiveTabUrl()
    if (url && /^https?:\/\//i.test(url)) {
      tabManager.createTab(`view-source:${url}`)
    }
  })

  registerAction('address:focus', () => sendToUi('browser:focus-address-bar'))
  registerAction('address:focus-alt', () => sendToUi('browser:focus-address-bar'))

  registerAction('bookmark:add', () => sendToUi('browser:toggle-bookmark'))
  registerAction('bookmark:manage', () => openPanelFromCommand('bookmarks'))
  registerAction('bookmark:bar-toggle', () => {
    toggleBookmarkBarVisible()
  })

  registerAction('devtools:toggle', () => tabManager.toggleDevTools(tabManager.getActiveTabId()))
  registerAction('devtools:toggle-alt', () =>
    tabManager.toggleDevTools(tabManager.getActiveTabId())
  )
  registerAction('devtools:console', () => {
    const wc = tabManager.getActiveWebContents()
    if (!wc) return
    if (wc.isDevToolsOpened()) wc.devToolsWebContents?.focus()
    else wc.openDevTools({ mode: 'right' })
  })

  registerAction('browser:history', () => openSidePanelFromShortcut('history'))
  registerAction('browser:downloads', () => openSidePanelFromShortcut('downloads'))
  registerAction('browser:settings', () => tabManager.createTab('zhi://settings'))
  registerAction('browser:shortcuts', () => tabManager.createTab('zhi://shortcuts'))

  registerAction('ai:toggle', () => sendToUi('browser:toggle-ai-panel'))

  registerScreenshotHandlers(() => tabManager.getActiveWebContents())
  registerCommandPaletteHandlers()
  registerHibernationHandlers()
  initHibernation({
    getTab: tabManager.getTab.bind(tabManager),
    getTabOrder: tabManager.getTabOrder.bind(tabManager),
    getActiveTabId: tabManager.getActiveTabId.bind(tabManager),
    loadUrl: tabManager.loadUrl.bind(tabManager)
  })
  registerQuickNoteHandlers()
  registerPasswordAutoHandlers((channel, payload) => {
    sendToUi(channel, payload)
  })
  registerProxyHandlers(getPreferences, updatePreferences)
  registerIncognitoHandlers({
    createTab: (url, options) => {
      tabManager.createTab(url, {
        session: options.session,
        incognito: options.incognito
      })
    },
    getActiveTabWebContents: () => tabManager.getActiveWebContents()
  })
  registerTranslateHandlers(() => {
    const activeView = tabManager.getActiveTabView()
    return activeView?.webContents ?? null
  })
  registerUserScriptIPC((url, active) => {
    tabManager.createTab(url, { background: !active })
  })
  registerReaderHandlers(() => {
    const activeView = tabManager.getActiveTabView()
    return activeView?.webContents ?? null
  })
  registerSnifferHandlers(
    () => {
      const activeView = tabManager.getActiveTabView()
      return activeView?.webContents?.id ?? null
    },
    (channel, payload) => {
      sendToUi(channel, payload)
      sendToPanel(channel, payload)
    }
  )
  registerTabPreviewHandlers((tabId) => tabManager.getTabViewByWebContentsId(tabId))
  registerWebPanelHandlers(win, () => {
    const fullscreen = isFullscreenChromeMode()
    return {
      top: fullscreen ? 0 : currentChromeHeight,
      leftIconBar: fullscreen ? 0 : getWebPanelRailWidth(),
      verticalTab: fullscreen ? 0 : getVerticalTabWidth()
    }
  }, () => updateLayout())

  registerMouseGestureHandlers((action) => {
    executeGestureAction(
      action,
      () => tabManager.getActiveTabView(),
      () => {
        tabManager.createTab()
        sendToUi('browser:focus-address-bar')
      },
      () => tabManager.closeTab(tabManager.getActiveTabId()),
      () => tabManager.restoreClosed()
    )
  })
  registerSplitViewHandlers(
    () => win,
    getBrowserContentBounds,
    () => updateLayout(),
    (url) => tabManager.createTab(url),
    validateSender
  )
  tabManager.setPageBoundsProvider((bounds) => {
    if (isFullscreenChromeMode()) return bounds

    const verticalTabWidth = getVerticalTabWidth()
    const leftOffset = getWebPanelRailWidth() + verticalTabWidth + getWebPanelOffset()

    const availableWidth = Math.max(0, bounds.width - leftOffset)
    return {
      ...bounds,
      x: bounds.x + leftOffset,
      width: isSplitViewActive() ? getLeftViewWidth(availableWidth) : availableWidth
    }
  })
  registerDarkModeHandlers({
    getAllViews: () => tabManager.getAllTabViews(),
    validateSender: (event) => {
      return (
        event.sender === uiView.webContents ||
        event.sender === panelView?.webContents ||
        isTrustedRendererShell(event.sender)
      )
    },
    onDarkModeChanged: (enabled) => {
      win.setBackgroundColor(getWindowBackgroundColor())
      if (!enabled) {
        tabManager.releaseDarkModeHiddenViews()
      }
    },
    onSettingsChanged: (updated) => {
      sendToUi('browser:settings', updated)
      sendToPanel('browser:settings', updated)
    }
  })

  startShortcuts()

  // Defer panel renderer startup until the main UI has finished loading. This
  // avoids two renderer processes spinning up simultaneously and competing for
  // CPU/IPC during the user-visible first paint. A backstop timer + lazy
  // trigger in showPanelView ensure the panel always loads in time for use.
  let panelLoadTriggered = false
  const triggerPanelLoad = (): void => {
    if (panelLoadTriggered) return
    panelLoadTriggered = true
    if (!panelView || panelView.webContents.isDestroyed()) return
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      panelView.webContents.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?panel=true`)
    } else {
      panelView.webContents.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { panel: 'true' }
      })
    }
  }
  ensurePanelLoaded = triggerPanelLoad
  uiView.webContents.once('did-finish-load', () => {
    setImmediate(triggerPanelLoad)
  })
  // Backstop in case the UI view never finishes loading (rare).
  setTimeout(triggerPanelLoad, 4000)

  // Handle keyboard shortcuts from uiView via the central shortcut registry.
  uiView.webContents.on('before-input-event', (event, input) => {
    if (dispatchAppShortcut(input)) {
      event.preventDefault()
    }
  })

  updateLayout()
  win.on('resize', updateLayout)
  win.on('enter-full-screen', () => handleFullscreenChanged(true))
  win.on('leave-full-screen', () => handleFullscreenChanged(false))

  restoreSession()

  // Push initial state once uiView is loaded so renderer gets tabs immediately
  uiView.webContents.once('did-finish-load', () => {
    pushBrowserState()
  })

  win.on('close', () => {
    try {
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
    } catch {
      /* window may already be torn down */
    }
    saveSession()
    tabManager.destroyAll()
  })
  win.on('closed', () => {
    panelView = null
    panelVisible = false
    panelReady = false
    ensurePanelLoaded = null
  })
}

function updateLayout(): void {
  if (!isMainWindowAlive() || typeof tabManager === 'undefined') return
  if (isFullscreenChromeMode() && panelVisible) {
    hidePanelView(false)
  }
  try {
    tabManager.updateLayout()
    relayoutSplitView(getBrowserContentBounds)
    if (panelVisible && isPanelViewAlive()) {
      const { width, height } = win.getContentBounds()
      panelView?.setBounds({
        x: width - PANEL_WIDTH - PANEL_RIGHT_MARGIN,
        y: currentChromeHeight,
        width: PANEL_WIDTH,
        height: Math.max(0, height - currentChromeHeight)
      })
    }
  } catch {
    /* ignore layout events racing with window teardown */
  }
}

function sendPanelType(): void {
  if (!panelReady || !isPanelViewAlive()) return
  sendToPanel('browser:panel-type', currentPanelType)
}

function pushBrowserState(): void {
  if (typeof tabManager === 'undefined') return
  const state = tabManager.getBrowserState()
  sendToUi('browser:state', state)
  if (panelReady) sendToPanel('browser:state', state)

  const activeTab = tabManager.getActiveTab()
  if (activeTab && isMainWindowAlive()) {
    try {
      win.title = activeTab.title ? `${activeTab.title} - ${WINDOW_BRAND}` : WINDOW_BRAND
    } catch {
      /* window may be gone */
    }
  }
}

function saveSession(): void {
  if (sessionSaved) return
  sessionSaved = true

  const sessionData = tabManager.getSessionData()
  writeJSON('session.json', sessionData)
}

function restoreSession(): void {
  const explicitStartupTarget = pendingStartupUrl
  pendingStartupUrl = null
  const prefs = getPreferences()

  if (explicitStartupTarget) {
    tabManager.createTab(explicitStartupTarget)
    return
  }

  if (prefs.startup.behavior === 'homepage') {
    const homepageUrl = prefs.startup.homepageUrl.trim()
    if (!homepageUrl || /^zhi:\/\/newtab\/?$/i.test(homepageUrl)) {
      tabManager.createTab('zhi://newtab')
      return
    }

    const normalized = normalizeUrl(homepageUrl)
    const url = isValidNavigableUrl(homepageUrl) ? normalized || homepageUrl : 'zhi://newtab'
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
      // Restore every saved tab in deferred-load mode so we don't spawn N
      // renderer processes simultaneously at startup. The active tab's load is
      // triggered immediately by the switchTab call below; the rest load when
      // the user first switches to them.
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
  if (!isMainWindowAlive() || !isPanelViewAlive()) return
  const view = panelView
  if (!view) return

  // Make sure the panel renderer has been kicked off (it may have been deferred
  // during startup). Calling this is idempotent.
  ensurePanelLoaded?.()

  let width = 0
  let height = 0
  try {
    ;({ width, height } = win.getContentBounds())
  } catch {
    return
  }
  currentPanelType = type

  view.setBounds({
    x: width - PANEL_WIDTH - PANEL_RIGHT_MARGIN,
    y: currentChromeHeight,
    width: PANEL_WIDTH,
    height: Math.max(0, height - currentChromeHeight)
  })

  sendPanelType()

  if (panelVisible) {
    try {
      win.contentView.removeChildView(view)
    } catch {
      // may not be attached
    }
  }
  try {
    win.contentView.addChildView(view)
  } catch {
    return
  }
  panelVisible = true
  try {
    view.webContents.focus()
  } catch {
    /* panel may have closed */
  }
}

function hidePanelView(notifyRenderer = true): void {
  if (!isMainWindowAlive() || !isPanelViewAlive() || !panelVisible) return
  try {
    win.contentView.removeChildView(panelView!)
  } catch {
    // may not be attached
  }
  panelVisible = false
  if (notifyRenderer) {
    sendToUi('browser:panel-closed')
  }
}

function getRawContentBounds(): { x: number; y: number; width: number; height: number } {
  let width = 0
  let height = 0
  try {
    if (isMainWindowAlive()) {
      ;({ width, height } = win.getContentBounds())
    }
  } catch {
    width = 0
    height = 0
  }
  return {
    x: 0,
    y: currentChromeHeight,
    width,
    height: Math.max(0, height - currentChromeHeight)
  }
}

function getBrowserContentBounds(): { x: number; y: number; width: number; height: number } {
  const bounds = getRawContentBounds()
  if (isFullscreenChromeMode()) return bounds

  const verticalTabWidth = getVerticalTabWidth()
  const leftOffset = getWebPanelRailWidth() + verticalTabWidth + getWebPanelOffset()

  return {
    ...bounds,
    x: bounds.x + leftOffset,
    width: Math.max(0, bounds.width - leftOffset)
  }
}

// ===== IPC Handlers =====

function setupIPC(): void {
  const validateUiSender = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent
  ): boolean => {
    return isUiViewAlive() && event.sender === uiView.webContents
  }

  const isSidePanelType = (type: unknown): type is SidePanelType => {
    return typeof type === 'string' && SIDE_PANEL_TYPES.has(type as SidePanelType)
  }

  const normalizeLayout = (layout: BrowserLayout): BrowserLayout => {
    const uiViewHeight = Number.isFinite(layout.uiViewHeight)
      ? Math.max(0, Math.round(layout.uiViewHeight))
      : TOP_CHROME_HEIGHT
    const pageTop = Number.isFinite(layout.pageTop)
      ? Math.max(0, Math.round(layout.pageTop))
      : uiViewHeight
    const uiViewWidth = Number.isFinite(layout.uiViewWidth)
      ? Math.max(0, Math.round(layout.uiViewWidth as number))
      : null

    return { uiViewHeight, pageTop, uiViewWidth }
  }

  ipcMain.on('ui:set-height', (event, height: number) => {
    if (!validateUiSender(event)) return
    const normalizedHeight = Number.isFinite(height)
      ? Math.max(MIN_CHROME_HEIGHT, Math.round(height))
      : TOP_CHROME_HEIGHT
    const layout: BrowserLayout = {
      uiViewHeight: normalizedHeight,
      uiViewWidth: null,
      pageTop: normalizedHeight
    }
    lastWindowedLayout = layout
    applyBrowserLayout(layout)
  })

  ipcMain.on('ui:set-layout', (event, layout: BrowserLayout) => {
    if (!validateUiSender(event)) return
    const normalized = normalizeLayout(layout)
    if (!isFullscreenChromeMode() && normalized.pageTop > 0) {
      lastWindowedLayout = normalized
    }
    applyBrowserLayout(normalized)
  })

  ipcMain.on('ui-overlay-show', () => {
    tabManager.setModalOverlayActive(true)
  })

  ipcMain.on('ui-overlay-hide', () => {
    tabManager.setModalOverlayActive(false)
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
    if (!validateUiSender(event) || !isMainWindowAlive()) return
    popupMenu({ window: win })
  })

  ipcMain.on('page:primary-pointer', (event) => {
    const activeWebContents = tabManager.getActiveWebContents()
    if (!activeWebContents || event.sender !== activeWebContents) return
    collapseTransientChromeFromPage()
  })

  ipcMain.handle('window:toggle-fullscreen', (event) => {
    if (!validateUiSender(event) || !isMainWindowAlive()) return false
    try {
      const nextState = !win.isFullScreen()
      win.setFullScreen(nextState)
      handleFullscreenChanged(nextState)
      return nextState
    } catch {
      return false
    }
  })

  ipcMain.handle('window:is-fullscreen', (event) => {
    if (!validateUiSender(event) || !isMainWindowAlive()) return false
    try {
      return win.isFullScreen()
    } catch {
      return false
    }
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

  ipcMain.handle('tab:toggle-devtools', (event, tabId?: string) => {
    if (!validateSender(event)) return { success: false }
    const targetTabId = typeof tabId === 'string' && tabId ? tabId : tabManager.getActiveTabId()
    tabManager.toggleDevTools(targetTabId)
    return { success: true }
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

  ipcMain.handle(
    'bookmarks:update',
    (
      event,
      id: string,
      titleOrUpdates: string | { title?: string; url?: string; folder?: string; favicon?: string },
      url?: string
    ) => {
      try {
        if (!validateSender(event)) return []
        const updates =
          typeof titleOrUpdates === 'object'
            ? titleOrUpdates
            : { title: titleOrUpdates, url: typeof url === 'string' ? url : '' }
        const nextTitle = typeof updates.title === 'string' ? updates.title.trim() : undefined
        const nextUrl = typeof updates.url === 'string' ? updates.url.trim() : undefined
        if (!id) return typeof titleOrUpdates === 'object' ? { success: false } : getBookmarks()
        if (nextUrl && !nextUrl.includes('.') && !nextUrl.includes('://')) {
          return typeof titleOrUpdates === 'object' ? { success: false } : getBookmarks()
        }
        const updated = updateBookmark(id, {
          ...updates,
          title: nextTitle,
          url: nextUrl
        })
        broadcastBookmarksChanged()
        return typeof titleOrUpdates === 'object' ? { success: true } : updated
      } catch {
        return typeof titleOrUpdates === 'object' ? { success: false } : []
      }
    }
  )

  ipcMain.handle('bookmarks:clear', (event) => {
    try {
      if (!validateSender(event)) return { success: false }
      clearBookmarks()
      broadcastBookmarksChanged()
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('bookmarks:getAll', (event, options?: { folder?: string; search?: string }) => {
    try {
      if (!validateSender(event)) return []
      return getManagedBookmarks(options)
    } catch {
      return []
    }
  })

  ipcMain.handle(
    'bookmarks:add',
    (event, entry: { url: string; title: string; folder?: string; favicon?: string }) => {
      try {
        if (!validateSender(event)) return { success: false }
        const bookmark = addManagedBookmark(entry)
        broadcastBookmarksChanged()
        return { success: true, id: bookmark.id }
      } catch {
        return { success: false }
      }
    }
  )

  ipcMain.handle('bookmarks:delete', (event, ids: string[]) => {
    try {
      if (!validateSender(event)) return { success: false }
      removeBookmarks(Array.isArray(ids) ? ids : [])
      broadcastBookmarksChanged()
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('bookmarks:getFolders', (event) => {
    try {
      if (!validateSender(event)) return []
      return getBookmarkFolders()
    } catch {
      return []
    }
  })

  ipcMain.handle('bookmarks:search', (event, keyword: string) => {
    try {
      if (!validateSender(event)) return []
      return searchBookmarks(keyword || '')
    } catch {
      return []
    }
  })

  ipcMain.handle('bookmarks:getForAI', (event, query: string) => {
    try {
      if (!validateSender(event)) return []
      return getBookmarksForAI(query || '')
    } catch {
      return []
    }
  })

  // History
  ipcMain.handle('history:list', (event, args?: { limit?: number; query?: string }) => {
    try {
      if (!validateSender(event)) return []
      return getHistory(args?.limit, args?.query)
    } catch {
      return []
    }
  })

  ipcMain.handle('history:clear', (event) => {
    try {
      if (!validateSender(event)) return { success: false }
      clearHistory()
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('history:remove', (event, id: string) => {
    try {
      if (!validateSender(event)) return { success: false }
      removeHistoryEntry(id)
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle(
    'history:getAll',
    (event, options?: { limit?: number; offset?: number; search?: string }) => {
      try {
        if (!validateSender(event)) return { items: [], total: 0 }
        return getHistoryPage(options)
      } catch {
        return { items: [], total: 0 }
      }
    }
  )

  ipcMain.handle('history:delete', (event, ids: string[]) => {
    try {
      if (!validateSender(event)) return { success: false }
      removeHistoryEntries(Array.isArray(ids) ? ids : [])
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('history:search', (event, keyword: string) => {
    try {
      if (!validateSender(event)) return []
      return searchHistory(keyword || '')
    } catch {
      return []
    }
  })

  ipcMain.handle('history:getForAI', (event, query: string) => {
    try {
      if (!validateSender(event)) return []
      return getHistoryForAI(query || '')
    } catch {
      return []
    }
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

  // Quick Search
  ipcMain.handle('quickSearch:getEngine', () => {
    return getPreferences().quickSearch?.engine || 'google'
  })

  ipcMain.handle('quickSearch:setEngine', (_e, engine: string) => {
    const prefs = getPreferences()
    if (!prefs.quickSearch) {
      prefs.quickSearch = { engine: 'google' }
    }
    prefs.quickSearch.engine = engine
    updatePreferences({ quickSearch: prefs.quickSearch })
    return true
  })

  ipcMain.handle(
    'quickSearch:menu-open',
    async (
      event,
      payload: {
        x: number
        y: number
        selectedId: string
        engines: Array<{ id: string; name: string; urlTemplate: string; icon: string }>
        appTheme?: string
      }
    ): Promise<string | null> => {
      if (!validateSender(event)) return null
      const parent = BrowserWindow.fromWebContents(event.sender)
      if (!parent) return null

      if (quickSearchMenuWindow && !quickSearchMenuWindow.isDestroyed()) {
        quickSearchMenuWindow.close()
      }

      const palette = getMenuThemePalette(payload.appTheme || 'void')
      const width = 340
      const rowHeight = 48
      const titleHeight = 38
      const padding = 16
      const height = Math.min(
        420,
        Math.max(170, titleHeight + payload.engines.length * rowHeight + padding)
      )

      const display = screen.getDisplayNearestPoint({ x: Math.round(payload.x), y: Math.round(payload.y) })
      const bounds = display.workArea
      const x = Math.max(bounds.x + 8, Math.min(Math.round(payload.x), bounds.x + bounds.width - width - 8))
      const y = Math.max(bounds.y + 8, Math.min(Math.round(payload.y), bounds.y + bounds.height - height - 8))

      quickSearchMenuWindow = new BrowserWindow({
        width,
        height,
        x,
        y,
        parent,
        modal: false,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: true,
        show: false,
        backgroundColor: palette.bg,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      })

      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>QuickSearch</title>
<style>
html,body{margin:0;background:${palette.bg};color:${palette.text};font:13px "Segoe UI",Arial,sans-serif}
.box{height:100%;padding:8px;border:1px solid ${palette.border};border-radius:14px;background:linear-gradient(180deg,${palette.bg2},${palette.bg})}
.title{padding:8px 10px;color:${palette.muted};font-weight:650;letter-spacing:.04em}
.opt{width:100%;height:44px;border:0;border-radius:10px;background:transparent;color:${palette.text};display:flex;align-items:center;padding:0 10px;text-align:left;cursor:pointer;gap:10px}
.opt:hover{background:${palette.hover}}
.opt.active{background:linear-gradient(90deg,${palette.activeA},${palette.activeB})}
.name{font-weight:600}
.icon{width:18px;height:18px;border-radius:4px;object-fit:contain;flex:0 0 auto}
.sp{height:1px;margin:8px 6px;background:${palette.border}}
.custom{color:${palette.text}}
.custom-main{flex:1}
.custom-settings{width:34px;height:34px;padding:0;justify-content:center}
</style></head><body><div class="box"><div class="title">选择搜索引擎</div><div id="list"></div></div>
<script>
const payload=${JSON.stringify(payload)};
const list=document.getElementById('list');
function done(v){ location.href='zhi-search-menu://select?id='+encodeURIComponent(v||''); }
for(const e of payload.engines){
  if(e.id==='custom') continue;
  const b=document.createElement('button');
  b.className='opt'+(e.id===payload.selectedId?' active':'');
  b.innerHTML='<img class="icon" alt=""/><span class="name"></span>';
  b.querySelector('.icon').src=e.icon||'';
  b.querySelector('.name').textContent=e.name;
  b.onclick=()=>done(e.id);
  list.appendChild(b);
}
const sp=document.createElement('div');sp.className='sp';list.appendChild(sp);
const customRow=document.createElement('div');
customRow.style.display='flex';
customRow.style.gap='8px';
customRow.style.alignItems='center';
const customMain=document.createElement('button');
customMain.className='opt custom custom-main';
customMain.innerHTML='<span class="icon">自</span><span class="name">自定义搜索引擎</span>';
customMain.onclick=()=>done('custom');
const customSettings=document.createElement('button');
customSettings.className='opt custom custom-settings';
customSettings.innerHTML='<span class="icon">⚙</span>';
customSettings.title='编辑自定义搜索引擎';
customSettings.onclick=(ev)=>{ ev.stopPropagation(); done('__custom_settings__'); };
customRow.appendChild(customMain);
customRow.appendChild(customSettings);
list.appendChild(customRow);
window.addEventListener('keydown',(ev)=>{ if(ev.key==='Escape') done(''); });
window.addEventListener('blur',()=>done(''));
</script></body></html>`

      return await new Promise<string | null>((resolve) => {
        let resolved = false
        const finish = (value: string | null): void => {
          if (resolved) return
          resolved = true
          resolve(value)
          try {
            quickSearchMenuWindow?.close()
          } catch {
            /* ignore */
          }
          quickSearchMenuWindow = null
        }

        quickSearchMenuWindow?.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
        quickSearchMenuWindow?.webContents.on('will-navigate', (navEvent, targetUrl) => {
          if (!targetUrl.startsWith('zhi-search-menu://select')) return
          navEvent.preventDefault()
          try {
            const parsed = new URL(targetUrl)
            const id = parsed.searchParams.get('id') || ''
            finish(id || null)
          } catch {
            finish(null)
          }
        })
        quickSearchMenuWindow?.on('closed', () => finish(null))
        quickSearchMenuWindow?.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).then(() => {
          quickSearchMenuWindow?.show()
          quickSearchMenuWindow?.focus()
        }).catch(() => finish(null))
      })
    }
  )

  ipcMain.handle(
    'theme:menu-open',
    async (
      event,
      payload: {
        x: number
        y: number
        selectedId: string
        themes: Array<{ id: string; name: string; color: string }>
        appTheme?: string
      }
    ): Promise<string | null> => {
      if (!validateSender(event)) return null
      const parent = BrowserWindow.fromWebContents(event.sender)
      if (!parent) return null

      if (themeMenuWindow && !themeMenuWindow.isDestroyed()) {
        themeMenuWindow.close()
      }

      const palette = getMenuThemePalette(payload.appTheme || 'void')
      const width = 250
      const rowHeight = 40
      const titleHeight = 38
      const padding = 14
      const height = Math.min(
        420,
        Math.max(180, titleHeight + payload.themes.length * rowHeight + padding)
      )

      const display = screen.getDisplayNearestPoint({ x: Math.round(payload.x), y: Math.round(payload.y) })
      const bounds = display.workArea
      const x = Math.max(bounds.x + 8, Math.min(Math.round(payload.x), bounds.x + bounds.width - width - 8))
      const y = Math.max(bounds.y + 8, Math.min(Math.round(payload.y), bounds.y + bounds.height - height - 8))

      themeMenuWindow = new BrowserWindow({
        width,
        height,
        x,
        y,
        parent,
        modal: false,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: false,
        hasShadow: true,
        show: false,
        backgroundColor: palette.bg,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      })

      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Theme</title>
<style>
html,body{margin:0;background:${palette.bg};color:${palette.text};font:13px "Segoe UI",Arial,sans-serif}
.box{height:100%;padding:8px;border:1px solid ${palette.border};border-radius:12px;background:linear-gradient(180deg,${palette.bg2},${palette.bg})}
.title{padding:8px 10px;color:${palette.muted};font-weight:650;letter-spacing:.04em}
.opt{width:100%;height:36px;border:0;border-radius:8px;background:transparent;color:${palette.text};display:flex;align-items:center;padding:0 10px;text-align:left;cursor:pointer;gap:10px}
.opt:hover{background:${palette.hover}}
.opt.active{background:linear-gradient(90deg,${palette.activeA},${palette.activeB})}
.dot{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.18);flex:0 0 auto}
.name{font-weight:600}
</style></head><body><div class="box"><div class="title">主题</div><div id="list"></div></div>
<script>
const payload=${JSON.stringify(payload)};
const list=document.getElementById('list');
function done(v){ location.href='zhi-theme-menu://select?id='+encodeURIComponent(v||''); }
for(const t of payload.themes){
  const b=document.createElement('button');
  b.className='opt'+(t.id===payload.selectedId?' active':'');
  b.innerHTML='<span class="dot"></span><span class="name"></span>';
  b.querySelector('.dot').style.background=t.color||'#222';
  b.querySelector('.name').textContent=t.name;
  b.onclick=()=>done(t.id);
  list.appendChild(b);
}
window.addEventListener('keydown',(ev)=>{ if(ev.key==='Escape') done(''); });
window.addEventListener('mouseleave',()=>{});
</script></body></html>`

      return await new Promise<string | null>((resolve) => {
        let resolved = false
        const finish = (value: string | null): void => {
          if (resolved) return
          resolved = true
          resolve(value)
          try {
            themeMenuWindow?.close()
          } catch {
            /* ignore */
          }
          themeMenuWindow = null
        }

        themeMenuWindow?.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
        themeMenuWindow?.webContents.on('will-navigate', (navEvent, targetUrl) => {
          if (!targetUrl.startsWith('zhi-theme-menu://select')) return
          navEvent.preventDefault()
          try {
            const parsed = new URL(targetUrl)
            const id = parsed.searchParams.get('id') || ''
            finish(id || null)
          } catch {
            finish(null)
          }
        })
        themeMenuWindow?.on('blur', () => finish(null))
        themeMenuWindow?.on('closed', () => finish(null))
        themeMenuWindow?.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).then(() => {
          themeMenuWindow?.show()
          themeMenuWindow?.focus()
        }).catch(() => finish(null))
      })
    }
  )

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
      appName: APP_DISPLAY_NAME,
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
  // Critical-path: register IPC handlers and download infrastructure synchronously
  // so the renderer can query state immediately on mount. These calls are cheap
  // (just hooking up listeners) and don't actually do work.
  pendingStartupUrl = extractUrlFromArgs(process.argv, process.cwd())
  logStartupIntent('[startup-intent] process argv', { argv: process.argv, cwd: process.cwd() })
  logStartupIntent('[startup-intent] initial resolved target', { url: pendingStartupUrl })
  registerDownloaderHandlers()
  registerBuiltinDownloaderHandlers(
    () => getPreferences(),
    () => win,
    () => uiView.webContents
  )
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

  // Show the window as early as possible.
  createWindow()

  // Heavy non-critical work runs after the main UI renderer has had a chance
  // to start, so it does not contend with first-paint for CPU/IPC bandwidth.
  let deferredStartupRan = false
  const runDeferredStartup = (): void => {
    if (deferredStartupRan) return
    deferredStartupRan = true
    try {
      loadCompletedDownloads()
      pushBrowserState()
    } catch (err) {
      console.warn('[startup] loadCompletedDownloads failed', err)
    }
    getExtensionSystem()
      .initialize()
      .catch((err) => console.warn('[startup] extension init failed', err))
    proxyAutoStart(getPreferences).catch((err) =>
      console.warn('[startup] proxy auto-start failed', err)
    )
  }
  uiView.webContents.once('did-finish-load', () => {
    setImmediate(runDeferredStartup)
  })
  // Backstop: if did-finish-load somehow does not fire (load aborted, etc.),
  // ensure deferred work still runs within a few seconds.
  setTimeout(runDeferredStartup, 5000)
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  appIsQuitting = true
  saveSession()
  import('./proxy/core').then(m => m.stopCore()).catch(() => {})
})
