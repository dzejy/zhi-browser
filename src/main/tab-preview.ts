import { ipcMain, WebContentsView } from 'electron'

const previewCache = new Map<number, string>()
const PREVIEW_WIDTH = 320
const PREVIEW_HEIGHT = 200

export function registerTabPreviewHandlers(
  getTabViewById: (tabId: number) => WebContentsView | null
): void {
  ipcMain.handle('tabPreview:capture', async (_event, tabId: number) => {
    const cached = previewCache.get(tabId)
    if (cached) return cached

    const view = getTabViewById(tabId)
    if (!view || view.webContents.isDestroyed()) return null

    try {
      const image = await view.webContents.capturePage()
      if (image.isEmpty()) return null

      const resized = image.resize({ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT })
      const dataUrl = resized.toDataURL()

      previewCache.set(tabId, dataUrl)
      setTimeout(() => previewCache.delete(tabId), 5000)

      return dataUrl
    } catch {
      return null
    }
  })

  ipcMain.handle('tabPreview:clear', async (_event, tabId: number) => {
    previewCache.delete(tabId)
  })
}

export function clearTabPreview(tabId: number): void {
  previewCache.delete(tabId)
}
