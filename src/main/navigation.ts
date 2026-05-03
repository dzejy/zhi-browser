import { getSearchUrl } from './settings'
import { normalizeUrl } from '../shared/preferences'

export interface ClassifiedUrl {
  type: 'url' | 'search' | 'newtab'
  value: string
}

export function classifyInput(input: string): ClassifiedUrl {
  const trimmed = input.trim()

  if (!trimmed || trimmed === 'about:blank' || trimmed === 'zhi://newtab') {
    return { type: 'newtab', value: 'about:blank' }
  }

  if (/^zhi:\/\/settings\/?$/i.test(trimmed)) {
    return { type: 'url', value: 'zhi://settings' }
  }

  const normalized = normalizeUrl(trimmed)
  if (normalized) return { type: 'url', value: normalized }

  return { type: 'search', value: getSearchUrl(trimmed) }
}

export function getWwwFallbackUrl(failedUrl: string): string | null {
  try {
    const urlObj = new URL(failedUrl)
    if (urlObj.protocol !== 'https:') return null
    if (urlObj.hostname.startsWith('www.')) return null
    urlObj.hostname = 'www.' + urlObj.hostname
    return urlObj.toString()
  } catch {
    return null
  }
}
