/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-explicit-any */
import { ipcMain, session, BaseWindow } from 'electron'
import { sendToDownloader, detectInstalledDownloaders } from './externalDownloader'
import { getPreferences } from '../settings'
import type { DownloaderType, DownloadTask, DownloadOptions } from './types'
import {
  initDownloadManager,
  startDownload,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  removeTask,
  getTaskList,
  getTask,
  clearCompleted,
  openFile,
  openFolder,
  setProgressCallback
} from './download-manager'

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

// 获取 preferences 的函数（由外部传入）
let getPrefs: () => any
let mainWindowGetter: () => BaseWindow | null
let getWebContents: () => Electron.WebContents | null

export function registerBuiltinDownloaderHandlers(
  getPreferences: typeof getPrefs,
  getMainWindow: typeof mainWindowGetter,
  getWebContentsFn: typeof getWebContents
) {
  getPrefs = getPreferences
  mainWindowGetter = getMainWindow
  getWebContents = getWebContentsFn

  initDownloadManager()

  // 设置进度回调 → 发送到渲染进程
  setProgressCallback((progress) => {
    const wc = getWebContents()
    if (wc && !wc.isDestroyed()) {
      wc.send('download:progress', progress)
    }
  })

  // 拦截浏览器默认下载
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const prefs = getPrefs().downloader

    // 如果使用外部下载器，不走内置（已有逻辑处理）
    if (prefs.useExternalDownloader || prefs.type !== 'builtin') return

    // 如果内置下载器未启用，使用 Electron 默认行为
    if (!prefs.enabled) return

    // 拦截默认下载行为
    event.preventDefault()

    const url = item.getURL()
    const filename = item.getFilename()
    const referer = webContents?.getURL() || ''

    // 启动多线程下载
    startDownload(
      {
        url,
        filename,
        referer
      },
      mainWindowGetter()
    ).catch((err) => {
      console.error('内置下载器错误:', err)
    })
  })

  // IPC handlers
  ipcMain.handle('builtin-download:start', async (_e, options: DownloadOptions) => {
    try {
      const id = await startDownload(options, mainWindowGetter())
      return { success: true, id }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('builtin-download:pause', (_e, id: string) => {
    return { success: pauseDownload(id) }
  })

  ipcMain.handle('builtin-download:resume', async (_e, id: string) => {
    return { success: await resumeDownload(id) }
  })

  ipcMain.handle('builtin-download:cancel', (_e, id: string) => {
    return { success: cancelDownload(id) }
  })

  ipcMain.handle('builtin-download:remove', (_e, id: string) => {
    return { success: removeTask(id) }
  })

  ipcMain.handle('builtin-download:getList', () => {
    return getTaskList()
  })

  ipcMain.handle('builtin-download:getTask', (_e, id: string) => {
    return getTask(id)
  })

  ipcMain.handle('builtin-download:clearCompleted', () => {
    clearCompleted()
    return { success: true }
  })

  ipcMain.handle('builtin-download:openFile', (_e, id: string) => {
    return { success: openFile(id) }
  })

  ipcMain.handle('builtin-download:openFolder', (_e, id: string) => {
    return { success: openFolder(id) }
  })
}
