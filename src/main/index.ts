import {
  app,
  BaseWindow,
  ipcMain,
  net,
  protocol,
  WebContentsView,
  type IpcMainEvent
} from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

interface PageState {
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface PageLoadError {
  url: string
  errorCode: number
  errorDescription: string
}

const UI_HEIGHT = 90
const INITIAL_URL = 'https://example.com'
const APP_TITLE = 'Zhi Browser'
const ERR_NAME_NOT_RESOLVED = -105
const ERR_ABORTED = -3
const DEV_RENDERER_PROTOCOL = 'zhi-ui'

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

function isFocusAddressBarShortcut(input: {
  type?: string
  key?: string
  control?: boolean
  meta?: boolean
}): boolean {
  return (
    input.type === 'keyDown' &&
    (input.control === true || input.meta === true) &&
    input.key?.toLowerCase() === 'l'
  )
}

function normalizeNavigationUrl(value: string): string {
  const trimmed = value.trim()

  if (!trimmed || /\s/.test(trimmed)) {
    return ''
  }

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsedUrl = new URL(candidate)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return ''
    }

    return parsedUrl.href
  } catch {
    return ''
  }
}

function getDisplayTitle(url: string): string {
  try {
    return new URL(url).hostname || APP_TITLE
  } catch {
    return APP_TITLE
  }
}

function isFallbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.startsWith('www.') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(':')
  )
}

function getWwwFallbackUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)

    if (
      (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
      isFallbackHost(parsedUrl.hostname)
    ) {
      return ''
    }

    parsedUrl.hostname = `www.${parsedUrl.hostname}`
    return parsedUrl.href
  } catch {
    return ''
  }
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

  const pageView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  uiView.setBackgroundColor('#1f1f1f')
  pageView.setBackgroundColor('#ffffff')

  mainWindow.contentView.addChildView(uiView)
  mainWindow.contentView.addChildView(pageView)

  let currentUrl = INITIAL_URL
  let currentTitle = getDisplayTitle(INITIAL_URL)
  let currentFavicon = ''
  const attemptedWwwFallbacks = new Set<string>()

  const updateBounds = (): void => {
    if (mainWindow.isDestroyed()) {
      return
    }

    const { width, height } = mainWindow.getContentBounds()
    const pageHeight = Math.max(0, height - UI_HEIGHT)

    uiView.setBounds({ x: 0, y: 0, width, height: UI_HEIGHT })
    pageView.setBounds({ x: 0, y: UI_HEIGHT, width, height: pageHeight })
  }

  const getPageState = (): PageState => ({
    url: pageView.webContents.getURL() || currentUrl,
    title: currentTitle,
    favicon: currentFavicon,
    isLoading: pageView.webContents.isLoading(),
    canGoBack: pageView.webContents.navigationHistory.canGoBack(),
    canGoForward: pageView.webContents.navigationHistory.canGoForward()
  })

  const sendPageState = (): void => {
    if (!uiView.webContents.isDestroyed()) {
      uiView.webContents.send('page:state-update', getPageState())
    }
  }

  const sendPageLoadError = (errorInfo: PageLoadError): void => {
    if (!uiView.webContents.isDestroyed()) {
      uiView.webContents.send('page:load-error', errorInfo)
    }
  }

  const updateWindowTitle = (): void => {
    const nextTitle =
      currentTitle && currentTitle !== APP_TITLE ? `${currentTitle} - ${APP_TITLE}` : APP_TITLE
    mainWindow.setTitle(nextTitle)
  }

  const loadPageUrl = (rawUrl: string): void => {
    const nextUrl = normalizeNavigationUrl(rawUrl)

    if (!nextUrl) {
      const errorInfo = {
        url: rawUrl,
        errorCode: 0,
        errorDescription: 'Invalid URL'
      }

      currentUrl = rawUrl
      currentTitle = APP_TITLE
      currentFavicon = ''
      updateWindowTitle()
      sendPageState()
      sendPageLoadError(errorInfo)
      return
    }

    attemptedWwwFallbacks.clear()
    currentUrl = nextUrl
    currentTitle = getDisplayTitle(nextUrl)
    currentFavicon = ''
    updateWindowTitle()
    sendPageState()

    void pageView.webContents.loadURL(nextUrl).catch((error: Error) => {
      sendPageLoadError({
        url: nextUrl,
        errorCode: 0,
        errorDescription: error.message || 'Failed to load URL'
      })
    })
  }

  const loadWwwFallback = (failedUrl: string): boolean => {
    const fallbackUrl = getWwwFallbackUrl(failedUrl)

    if (!fallbackUrl || attemptedWwwFallbacks.has(failedUrl)) {
      return false
    }

    attemptedWwwFallbacks.add(failedUrl)
    currentUrl = fallbackUrl
    currentTitle = getDisplayTitle(fallbackUrl)
    currentFavicon = ''
    updateWindowTitle()
    sendPageState()

    void pageView.webContents.loadURL(fallbackUrl).catch((error: Error) => {
      sendPageLoadError({
        url: fallbackUrl,
        errorCode: 0,
        errorDescription: error.message || 'Failed to load URL'
      })
    })

    return true
  }

  const isFromUiView = (event: IpcMainEvent): boolean => event.sender === uiView.webContents

  const handleNavigateToUrl = (event: IpcMainEvent, url: string): void => {
    if (!isFromUiView(event) || typeof url !== 'string') {
      return
    }

    loadPageUrl(url)
  }

  const handleGoBack = (event: IpcMainEvent): void => {
    if (isFromUiView(event) && pageView.webContents.navigationHistory.canGoBack()) {
      pageView.webContents.navigationHistory.goBack()
    }
  }

  const handleGoForward = (event: IpcMainEvent): void => {
    if (isFromUiView(event) && pageView.webContents.navigationHistory.canGoForward()) {
      pageView.webContents.navigationHistory.goForward()
    }
  }

  const handleReload = (event: IpcMainEvent): void => {
    if (isFromUiView(event) && pageView.webContents.getURL()) {
      pageView.webContents.reload()
    }
  }

  const handleStop = (event: IpcMainEvent): void => {
    if (isFromUiView(event)) {
      pageView.webContents.stop()
    }
  }

  const handleRequestPageState = (event: IpcMainEvent): void => {
    if (isFromUiView(event)) {
      sendPageState()
    }
  }

  const requestAddressBarFocus = (): void => {
    if (uiView.webContents.isDestroyed()) {
      return
    }

    uiView.webContents.focus()
    uiView.webContents.send('browser:focus-address-bar')
  }

  const handleInputShortcut = (event: Electron.Event, input: Electron.Input): void => {
    if (isFocusAddressBarShortcut(input)) {
      event.preventDefault()
      requestAddressBarFocus()
    }
  }

  ipcMain.on('nav:go', handleNavigateToUrl)
  ipcMain.on('nav:back', handleGoBack)
  ipcMain.on('nav:forward', handleGoForward)
  ipcMain.on('nav:reload', handleReload)
  ipcMain.on('nav:stop', handleStop)
  ipcMain.on('page:request-state', handleRequestPageState)

  uiView.webContents.on('before-input-event', handleInputShortcut)
  pageView.webContents.on('before-input-event', handleInputShortcut)

  pageView.webContents.on('did-start-loading', () => {
    sendPageState()
  })

  pageView.webContents.on('did-stop-loading', () => {
    sendPageState()
  })

  pageView.webContents.on('did-finish-load', () => {
    sendPageState()
  })

  pageView.webContents.on('did-navigate', (_event, url) => {
    currentUrl = url
    currentTitle = getDisplayTitle(url)
    currentFavicon = ''
    updateWindowTitle()
    sendPageState()
  })

  pageView.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (!isMainFrame) {
      return
    }

    currentUrl = url
    sendPageState()
  })

  pageView.webContents.on('page-title-updated', (_event, title) => {
    currentTitle = title || getDisplayTitle(pageView.webContents.getURL() || currentUrl)
    updateWindowTitle()
    sendPageState()
  })

  pageView.webContents.on('page-favicon-updated', (_event, favicons) => {
    currentFavicon = favicons[0] || ''
    sendPageState()
  })

  pageView.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === ERR_ABORTED) {
        return
      }

      const failedUrl = validatedURL || currentUrl

      if (errorCode === ERR_NAME_NOT_RESOLVED && loadWwwFallback(failedUrl)) {
        return
      }

      currentUrl = failedUrl
      currentTitle = getDisplayTitle(failedUrl)
      currentFavicon = ''
      updateWindowTitle()
      sendPageState()
      sendPageLoadError({
        url: failedUrl,
        errorCode,
        errorDescription
      })
    }
  )

  uiView.webContents.once('did-finish-load', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
      uiView.webContents.focus()
      sendPageState()
    }
  })

  uiView.webContents.once('did-fail-load', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  mainWindow.on('resize', updateBounds)
  mainWindow.on('closed', () => {
    ipcMain.off('nav:go', handleNavigateToUrl)
    ipcMain.off('nav:back', handleGoBack)
    ipcMain.off('nav:forward', handleGoForward)
    ipcMain.off('nav:reload', handleReload)
    ipcMain.off('nav:stop', handleStop)
    ipcMain.off('page:request-state', handleRequestPageState)
  })

  updateBounds()
  updateWindowTitle()

  const rendererEntryUrl = getRendererEntryUrl()

  if (rendererEntryUrl) {
    void uiView.webContents.loadURL(rendererEntryUrl)
  } else {
    void uiView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }

  loadPageUrl(INITIAL_URL)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
