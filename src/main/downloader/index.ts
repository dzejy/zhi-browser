import { ipcMain, session } from 'electron'
import { sendToDownloader, detectInstalledDownloaders } from './externalDownloader'
import { getPreferences } from '../settings'
import type { DownloaderType, DownloadTask } from './types'

export function registerDownloaderHandlers(): void {
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const prefs = getPreferences()
    const downloaderPrefs = prefs.downloader

    if (!downloaderPrefs || !downloaderPrefs.enabled || downloaderPrefs.type === 'builtin') {
      return
    }

    event.preventDefault()

    const task: DownloadTask = {
      url: item.getURL(),
      filename: item.getFilename(),
      referer: webContents?.getURL() || ''
    }

    sendToDownloader(
      downloaderPrefs.type as DownloaderType,
      {
        name: downloaderPrefs.type,
        enabled: true,
        path: downloaderPrefs.path
      },
      task
    )
  })

  ipcMain.handle('downloader:send', async (_event, task: DownloadTask) => {
    try {
      const prefs = getPreferences()
      const downloaderPrefs = prefs.downloader

      if (!downloaderPrefs || !downloaderPrefs.path || downloaderPrefs.type === 'builtin') {
        return { success: false, error: '未配置下载器' }
      }

      return sendToDownloader(
        downloaderPrefs.type as DownloaderType,
        {
          name: downloaderPrefs.type,
          enabled: true,
          path: downloaderPrefs.path
        },
        task
      )
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('downloader:detect', async () => {
    try {
      return detectInstalledDownloaders()
    } catch {
      return {}
    }
  })

  ipcMain.handle('downloader:getConfig', async () => {
    const prefs = getPreferences()
    return prefs.downloader || { enabled: false, type: 'builtin', path: '' }
  })
}
