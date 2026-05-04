import { ipcMain, WebContentsView, BaseWindow, IpcMainInvokeEvent } from 'electron'
import { join } from 'path'
import { classifyInput } from './navigation'
import { setupScriptInjection } from './userscript/injector'
import { setupInstallInterceptor } from './userscript/install-interceptor'

let splitMode = false
let rightView: WebContentsView | null = null

export interface SplitViewState {
  active: boolean
  rightUrl: string | null
}

export function registerSplitViewHandlers(
  getMainWindow: () => BaseWindow | null,
  getContentBounds: () => { x: number; y: number; width: number; height: number },
  onLayoutChange: () => void,
  openInTab: (url: string) => void,
  validateSender?: (event: IpcMainInvokeEvent) => boolean
): void {
  const isAllowed = (event: IpcMainInvokeEvent): boolean => validateSender?.(event) ?? true
  const normalizeTarget = (url: string): string | null => {
    const value = typeof url === 'string' ? url.trim() : ''
    if (!value) return null
    return classifyInput(value).value
  }

  ipcMain.handle('splitView:open', async (event, url: string) => {
    if (!isAllowed(event)) return { success: false }
    const mainWindow = getMainWindow()
    if (!mainWindow) return { success: false }
    const targetUrl = normalizeTarget(url)
    if (!targetUrl) return { success: false }

    try {
      if (!rightView) {
        rightView = new WebContentsView({
          webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        })
        setupScriptInjection(rightView.webContents)
        setupInstallInterceptor(rightView.webContents, getMainWindow, openInTab)
        mainWindow.contentView.addChildView(rightView)
      }

      await rightView.webContents.loadURL(targetUrl)
      splitMode = true
      layoutSplitView(getContentBounds)
      onLayoutChange()

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('splitView:close', async (event) => {
    if (!isAllowed(event)) return false
    closeSplitView(getMainWindow)
    onLayoutChange()
    return true
  })

  ipcMain.handle('splitView:getState', async (event): Promise<SplitViewState> => {
    if (!isAllowed(event)) return { active: false, rightUrl: null }
    return {
      active: splitMode,
      rightUrl:
        rightView && !rightView.webContents.isDestroyed() ? rightView.webContents.getURL() : null
    }
  })

  ipcMain.handle('splitView:navigate', async (event, url: string) => {
    if (!isAllowed(event)) return false
    const targetUrl = normalizeTarget(url)
    if (!targetUrl) return false
    if (rightView && !rightView.webContents.isDestroyed()) {
      await rightView.webContents.loadURL(targetUrl)
      return true
    }
    return false
  })

  ipcMain.handle('splitView:goBack', async (event) => {
    if (!isAllowed(event)) return false
    if (rightView?.webContents.navigationHistory.canGoBack()) {
      rightView.webContents.navigationHistory.goBack()
      return true
    }
    return false
  })

  ipcMain.handle('splitView:goForward', async (event) => {
    if (!isAllowed(event)) return false
    if (rightView?.webContents.navigationHistory.canGoForward()) {
      rightView.webContents.navigationHistory.goForward()
      return true
    }
    return false
  })

  ipcMain.handle('splitView:reload', async (event) => {
    if (!isAllowed(event)) return false
    if (rightView && !rightView.webContents.isDestroyed()) {
      rightView.webContents.reload()
    }
    return true
  })

  ipcMain.handle('splitView:swap', async (event, leftUrl?: string) => {
    if (!isAllowed(event)) return false
    if (!rightView || !splitMode || rightView.webContents.isDestroyed()) return false
    const rightUrl = rightView.webContents.getURL()
    if (leftUrl) {
      const targetUrl = normalizeTarget(leftUrl)
      if (targetUrl) rightView.webContents.loadURL(targetUrl)
    }
    return rightUrl
  })

  ipcMain.handle('splitView:onSwap', (event) => {
    if (!isAllowed(event)) return false
    return true
  })
}

function layoutSplitView(
  getContentBounds: () => { x: number; y: number; width: number; height: number }
): void {
  if (!rightView || !splitMode || rightView.webContents.isDestroyed()) return

  const bounds = getContentBounds()
  const halfWidth = Math.floor(bounds.width / 2)
  const gap = 2

  rightView.setBounds({
    x: bounds.x + halfWidth + gap,
    y: bounds.y,
    width: bounds.width - halfWidth - gap,
    height: bounds.height
  })
}

export function relayoutSplitView(
  getContentBounds: () => { x: number; y: number; width: number; height: number }
): void {
  layoutSplitView(getContentBounds)
}

export function closeSplitView(getMainWindow: () => BaseWindow | null): void {
  const mainWindow = getMainWindow()
  if (rightView && mainWindow) {
    try {
      mainWindow.contentView.removeChildView(rightView)
    } catch {
      /* may not be attached */
    }
    if (!rightView.webContents.isDestroyed()) {
      rightView.webContents.close()
    }
    rightView = null
  }
  splitMode = false
}

export function isSplitViewActive(): boolean {
  return splitMode
}

export function getLeftViewWidth(totalWidth: number): number {
  if (!splitMode) return totalWidth
  return Math.floor(totalWidth / 2) - 1
}

export function getRightView(): WebContentsView | null {
  return rightView
}
