import type { Session } from 'electron'
import type { SniffedResource } from './types'

const MEDIA_CONTENT_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/x-flv',
  'video/x-matroska',
  'video/quicktime',
  'video/x-msvideo',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/x-m4a',
  'audio/webm',
  'application/pdf',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-bittorrent'
]

const MEDIA_URL_PATTERN =
  /\.(mp4|webm|mkv|flv|avi|mov|mp3|flac|ogg|wav|aac|m4a|m3u8|mpd|pdf|zip|rar|7z|torrent)(\?|#|$)/i

const IGNORE_PATTERNS = [
  /google-analytics\.com/,
  /doubleclick\.net/,
  /googlesyndication/,
  /facebook\.com\/tr/,
  /\.gif(\?|$)/i
]

function classifyResource(contentType: string, url: string): SniffedResource['resourceType'] {
  if (contentType.startsWith('video/') || /\.(mp4|webm|mkv|flv|avi|mov|m3u8|mpd)/i.test(url)) {
    return 'video'
  }
  if (contentType.startsWith('audio/') || /\.(mp3|flac|ogg|wav|aac|m4a)/i.test(url)) {
    return 'audio'
  }
  if (contentType.includes('pdf')) return 'document'
  if (/zip|rar|7z|torrent/.test(contentType) || /\.(zip|rar|7z|torrent)/i.test(url)) {
    return 'archive'
  }
  return 'other'
}

function guessFilename(url: string, contentType: string): string {
  try {
    const pathname = new URL(url).pathname
    const lastSegment = pathname.split('/').pop() || ''
    const decoded = decodeURIComponent(lastSegment)
    if (decoded && decoded.includes('.')) return decoded
  } catch {
    /* ignore */
  }

  const ext = contentType.split('/').pop()?.split(';')[0] || 'bin'
  return `resource_${Date.now()}.${ext}`
}

export class ResourceSnifferService {
  private resources: Map<number, SniffedResource[]> = new Map()
  private listeners: Set<(tabId: number, count: number) => void> = new Set()
  private installed = false

  setup(session: Session): void {
    if (this.installed) return
    this.installed = true

    session.webRequest.onHeadersReceived((details, callback) => {
      callback({ cancel: false })

      if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') return

      const url = details.url
      if (!url.startsWith('http://') && !url.startsWith('https://')) return
      if (IGNORE_PATTERNS.some((pattern) => pattern.test(url))) return

      const contentType = (
        details.responseHeaders?.['content-type']?.[0] ||
        details.responseHeaders?.['Content-Type']?.[0] ||
        ''
      ).toLowerCase()

      const isMedia =
        MEDIA_CONTENT_TYPES.some((type) => contentType.includes(type)) ||
        MEDIA_URL_PATTERN.test(url)

      if (!isMedia) return

      const tabId = details.webContentsId
      if (!tabId) return

      const existing = this.resources.get(tabId) || []
      if (existing.some((resource) => resource.url === url)) return

      const size =
        details.responseHeaders?.['content-length']?.[0] ||
        details.responseHeaders?.['Content-Length']?.[0] ||
        null

      const resource: SniffedResource = {
        id: `sniff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        url,
        contentType,
        size,
        filename: guessFilename(url, contentType),
        tabId,
        timestamp: Date.now(),
        resourceType: classifyResource(contentType, url)
      }

      existing.push(resource)
      this.resources.set(tabId, existing)
      this.listeners.forEach((listener) => listener(tabId, existing.length))
    })
  }

  getResourcesForTab(tabId: number): SniffedResource[] {
    return this.resources.get(tabId) || []
  }

  clearResourcesForTab(tabId: number): void {
    this.resources.delete(tabId)
  }

  getAllResources(): Map<number, SniffedResource[]> {
    return this.resources
  }

  onResourceFound(listener: (tabId: number, count: number) => void): void {
    this.listeners.add(listener)
  }

  removeListener(listener: (tabId: number, count: number) => void): void {
    this.listeners.delete(listener)
  }
}

export const resourceSniffer = new ResourceSnifferService()
