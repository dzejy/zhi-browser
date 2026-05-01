import {
  app,
  BaseWindow,
  ipcMain,
  Menu,
  net,
  protocol,
  session as electronSession,
  WebContentsView,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type {
  BookmarkItem,
  DownloadItem,
  DownloadState,
  HistoryItem,
  ZoomAction
} from '../shared/types'
import { APP_TITLE, NEW_TAB_URL } from './navigation'
import { BrowserStorage } from './storage'
import { TabManager } from './tabs'

const UI_HEIGHT = 104
const DEV_RENDERER_PROTOCOL = 'zhi-ui'

let activeTabManager: TabManager | null = null

if (is.dev) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: DEV_RENDERER_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
  ])
}

function stripContentSecurityPolicyMeta(html: string): string {
  return html.replace(
    /\s*<meta\b(?=[^>]*http-equiv=["']Content-Security-Policy["'])[^>]*>\s*/i,
    '\n'
  )
}

function createResponseHeaders(response: Response, contentType?: string): Headers {
  const headers = new Headers(response.headers)
  headers.delete('content-security-policy')
  headers.delete('content-security-policy-report-only')
  headers.delete('content-encoding')
  headers.delete('content-length')

  if (contentType) {
    headers.set('content-type', contentType)
  }

  return headers
}

function registerDevRendererProtocol(rendererUrl: string): void {
  if (!is.dev || !rendererUrl || protocol.isProtocolHandled(DEV_RENDERER_PROTOCOL)) {
    return
  }

  const rendererBaseUrl = new URL(rendererUrl)

  protocol.handle(DEV_RENDERER_PROTOCOL, async (request) => {
    const requestUrl = new URL(request.url)
    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, rendererBaseUrl)
    const response = await net.fetch(upstreamUrl.toString())

    if (requestUrl.pathname === '/' || requestUrl.pathname === '') {
      const html = stripContentSecurityPolicyMeta(await response.text())

      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: createResponseHeaders(response, 'text/html; charset=utf-8')
      })
    }

    return response
  })
}

function getRendererEntryUrl(): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${DEV_RENDERER_PROTOCOL}://renderer/`
  }

  return ''
}

