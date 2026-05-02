import { ipcMain, WebContentsView, BaseWindow } from 'electron'
import { join } from 'path'
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
  openInTab: (url: string) => void
): void {
  ipcMain.handle('splitView:open', async (_event, url: string) => {
    const mainWindow = getMainWindow()
    if (!mainWindow) return { success: false }

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

      await rightView.webContents.loadURL(url)
      splitMode = true
      layoutSplitView(getContentBounds)
      onLayoutChange()

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('splitView:close', async () => {
    closeSplitView(getMainWindow)
    onLayoutChange()
    return true
  })

  ipcMain.handle('splitView:getState', async (): Promise<SplitViewState> => {
    return {
      active: splitMode,
      rightUrl:
        rightView && !rightView.webContents.isDestroyed() ? rightView.webContents.getURL() : null
    }
  })

  ipcMain.handle('splitView:navigate', async (_event, url: string) => {
    if (rightView && !rightView.webContents.isDestroyed()) {
      await rightView.webContents.loadURL(url)
      return true
    }
    return false
  })

  ipcMain.handle('splitView:goBack', async () => {
    if (rightView?.webContents.navigationHistory.canGoBack()) {
      rightView.webContents.navigationHistory.goBack()
      return true
    }
    return false
  })

  ipcMain.handle('splitView:goForward', async () => {
    if (rightView?.webContents.navigationHistory.canGoForward()) {
      rightView.webContents.navigationHistory.goForward()
      return true
    }
    return false
  })

  ipcMain.handle('splitView:reload', async () => {
    if (rightView && !rightView.webContents.isDestroyed()) {
      rightView.webContents.reload()
    }
    return true
  })

  ipcMain.handle('splitView:swap', async () => {
    if (!rightView || !splitMode || rightView.webContents.isDestroyed()) return false
    return rightView.webContents.getURL()
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
