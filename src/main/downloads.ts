import { DownloadItem as AppDownloadItem } from '../shared/types'
import { shell, session, DownloadItem, app, dialog } from 'electron'
import { readJSON, writeJSON } from './storage'
import { getSettings } from './settings'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DOWNLOADS_FILE = 'downloads.json'

const activeDownloads: Map<string, { item: DownloadItem; appItem: AppDownloadItem }> = new Map()
let completedDownloads: AppDownloadItem[] = []
let onUpdateCallback: ((item: AppDownloadItem) => void) | null = null
let onCompletedCallback: ((item: AppDownloadItem) => void) | null = null

const DOWNLOAD_STATES: AppDownloadItem['state'][] = [
  'progressing',
  'completed',
  'cancelled',
  'interrupted'
]

export function setOnDownloadUpdate(cb: (item: AppDownloadItem) => void): void {
  onUpdateCallback = cb
}

export function setOnDownloadCompleted(cb: (item: AppDownloadItem) => void): void {
  onCompletedCallback = cb
}

export function getDownloads(): AppDownloadItem[] {
  const active = Array.from(activeDownloads.values()).map((d) => d.appItem)
  return [...active, ...completedDownloads]
}

export function loadCompletedDownloads(): void {
  completedDownloads = readJSON<Partial<AppDownloadItem>[]>(DOWNLOADS_FILE, [])
    .map(normalizeDownload)
    .filter((item): item is AppDownloadItem => item !== null)
}

function normalizeDownload(item: Partial<AppDownloadItem>): AppDownloadItem | null {
  if (typeof item.id !== 'string' || !item.id.trim()) return null
  const state = DOWNLOAD_STATES.includes(item.state as AppDownloadItem['state'])
    ? (item.state as AppDownloadItem['state'])
    : 'completed'

  return {
    id: item.id,
    filename:
      typeof item.filename === 'string' && item.filename.trim() ? item.filename : 'download',
    url: typeof item.url === 'string' ? item.url : '',
    totalBytes: typeof item.totalBytes === 'number' ? item.totalBytes : 0,
    receivedBytes: typeof item.receivedBytes === 'number' ? item.receivedBytes : 0,
    state,
    savePath: typeof item.savePath === 'string' ? item.savePath : '',
    startedAt: typeof item.startedAt === 'number' ? item.startedAt : Date.now()
  }
}

function saveCompletedDownloads(): void {
  if (!getSettings().saveDownloadsHistory) return
  writeJSON(DOWNLOADS_FILE, completedDownloads.slice(0, 100)) // keep last 100
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

function getUniqueSavePath(dir: string, filename: string): string {
  const safe = sanitizeFilename(filename)
  const ext = safe.includes('.') ? '.' + safe.split('.').pop()! : ''
  const base = ext ? safe.slice(0, -ext.length) : safe
  if (!existsSync(join(dir, safe))) return join(dir, safe)
  let i = 1
  while (existsSync(join(dir, `${base} (${i})${ext}`))) {
    i++
  }
  return join(dir, `${base} (${i})${ext}`)
}

export function setupDownloadHandler(): void {
  session.defaultSession.on('will-download', (_event, item) => {
    const settings = getSettings()
    const autoSave = !settings.askWhereToSaveBeforeDownloading
    const downloadDir = settings.downloadPath || app.getPath('downloads')

    if (autoSave) {
      // Ensure download directory exists
      if (!existsSync(downloadDir)) {
        try {
          mkdirSync(downloadDir, { recursive: true })
        } catch {
          /* fallback below */
        }
      }
      const saveDir = existsSync(downloadDir) ? downloadDir : app.getPath('downloads')
      const savePath = getUniqueSavePath(saveDir, item.getFilename())
      item.setSavePath(savePath)
    } else {
      dialog
        .showSaveDialog({
          title: '保存文件',
          defaultPath: join(downloadDir, item.getFilename())
        })
        .then((result) => {
          if (result.canceled || !result.filePath) {
            item.cancel()
          } else {
            item.setSavePath(result.filePath)
          }
        })
        .catch(() => item.cancel())
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

    const appItem: AppDownloadItem = {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      savePath: item.getSavePath() || '',
      startedAt: Date.now()
    }

    activeDownloads.set(id, { item, appItem })

    item.on('updated', (_event, state) => {
      appItem.receivedBytes = item.getReceivedBytes()
      appItem.totalBytes = item.getTotalBytes()
      appItem.savePath = item.getSavePath()
      appItem.state = state === 'interrupted' ? 'interrupted' : 'progressing'
      onUpdateCallback?.(appItem)
    })

    item.once('done', (_event, state) => {
      appItem.receivedBytes = item.getReceivedBytes()
      appItem.savePath = item.getSavePath()
      appItem.state =
        state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted'

      activeDownloads.delete(id)
      if (getSettings().saveDownloadsHistory) {
        completedDownloads.unshift(appItem)
        saveCompletedDownloads()
      }
      onUpdateCallback?.(appItem)
      if (appItem.state === 'completed') {
        onCompletedCallback?.(appItem)
      }
    })

    onUpdateCallback?.(appItem)
  })
}

function findDownload(downloadId: string): AppDownloadItem | undefined {
  return (
    activeDownloads.get(downloadId)?.appItem || completedDownloads.find((d) => d.id === downloadId)
  )
}

export function openDownloadFile(downloadId: string): void {
  const download = findDownload(downloadId)
  if (download?.savePath && existsSync(download.savePath)) {
    shell.openPath(download.savePath).catch(() => {
      /* ignore */
    })
  }
}

export function showInFolder(downloadId: string): void {
  const download = findDownload(downloadId)
  if (download?.savePath && existsSync(download.savePath)) {
    shell.showItemInFolder(download.savePath)
  }
}

export function showDownloadInFolder(downloadId: string): void {
  showInFolder(downloadId)
}

export function removeDownload(downloadId: string): void {
  activeDownloads.delete(downloadId)
  completedDownloads = completedDownloads.filter((d) => d.id !== downloadId)
  writeJSON(DOWNLOADS_FILE, completedDownloads)
}

export function clearDownloads(): void {
  completedDownloads = []
  writeJSON(DOWNLOADS_FILE, [])
}
