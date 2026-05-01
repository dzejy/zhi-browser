export const APP_TITLE = 'Zhi Browser'
export const NEW_TAB_URL = 'zhi://newtab'
export const BLANK_PAGE_URL = 'about:blank'

const SEARCH_BASE_URL = 'https://www.google.com/search?q='
const ERR_NAME_NOT_RESOLVED = -105
const SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:/i
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/i
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/.*)?$/i
const PRIVATE_HOST_PATTERN = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i

export interface ClassifiedInput {
  kind: 'blank' | 'url' | 'search'
  url: string
}

export function isNameNotResolvedError(errorCode: number): boolean {
  return errorCode === ERR_NAME_NOT_RESOLVED
}

export function isBlankUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase()
  return trimmed === '' || trimmed === BLANK_PAGE_URL || trimmed === NEW_TAB_URL
}

export function toVisibleUrl(url: string): string {
  return isBlankUrl(url) ? '' : url
}

export function getDisplayTitle(url: string): string {
  if (isBlankUrl(url)) {
    return 'New Tab'
  }

  try {
    return new URL(url).hostname || APP_TITLE
  } catch {
    return APP_TITLE
  }
}

export function classifyInput(rawInput: string): ClassifiedInput {
  const input = rawInput.trim()

  if (!input || input.toLowerCase() === NEW_TAB_URL || input.toLowerCase() === BLANK_PAGE_URL) {
    return {
      kind: 'blank',
      url: BLANK_PAGE_URL
    }
  }

  if (/\s/.test(input)) {
    return searchInput(input)
  }

  if (isLocalAddress(input)) {
    return parseUrl(`http://${input}`) ?? searchInput(input)
  }

  if (/^https?:\/\//i.test(input)) {
    return parseUrl(input) ?? searchInput(input)
  }

  if (SCHEME_PATTERN.test(input)) {
    return searchInput(input)
  }

  if (isProbablyDomain(input)) {
    return parseUrl(`https://${input}`) ?? searchInput(input)
  }

  return searchInput(input)
}

export function normalizeUrl(rawInput: string): string {
  return classifyInput(rawInput).url
}

export function getWwwFallbackUrl(failedUrl: string): string {
  try {
    const parsedUrl = new URL(failedUrl)

    if (
      (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
      isFallbackHost(parsedUrl.hostname)
    ) {
      return ''
    }

    parsedUrl.hostname = `www.${parsedUrl.hostname}`
    return parsedUrl.href
  } catch {
    return ''
  }
}

export function shouldRecordHistory(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function parseUrl(url: string): ClassifiedInput | null {
  try {
    const parsedUrl = new URL(url)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null
    }

    return {
      kind: 'url',
      url: parsedUrl.href
    }
  } catch {
    return null
  }
}

function searchInput(input: string): ClassifiedInput {
  return {
    kind: 'search',
    url: `${SEARCH_BASE_URL}${encodeURIComponent(input)}`
  }
}

function isLocalAddress(input: string): boolean {
  return (
    LOCAL_HOST_PATTERN.test(input) || IPV4_PATTERN.test(input) || PRIVATE_HOST_PATTERN.test(input)
  )
}

function isProbablyDomain(input: string): boolean {
  const host = input.split('/')[0]

  if (!host.includes('.')) {
    return false
  }

  if (host.startsWith('.') || host.endsWith('.')) {
    return false
  }

  return /^[a-z0-9.-]+(:\d+)?$/i.test(host)
}

function isFallbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.startsWith('www.') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(':')
  )
}
