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
