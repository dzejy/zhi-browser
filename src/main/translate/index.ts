import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { translatePage, removePageTranslation } from './orchestrator'
import { translateText } from './translateText'

export { translateText } from './translateText'

export function registerTranslateHandlers(getActiveWebContents: () => WebContents | null): void {
  ipcMain.handle('translate:text', async (_event, text: string, targetLang: string) => {
    try {
      const result = await translateText(text, targetLang)
      return { success: true, result }
    } catch (e) {
      return { success: false, result: '', error: String(e) }
    }
  })

  ipcMain.handle('translate:page', async (_event, enable: boolean) => {
    const webContents = getActiveWebContents()
    if (!webContents) return

    if (enable) {
      await translatePage(webContents)
    } else {
      await removePageTranslation(webContents)
    }
  })
}
