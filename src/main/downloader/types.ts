export type DownloaderType = 'idm' | 'fdm' | 'ndm' | 'custom' | 'builtin'

export interface DownloaderConfig {
  name: string
  enabled: boolean
  path: string
}

export interface DownloadTask {
  url: string
  filename?: string
  referer?: string
  cookie?: string
}

export interface BuiltinDownloadTask {
  id: string
  url: string
  filename: string
  savePath: string
  totalSize: number
  downloadedSize: number
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'merging'
  speed: number
  threads: number
  supportsRange: boolean
  chunks: ChunkInfo[]
  createdAt: number
  completedAt: number | null
  error: string | null
  referer: string
  userAgent: string
}

export interface ChunkInfo {
  index: number
  start: number
  end: number
  downloaded: number
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error'
  tempPath: string
}

export interface DownloadProgress {
  id: string
  downloadedSize: number
  totalSize: number
  speed: number
  status: BuiltinDownloadTask['status']
  progress: number
  chunks: { index: number; downloaded: number; status: string }[]
}

export interface DownloadOptions {
  url: string
  savePath?: string
  filename?: string
  threads?: number
  referer?: string
  userAgent?: string
}

export interface DownloaderPreferences {
  enabled: boolean
  defaultThreads: number
  maxConcurrent: number
  downloadDir: string
  useExternalDownloader: boolean
  externalDownloaderType: string
  externalDownloaderPath: string
}
