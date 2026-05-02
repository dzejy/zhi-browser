import { ipcMain, WebContentsView, BaseWindow } from 'electron'
import { getPreferences, updatePreferences } from './settings'

let webPanelView: WebContentsView | null = null
let webPanelVisible = false
const WEB_PANEL_WIDTH = 380

export function registerWebPanelHandlers(
  getMainWindow: () => BaseWindow | null,
  getContentBounds: () => { x: number; y: number; width: number; height: number },
  onLayoutChange: () => void
): void {
  ipcMain.handle('webPanel:open', async (_event, url: string) => {
    const mainWindow = getMainWindow()
    if (!mainWindow) return { success: false }

    try {
      if (!webPanelView) {
        webPanelView = new WebContentsView({
          webPreferences: {
            contextIsolation: true,
            sandbox: true
          }
        })
        mainWindow.contentView.addChildView(webPanelView)
      }

      await webPanelView.webContents.loadURL(url)
      webPanelVisible = true
      layoutWebPanel(getContentBounds)
      onLayoutChange()

      const prefs = getPreferences()
      const panels = prefs.webPanels || []
      if (!panels.some((panel) => panel.url === url)) {
        panels.push({ url, title: url, pinned: true })
        updatePreferences({ webPanels: panels })
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('webPanel:close', async () => {
    closeWebPanel(getMainWindow)
    onLayoutChange()
    return true
  })

  ipcMain.handle('webPanel:toggle', async () => {
    if (webPanelVisible && webPanelView) {
      const mainWindow = getMainWindow()
      if (mainWindow) {
        try {
          mainWindow.contentView.removeChildView(webPanelView)
        } catch {
          /* may not be attached */
        }
      }
      webPanelVisible = false
    } else if (webPanelView) {
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.contentView.addChildView(webPanelView)
        layoutWebPanel(getContentBounds)
      }
      webPanelVisible = true
    }
    onLayoutChange()
    return webPanelVisible
  })

  ipcMain.handle('webPanel:navigate', async (_event, url: string) => {
    if (webPanelView && !webPanelView.webContents.isDestroyed()) {
      await webPanelView.webContents.loadURL(url)
      return true
    }
    return false
  })

  ipcMain.handle('webPanel:isVisible', () => {
    return webPanelVisible
  })

  ipcMain.handle('webPanel:getUrl', () => {
    if (webPanelView && !webPanelView.webContents.isDestroyed()) {
      return webPanelView.webContents.getURL()
    }
    return null
  })

  ipcMain.handle('webPanel:getSaved', () => {
    const prefs = getPreferences()
    return prefs.webPanels || []
  })

  ipcMain.handle('webPanel:save', (_event, panels: Array<{ url: string; title: string; pinned: boolean }>) => {
    updatePreferences({ webPanels: panels })
    return true
  })

  ipcMain.handle('webPanel:remove', (_event, url: string) => {
    const prefs = getPreferences()
    const panels = (prefs.webPanels || []).filter((panel) => panel.url !== url)
    updatePreferences({ webPanels: panels })
    return true
  })
}

function layoutWebPanel(
  getContentBounds: () => { x: number; y: number; width: number; height: number }
): void {
  if (!webPanelView || !webPanelVisible || webPanelView.webContents.isDestroyed()) return

  const bounds = getContentBounds()
  webPanelView.setBounds({
    x: bounds.x + bounds.width - WEB_PANEL_WIDTH,
    y: bounds.y,
    width: WEB_PANEL_WIDTH,
    height: bounds.height
  })
}

export function relayoutWebPanel(
  getContentBounds: () => { x: number; y: number; width: number; height: number }
): void {
  layoutWebPanel(getContentBounds)
}

export function closeWebPanel(getMainWindow: () => BaseWindow | null): void {
  if (webPanelView) {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      try {
        mainWindow.contentView.removeChildView(webPanelView)
      } catch {
        /* may not be attached */
      }
    }
    if (!webPanelView.webContents.isDestroyed()) {
      webPanelView.webContents.close()
    }
    webPanelView = null
  }
  webPanelVisible = false
}

export function isWebPanelVisible(): boolean {
  return webPanelVisible
}

export function getWebPanelWidth(): number {
  return webPanelVisible ? WEB_PANEL_WIDTH : 0
}