function createWindow(): void {
  const mainWindow = new BaseWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 420,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: APP_TITLE,
    ...(process.platform === 'linux' ? { icon } : {})
  })

  const uiView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  uiView.setBackgroundColor('#202124')
  mainWindow.contentView.addChildView(uiView)

  const storage = new BrowserStorage(app.getPath('userData'))

  const requestAddressBarFocus = (): void => {
    if (uiView.webContents.isDestroyed()) {
      return
    }

    uiView.webContents.focus()
    uiView.webContents.send('browser:focus-address-bar')
  }

  const tabManager = new TabManager({
    window: mainWindow,
    uiView,
    uiHeight: UI_HEIGHT,
    storage,
    focusAddressBar: requestAddressBarFocus,
    updateWindowTitle: (title) => {
      mainWindow.setTitle(title && title !== 'New Tab' ? `${title} - ${APP_TITLE}` : APP_TITLE)
    }
  })

  activeTabManager = tabManager

  const isFromUiView = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    event.sender === uiView.webContents

  const getTabId = (payload: unknown): string => {
    const tabId = readString(payload, 'tabId')
    return tabId || tabManager.getActiveTabId()
  }

  const handleCreateTab = (event: IpcMainEvent, payload?: unknown): void => {
    if (!isFromUiView(event)) {
      return
    }

    tabManager.createTab(readString(payload, 'url') || NEW_TAB_URL, true)
    requestAddressBarFocus()
  }

  const handleCloseTab = (event: IpcMainEvent, payload?: unknown): void => {
    if (isFromUiView(event)) {
      tabManager.closeTab(getTabId(payload))
    }
  }

  const handleSwitchTab = (event: IpcMainEvent, payload?: unknown): void => {
    if (isFromUiView(event)) {
      tabManager.switchTab(getTabId(payload))
    }
  }

  const handleLoadUrl = (event: IpcMainEvent, payload?: unknown): void => {
    if (!isFromUiView(event)) {
      return
    }

    const url = readString(payload, 'url')

    if (url) {
      tabManager.loadUrl(getTabId(payload), url)
    }
  }

  const handleBack = (event: IpcMainEvent, payload?: unknown): void => {
    if (isFromUiView(event)) {
      tabManager.goBack(getTabId(payload))
    }
  }

  const handleForward = (event: IpcMainEvent, payload?: unknown): void => {
    if (isFromUiView(event)) {
      tabManager.goForward(getTabId(payload))
    }
  }

  const handleReload = (event: IpcMainEvent, payload?: unknown): void => {
    if (isFromUiView(event)) {
      tabManager.reload(getTabId(payload))
    }
  }

  const handleStop = (event: IpcMainEvent, payload?: unknown): void => {
    if (isFromUiView(event)) {
      tabManager.stop(getTabId(payload))
    }
  }

  const handleZoom = (event: IpcMainEvent, payload?: unknown): void => {
    if (!isFromUiView(event)) {
      return
    }

    const action = readString(payload, 'action')

    if (action === 'in' || action === 'out' || action === 'reset') {
      tabManager.zoom(getTabId(payload), action as ZoomAction)
    }
  }

  const handleRequestState = (event: IpcMainEvent): void => {
    if (isFromUiView(event)) {
      tabManager.pushState()
    }
  }

  const handleAddBookmark = (event: IpcMainInvokeEvent, payload?: unknown): BookmarkItem | null => {
    if (!isFromUiView(event)) {
      return null
    }

    const url = readString(payload, 'url')

    if (!url) {
      return null
    }

    return storage.addBookmark({
      url,
      title: readString(payload, 'title') || url,
      favicon: readString(payload, 'favicon'),
      createdAt: Date.now()
    })
  }

  const handleRemoveBookmark = (event: IpcMainInvokeEvent, payload?: unknown): boolean => {
    if (!isFromUiView(event)) {
      return false
    }

    const url = readString(payload, 'url')
    return url ? storage.removeBookmark(url) : false
  }

  const handleListBookmarks = (event: IpcMainInvokeEvent): BookmarkItem[] => {
    if (!isFromUiView(event)) {
      return []
    }

    return storage.listBookmarks()
  }

  const handleListHistory = (event: IpcMainInvokeEvent, payload?: unknown): HistoryItem[] => {
    if (!isFromUiView(event)) {
      return []
    }

    const limit = readNumber(payload, 'limit')
    return storage.listHistory(limit || undefined)
  }

  const handleClearHistory = (event: IpcMainInvokeEvent): boolean => {
    if (!isFromUiView(event)) {
      return false
    }

    storage.clearHistory()
    return true
  }

  const sendDownloadUpdate = (item: DownloadItem): void => {
    if (!uiView.webContents.isDestroyed()) {
      uiView.webContents.send('browser:download-update', item)
    }
  }

  const handleDownload = (_event: Electron.Event, item: Electron.DownloadItem): void => {
    const id = randomUUID()
    const toDownloadItem = (state: DownloadState): DownloadItem => ({
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: item.getReceivedBytes(),
      state,
      savePath: item.getSavePath()
    })

    sendDownloadUpdate(toDownloadItem('progressing'))

    item.on('updated', (_downloadEvent, state) => {
      sendDownloadUpdate(toDownloadItem(state === 'interrupted' ? 'interrupted' : 'progressing'))
    })

    item.once('done', (_downloadEvent, state) => {
      sendDownloadUpdate(toDownloadItem(state as DownloadState))
    })
  }

  ipcMain.on('tab:create', handleCreateTab)
  ipcMain.on('tab:close', handleCloseTab)
  ipcMain.on('tab:switch', handleSwitchTab)
  ipcMain.on('tab:load-url', handleLoadUrl)
  ipcMain.on('tab:back', handleBack)
  ipcMain.on('tab:forward', handleForward)
  ipcMain.on('tab:reload', handleReload)
  ipcMain.on('tab:stop', handleStop)
  ipcMain.on('tab:zoom', handleZoom)
  ipcMain.on('browser:request-state', handleRequestState)
  ipcMain.handle('bookmark:add', handleAddBookmark)
  ipcMain.handle('bookmark:remove', handleRemoveBookmark)
  ipcMain.handle('bookmark:list', handleListBookmarks)
  ipcMain.handle('history:list', handleListHistory)
  ipcMain.handle('history:clear', handleClearHistory)

  electronSession.defaultSession.on('will-download', handleDownload)

  uiView.webContents.on('before-input-event', (event, input) => {
    tabManager.handleKeyboardInput(event, input)
  })

  uiView.webContents.once('did-finish-load', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
      requestAddressBarFocus()
      tabManager.pushState()
    }
  })

  uiView.webContents.once('did-fail-load', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  mainWindow.on('resize', () => {
    tabManager.updateBounds()
  })

  mainWindow.on('closed', () => {
    tabManager.cleanup()

    if (activeTabManager === tabManager) {
      activeTabManager = null
    }

    electronSession.defaultSession.off('will-download', handleDownload)
    ipcMain.off('tab:create', handleCreateTab)
    ipcMain.off('tab:close', handleCloseTab)
    ipcMain.off('tab:switch', handleSwitchTab)
    ipcMain.off('tab:load-url', handleLoadUrl)
    ipcMain.off('tab:back', handleBack)
    ipcMain.off('tab:forward', handleForward)
    ipcMain.off('tab:reload', handleReload)
    ipcMain.off('tab:stop', handleStop)
    ipcMain.off('tab:zoom', handleZoom)
    ipcMain.off('browser:request-state', handleRequestState)
    ipcMain.removeHandler('bookmark:add')
    ipcMain.removeHandler('bookmark:remove')
    ipcMain.removeHandler('bookmark:list')
    ipcMain.removeHandler('history:list')
    ipcMain.removeHandler('history:clear')
  })

  tabManager.updateBounds()

  const rendererEntryUrl = getRendererEntryUrl()

  if (rendererEntryUrl) {
    void uiView.webContents.loadURL(rendererEntryUrl)
  } else {
    void uiView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }

  tabManager.restoreSession(storage.readSession())
}

function readString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== 'object' || !(key in payload)) {
    return ''
  }

  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function readNumber(payload: unknown, key: string): number | undefined {
  if (!payload || typeof payload !== 'object' || !(key in payload)) {
    return undefined
  }

  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  // Remove default application menu so Ctrl+W does not close the window.
  // Tab close is handled via before-input-event in TabManager.
  Menu.setApplicationMenu(null)

  if (process.env['ELECTRON_RENDERER_URL']) {
    registerDevRendererProtocol(process.env['ELECTRON_RENDERER_URL'])
  }

  createWindow()

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  activeTabManager?.saveSessionNow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
