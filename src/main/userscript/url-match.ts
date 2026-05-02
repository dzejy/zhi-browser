export function matchPattern(pattern: string, url: string): boolean {
  if (pattern === '<all_urls>') return true
  if (pattern === '*') return true

  const matchPatternRegex = /^(\*|http|https|file|ftp):\/\/(\*|(?:\*\.)?[^/*]+)\/(.*)$/
  const match = pattern.match(matchPatternRegex)

  if (match) {
    const [, scheme, host, pathPattern] = match
    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      return false
    }

    if (scheme !== '*') {
      if (urlObj.protocol !== `${scheme}:`) return false
    } else if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return false
    }

    if (host !== '*') {
      if (host.startsWith('*.')) {
        const baseDomain = host.slice(2)
        if (urlObj.hostname !== baseDomain && !urlObj.hostname.endsWith(`.${baseDomain}`)) {
          return false
        }
      } else if (urlObj.hostname !== host) {
        return false
      }
    }

    const urlPath = urlObj.pathname + urlObj.search
    if (!globMatch(pathPattern, urlPath.startsWith('/') ? urlPath.slice(1) : urlPath)) {
      if (!globMatch(`/${pathPattern}`, urlPath)) return false
    }

    return true
  }

  return globMatch(pattern, url)
}

function globMatch(pattern: string, str: string): boolean {
  let regexStr = '^'
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    switch (char) {
      case '*':
        regexStr += '.*'
        break
      case '?':
        regexStr += '.'
        break
      case '.':
      case '(':
      case ')':
      case '[':
      case ']':
      case '{':
      case '}':
      case '+':
      case '^':
      case '$':
      case '|':
      case '\\':
        regexStr += `\\${char}`
        break
      default:
        regexStr += char
    }
  }
  regexStr += '$'

  try {
    return new RegExp(regexStr, 'i').test(str)
  } catch {
    return false
  }
}

export function shouldInjectScript(
  meta: { match: string[]; include: string[]; exclude: string[] },
  url: string
): boolean {
  for (const pattern of meta.exclude) {
    if (matchPattern(pattern, url)) return false
  }

  for (const pattern of meta.match) {
    if (matchPattern(pattern, url)) return true
  }

  for (const pattern of meta.include) {
    if (matchPattern(pattern, url)) return true
  }

  return false
}
