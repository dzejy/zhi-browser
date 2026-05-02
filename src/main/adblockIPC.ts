import { ipcMain, WebContentsView } from 'electron'
import type { AdBlockController } from './adblockController'

interface AdBlockIPCOptions {
  controller: AdBlockController
  uiView: WebContentsView
  panelView?: WebContentsView | null
  getActiveTabUrl: () => string
}

export function registerAdBlockIPC(options: AdBlockIPCOptions): void {
  const { controller, uiView, panelView, getActiveTabUrl } = options

  const isValidSender = (event: Electron.IpcMainInvokeEvent): boolean => {
    return event.sender === uiView.webContents || event.sender === panelView?.webContents
  }

  ipcMain.handle('adblock:get-state', (event) => {
    if (!isValidSender(event)) return null
    return controller.getState()
  })

  ipcMain.handle('adblock:set-enabled', (event, enabled: boolean) => {
    if (!isValidSender(event) || typeof enabled !== 'boolean') return null
    return controller.setEnabled(enabled)
  })

  ipcMain.handle('adblock:add-whitelist', (event, hostname: string) => {
    if (!isValidSender(event) || typeof hostname !== 'string') return null
    return controller.addWhitelist(hostname)
  })

  ipcMain.handle('adblock:remove-whitelist', (event, hostname: string) => {
    if (!isValidSender(event) || typeof hostname !== 'string') return null
    return controller.removeWhitelist(hostname)
  })

  ipcMain.handle('adblock:clear-count', (event) => {
    if (!isValidSender(event)) return null
    return controller.clearBlockedCount()
  })

  ipcMain.handle('adblock:get-current-site', (event) => {
    if (!isValidSender(event)) return null
    const url = getActiveTabUrl()
    if (!url || url === 'about:blank' || url.startsWith('data:') || url.startsWith('file://')) {
      return { hostname: '', canWhitelist: false }
    }
    try {
      const hostname = new URL(url).hostname
      return hostname ? { hostname, canWhitelist: true } : { hostname: '', canWhitelist: false }
    } catch {
      return { hostname: '', canWhitelist: false }
    }
  })

  ipcMain.handle('adblock:toggle-current-site-whitelist', (event) => {
    if (!isValidSender(event)) return null
    const url = getActiveTabUrl()
    if (!url) return controller.getState()
    try {
      const hostname = new URL(url).hostname
      if (!hostname) return controller.getState()
      return controller.isWhitelisted(url)
        ? controller.removeWhitelist(hostname)
        : controller.addWhitelist(hostname)
    } catch {
      return controller.getState()
    }
  })
}
