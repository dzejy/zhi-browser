import { ipcMain } from 'electron'
import {
  initHibernationManager,
  recordTabActive,
  hibernateTab,
  wakeTab,
  hibernateOthers,
  isTabHibernated,
  getHibernatedTabIds,
  getHibernationPrefs,
  setHibernationPrefs,
  notifyTabClosed
} from './manager'

export function initHibernation(adapter: Parameters<typeof initHibernationManager>[0]): void {
  initHibernationManager(adapter)
}

export function registerHibernationHandlers(): void {
  ipcMain.handle('hibernation:hibernate-tab', async (_e, tabId: string) => ({
    success: await hibernateTab(tabId)
  }))
  ipcMain.handle('hibernation:wake-tab', (_e, tabId: string) => ({
    success: wakeTab(tabId)
  }))
  ipcMain.handle('hibernation:hibernate-others', async () => {
    const count = await hibernateOthers()
    return { success: true, count }
  })
  ipcMain.handle('hibernation:get-list', () => getHibernatedTabIds())
  ipcMain.handle('hibernation:is-hibernated', (_e, tabId: string) => isTabHibernated(tabId))
  ipcMain.handle('hibernation:get-prefs', () => getHibernationPrefs())
  ipcMain.handle(
    'hibernation:set-prefs',
    (
      _e,
      prefs: { enabled?: boolean; timeoutMinutes?: number; whitelist?: string[] }
    ) => {
      setHibernationPrefs(prefs)
      return { success: true }
    }
  )
}

export { recordTabActive, hibernateOthers, notifyTabClosed }
