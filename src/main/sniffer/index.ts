import { ipcMain, session } from 'electron'
import { resourceSniffer } from './resourceSniffer'

export function registerSnifferHandlers(
  getActiveTabId: () => number | null,
  notifyRenderer: (channel: string, payload: unknown) => void
): void {
  resourceSniffer.setup(session.defaultSession)

  resourceSniffer.onResourceFound((tabId, count) => {
    notifyRenderer('sniffer:resource-found', { tabId, count })
  })

  ipcMain.handle('sniffer:getResources', async () => {
    try {
      const tabId = getActiveTabId()
      if (!tabId) return []
      return resourceSniffer.getResourcesForTab(tabId)
    } catch {
      return []
    }
  })

  ipcMain.handle('sniffer:getResourcesForTab', async (_event, tabId: number) => {
    try {
      return resourceSniffer.getResourcesForTab(tabId)
    } catch {
      return []
    }
  })

  ipcMain.handle('sniffer:clearTab', async (_event, tabId: number) => {
    resourceSniffer.clearResourcesForTab(tabId)
    return true
  })
}

export { resourceSniffer }
