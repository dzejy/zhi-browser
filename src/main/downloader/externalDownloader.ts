import { spawn } from 'child_process'
import { existsSync } from 'fs'
import type { DownloaderType, DownloadTask, DownloaderConfig } from './types'

const DEFAULT_PATHS: Partial<Record<DownloaderType, string[]>> = {
  idm: [
    'C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe',
    'C:\\Program Files\\Internet Download Manager\\IDMan.exe'
  ],
  fdm: [
    'C:\\Program Files\\FreeDownloadManager.ORG\\Free Download Manager\\fdm.exe',
    'C:\\Program Files (x86)\\FreeDownloadManager.ORG\\Free Download Manager\\fdm.exe'
  ],
  ndm: [`${process.env.LOCALAPPDATA || ''}\\Programs\\NeatDM\\NeatDM.exe`]
}

function buildArgs(type: DownloaderType, task: DownloadTask): string[] {
  switch (type) {
    case 'idm': {
      const idmArgs = ['/d', task.url, '/n']
      if (task.filename) idmArgs.push('/f', task.filename)
      return idmArgs
    }
    case 'fdm':
      return [task.url]
    case 'ndm':
      return [task.url]
    case 'custom':
      return [task.url]
    default:
      return [task.url]
  }
}

export function detectInstalledDownloaders(): Partial<Record<DownloaderType, string | null>> {
  const result: Partial<Record<DownloaderType, string | null>> = {}

  for (const [type, paths] of Object.entries(DEFAULT_PATHS)) {
    const found = paths.find((candidate) => existsSync(candidate))
    result[type as DownloaderType] = found || null
  }

  return result
}

export function sendToDownloader(
  type: DownloaderType,
  config: DownloaderConfig,
  task: DownloadTask
): { success: boolean; error?: string } {
  if (!config.path || !existsSync(config.path)) {
    return { success: false, error: `下载器路径无效: ${config.path}` }
  }

  try {
    const args = buildArgs(type, task)
    const child = spawn(config.path, args, {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
