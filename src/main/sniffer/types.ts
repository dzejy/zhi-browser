export interface SniffedResource {
  id: string
  url: string
  contentType: string
  size: string | null
  filename: string
  tabId: number
  timestamp: number
  resourceType: 'video' | 'audio' | 'document' | 'archive' | 'other'
}
