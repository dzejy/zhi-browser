import { getSearchUrl } from './settings'
import { normalizeUrl } from '../shared/preferences'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface ClassifiedUrl {
  type: 'url' | 'search' | 'newtab'
  value: string
}

export function classifyInput(input: string): ClassifiedUrl {
  const trimmed = input.trim()

  if (!trimmed || trimmed === 'about:blank') {
    return { type: 'newtab', value: 'zhi://newtab' }
  }

  // Tolerate slash variants users commonly type: zhi:\\all, zhi:/all, zhi:\all, zhi:all, etc.
  const zhiMatch = trimmed.match(/^zhi:[\\/]*([a-z]+)[\\/]*$/i)
  if (zhiMatch) {
    const page = zhiMatch[1].toLowerCase()
    if (page === 'newtab') {
      return { type: 'newtab', value: 'zhi://newtab' }
    }
    if (
      page === 'all' ||
      page === 'settings' ||
      page === 'bookmarks' ||
      page === 'history' ||
      page === 'downloads' ||
      page === 'shortcuts' ||
      page === 'commands' ||
      page === 'extensions'
    ) {
      return { type: 'url', value: `zhi://${page}` }
    }
  }

  const localFileUrl = toLocalFileUrl(trimmed)
  if (localFileUrl) {
    return { type: 'url', value: localFileUrl }
  }

  const normalized = normalizeUrl(trimmed)
  if (normalized) return { type: 'url', value: normalized }

  return { type: 'search', value: getSearchUrl(trimmed) }
}

function toLocalFileUrl(input: string): string {
  if (!input) return ''
  const unquoted =
    (input.startsWith('"') && input.endsWith('"')) ||
    (input.startsWith("'") && input.endsWith("'"))
      ? input.slice(1, -1).trim()
      : input
  if (!unquoted) return ''
  if (unquoted.startsWith('file://')) return unquoted
  if (/^[a-zA-Z]:[\\/]/.test(unquoted) || unquoted.startsWith('\\\\') || isAbsolute(unquoted)) {
    return pathToFileURL(unquoted).toString()
  }
  return ''
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
