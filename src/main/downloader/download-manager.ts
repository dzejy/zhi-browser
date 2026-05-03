/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { app, dialog, BaseWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { BuiltinDownloadTask, DownloadProgress, DownloadOptions, ChunkInfo } from './types'
import {
  probeFile,
  createChunks,
  downloadChunk,
  downloadSingleThread,
  mergeChunks
} from './multi-thread'

const TASKS_PATH = path.join(app.getPath('userData'), 'downloads.json')
const TEMP_DIR = path.join(app.getPath('userData'), 'download_temp')

let tasks: BuiltinDownloadTask[] = []
const abortControllers: Map<string, { aborted: boolean }> = new Map()
const progressCallbacks: Map<string, (progress: DownloadProgress) => void> = new Map()
const speedTrackers: Map<string, { lastTime: number; lastBytes: number }> = new Map()

// 全局进度通知回调
let globalProgressCallback: ((progress: DownloadProgress) => void) | null = null

export function setProgressCallback(cb: (progress: DownloadProgress) => void) {
  globalProgressCallback = cb
}

function loadTasks() {
  try {
    if (fs.existsSync(TASKS_PATH)) {
      const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf-8'))
      tasks = data.map((t: BuiltinDownloadTask) => {
        // 恢复时把下载中的状态改为暂停
        if (t.status === 'downloading' || t.status === 'merging') {
          t.status = 'paused'
        }
        return t
      })
    }
  } catch {
    tasks = []
  }
}

function saveTasks() {
  try {
    fs.writeFileSync(
      TASKS_PATH,
      JSON.stringify(
        tasks.map((t) => ({
          ...t,
          speed: 0 // 不保存速度
        }))
      ),
      'utf-8'
    )
  } catch {
    // ignore
  }
}

function ensureTempDir(taskId: string) {
  const dir = path.join(TEMP_DIR, taskId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function cleanTempDir(taskId: string) {
  const dir = path.join(TEMP_DIR, taskId)
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  } catch {
    // ignore
  }
}

function notifyProgress(task: BuiltinDownloadTask) {
  const progress: DownloadProgress = {
    id: task.id,
    downloadedSize: task.downloadedSize,
    totalSize: task.totalSize,
    speed: task.speed,
    status: task.status,
    progress: task.totalSize > 0 ? Math.round((task.downloadedSize / task.totalSize) * 100) : 0,
    chunks: task.chunks.map((c) => ({
      index: c.index,
      downloaded: c.downloaded,
      status: c.status
    }))
  }

  if (globalProgressCallback) {
    globalProgressCallback(progress)
  }

  const cb = progressCallbacks.get(task.id)
  if (cb) cb(progress)
}

function updateSpeed(task: BuiltinDownloadTask) {
  const tracker = speedTrackers.get(task.id)
  const now = Date.now()

  if (!tracker) {
    speedTrackers.set(task.id, { lastTime: now, lastBytes: task.downloadedSize })
    return
  }

  const elapsed = (now - tracker.lastTime) / 1000
  if (elapsed >= 1) {
    task.speed = Math.round((task.downloadedSize - tracker.lastBytes) / elapsed)
    tracker.lastTime = now
    tracker.lastBytes = task.downloadedSize
  }
}

export function initDownloadManager() {
  loadTasks()
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
}

export async function startDownload(
  options: DownloadOptions,
  mainWindow?: BaseWindow | null
): Promise<string> {
  const {
    url,
    threads = 8,
    referer = '',
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  } = options

  // 探测文件
  const headers: Record<string, string> = {}
  if (referer) headers['Referer'] = referer
  if (userAgent) headers['User-Agent'] = userAgent

  const fileInfo = await probeFile(url, headers)
  const filename = options.filename || fileInfo.filename

  // 确定保存路径
  let savePath = options.savePath
  if (!savePath) {
    const defaultDir = app.getPath('downloads')
    const result = await dialog.showSaveDialog(mainWindow || BaseWindow.getFocusedWindow()!, {
      defaultPath: path.join(defaultDir, filename),
      filters: [{ name: '所有文件', extensions: ['*'] }]
    })

    if (result.canceled || !result.filePath) {
      throw new Error('用户取消下载')
    }
    savePath = result.filePath
  }

  // 创建任务
  const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const tempDir = ensureTempDir(id)

  const actualThreads =
    fileInfo.supportsRange && fileInfo.totalSize > 1024 * 1024 ? Math.min(threads, 16) : 1

  const chunks: ChunkInfo[] =
    actualThreads > 1
      ? createChunks(fileInfo.totalSize, actualThreads, tempDir)
      : [
          {
            index: 0,
            start: 0,
            end: fileInfo.totalSize - 1,
            downloaded: 0,
            status: 'pending' as const,
            tempPath: path.join(tempDir, 'chunk_0.tmp')
          }
        ]

  const task: BuiltinDownloadTask = {
    id,
    url,
    filename,
    savePath,
    totalSize: fileInfo.totalSize,
    downloadedSize: 0,
    status: 'downloading',
    speed: 0,
    threads: actualThreads,
    supportsRange: fileInfo.supportsRange,
    chunks,
    createdAt: Date.now(),
    completedAt: null,
    error: null,
    referer,
    userAgent
  }

  tasks.unshift(task)
  saveTasks()

  // 开始下载
  executeDownload(task, headers)

  return id
}

async function executeDownload(task: BuiltinDownloadTask, headers: Record<string, string>) {
  const abortSignal = { aborted: false }
  abortControllers.set(task.id, abortSignal)
  speedTrackers.set(task.id, { lastTime: Date.now(), lastBytes: 0 })

  task.status = 'downloading'
  notifyProgress(task)

  // 进度更新定时器
  const progressInterval = setInterval(() => {
    if (task.status === 'downloading') {
      updateSpeed(task)
      notifyProgress(task)
      saveTasks()
    }
  }, 500)

  try {
    if (task.threads === 1 || !task.supportsRange) {
      // 单线程下载
      await downloadSingleThread(
        task.url,
        task.savePath,
        headers,
        (downloaded, _total) => {
          task.downloadedSize = downloaded
          task.chunks[0].downloaded = downloaded
        },
        abortSignal
      )

      if (!abortSignal.aborted) {
        task.chunks[0].status = 'completed'
        task.status = 'completed'
        task.completedAt = Date.now()
      }
    } else {
      // 多线程下载
      const downloadPromises = task.chunks
        .filter((chunk) => chunk.status !== 'completed')
        .map((chunk) => {
          chunk.status = 'downloading'
          return downloadChunk(
            task.url,
            chunk,
            headers,
            (bytesReceived) => {
              task.downloadedSize += bytesReceived
            },
            abortSignal
          ).catch((err) => {
            chunk.status = 'error'
            throw err
          })
        })

      await Promise.all(downloadPromises)

      if (!abortSignal.aborted) {
        // 合并分片
        task.status = 'merging'
        notifyProgress(task)

        await mergeChunks(task.chunks, task.savePath)

        task.status = 'completed'
        task.completedAt = Date.now()
        cleanTempDir(task.id)
      }
    }
  } catch (err) {
    if (!abortSignal.aborted) {
      task.status = 'error'
      task.error = String(err)
    }
  } finally {
    clearInterval(progressInterval)
    abortControllers.delete(task.id)
    speedTrackers.delete(task.id)
    task.speed = 0
    notifyProgress(task)
    saveTasks()
  }
}

export function pauseDownload(id: string): boolean {
  const signal = abortControllers.get(id)
  const task = tasks.find((t) => t.id === id)

  if (!signal || !task) return false

  signal.aborted = true
  task.status = 'paused'
  task.speed = 0
  notifyProgress(task)
  saveTasks()
  return true
}

export async function resumeDownload(id: string): Promise<boolean> {
  const task = tasks.find((t) => t.id === id)
  if (!task || task.status !== 'paused') return false

  const headers: Record<string, string> = {}
  if (task.referer) headers['Referer'] = task.referer
  if (task.userAgent) headers['User-Agent'] = task.userAgent

  // 重新计算已下载量
  task.downloadedSize = task.chunks.reduce((sum, c) => sum + c.downloaded, 0)

  executeDownload(task, headers)
  return true
}

export function cancelDownload(id: string): boolean {
  const signal = abortControllers.get(id)
  const task = tasks.find((t) => t.id === id)

  if (!task) return false

  if (signal) {
    signal.aborted = true
  }

  const previousStatus = task.status
  task.status = 'error'
  task.error = '已取消'
  cleanTempDir(task.id)

  // 删除已保存的文件（如果是单线程直接写的）
  try {
    if (fs.existsSync(task.savePath) && previousStatus !== 'completed') {
      fs.unlinkSync(task.savePath)
    }
  } catch {
    // ignore
  }

  notifyProgress(task)
  saveTasks()
  return true
}

export function removeTask(id: string): boolean {
  const index = tasks.findIndex((t) => t.id === id)
  if (index === -1) return false

  const task = tasks[index]

  // 如果正在下载先取消
  const signal = abortControllers.get(id)
  if (signal) signal.aborted = true

  cleanTempDir(task.id)
  tasks.splice(index, 1)
  saveTasks()
  return true
}

export function getTaskList(): Omit<BuiltinDownloadTask, 'chunks'>[] {
  return tasks.map(({ chunks, ...rest }) => ({
    ...rest,
    progress: rest.totalSize > 0 ? Math.round((rest.downloadedSize / rest.totalSize) * 100) : 0
  })) as Omit<BuiltinDownloadTask, 'chunks'>[]
}

export function getTask(id: string): BuiltinDownloadTask | null {
  return tasks.find((t) => t.id === id) || null
}

export function clearCompleted(): void {
  tasks = tasks.filter((t) => t.status !== 'completed')
  saveTasks()
}

export function openFile(id: string): boolean {
  const task = tasks.find((t) => t.id === id)
  if (!task || task.status !== 'completed') return false

  const { shell } = require('electron')
  shell.openPath(task.savePath)
  return true
}

export function openFolder(id: string): boolean {
  const task = tasks.find((t) => t.id === id)
  if (!task) return false

  const { shell } = require('electron')
  shell.showItemInFolder(task.savePath)
  return true
}
