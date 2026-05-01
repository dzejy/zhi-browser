import { getSearchUrl } from './settings'

export interface ClassifiedUrl {
  type: 'url' | 'search' | 'newtab'
  value: string
}

export function classifyInput(input: string): ClassifiedUrl {
  const trimmed = input.trim()

  if (!trimmed || trimmed === 'about:blank' || trimmed === 'zhi://newtab') {
    return { type: 'newtab', value: 'about:blank' }
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
    return { type: 'url', value: trimmed }
  }

  if (/^(localhost|\[::1\])(?::\d+)?(?:[/?#].*)?$/i.test(trimmed)) {
    return { type: 'url', value: 'http://' + trimmed }
  }

  if (/^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#].*)?$/.test(trimmed)) {
    return { type: 'url', value: 'http://' + trimmed }
  }

  if (trimmed.includes(' ')) {
    return { type: 'search', value: getSearchUrl(trimmed) }
  }

  if (!trimmed.includes('.') && !trimmed.includes(':')) {
    return { type: 'search', value: getSearchUrl(trimmed) }
  }

  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(?:[/:?#].*)?$/.test(trimmed)) {
    return { type: 'url', value: 'https://' + trimmed }
  }

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
