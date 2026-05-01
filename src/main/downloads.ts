import { DownloadItem as AppDownloadItem } from '../shared/types'
import { shell, session, DownloadItem, app } from 'electron'
import { readJSON, writeJSON } from './storage'
import { getSettings } from './settings'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DOWNLOADS_FILE = 'downloads.json'

const activeDownloads: Map<string, { item: DownloadItem; appItem: AppDownloadItem }> = new Map()
let completedDownloads: AppDownloadItem[] = []
let onUpdateCallback: ((item: AppDownloadItem) => void) | null = null

export function setOnDownloadUpdate(cb: (item: AppDownloadItem) => void): void {
  onUpdateCallback = cb
}

export function getDownloads(): AppDownloadItem[] {
  const active = Array.from(activeDownloads.values()).map((d) => d.appItem)
  return [...active, ...completedDownloads]
}

export function loadCompletedDownloads(): void {
  completedDownloads = readJSON<AppDownloadItem[]>(DOWNLOADS_FILE, [])
}

function saveCompletedDownloads(): void {
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
      completedDownloads.unshift(appItem)
      saveCompletedDownloads()
      onUpdateCallback?.(appItem)
    })

    onUpdateCallback?.(appItem)
  })
}

export function openDownloadFile(downloadId: string): void {
  const active = activeDownloads.get(downloadId)
  if (active?.appItem.savePath) {
    shell.openPath(active.appItem.savePath)
    return
  }
  const completed = completedDownloads.find((d) => d.id === downloadId)
  if (completed?.savePath) {
    shell.openPath(completed.savePath)
  }
}

export function showInFolder(downloadId: string): void {
  const active = activeDownloads.get(downloadId)
  if (active?.appItem.savePath) {
    shell.showItemInFolder(active.appItem.savePath)
    return
  }
  const completed = completedDownloads.find((d) => d.id === downloadId)
  if (completed?.savePath) {
    shell.showItemInFolder(completed.savePath)
  }
}
