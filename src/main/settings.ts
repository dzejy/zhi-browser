import { BrowserSettings } from '../shared/types'
import { readJSON, writeJSON } from './storage'
import { app } from 'electron'

const SETTINGS_FILE = 'settings.json'

function getDefaultSettings(): BrowserSettings {
  return {
    searchEngine: 'google',
    homepage: 'about:blank',
    restoreSession: true,
    downloadPath: app.getPath('downloads'),
    askWhereToSaveBeforeDownloading: true
  }
}

let cache: BrowserSettings | null = null

export function getSettings(): BrowserSettings {
  if (cache === null) {
    const saved = readJSON<Partial<BrowserSettings>>(SETTINGS_FILE, {})
    cache = { ...getDefaultSettings(), ...saved }
  }
  return cache
}

export function updateSettings(partial: Partial<BrowserSettings>): BrowserSettings {
  const current = getSettings()
  cache = { ...current, ...partial }
  writeJSON(SETTINGS_FILE, cache)
  return cache
}

export function getSearchUrl(query: string): string {
  const settings = getSettings()
  const encoded = encodeURIComponent(query)
  switch (settings.searchEngine) {
    case 'bing':
      return `https://www.bing.com/search?q=${encoded}`
    case 'baidu':
      return `https://www.baidu.com/s?wd=${encoded}`
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${encoded}`
    case 'google':
    default:
      return `https://www.google.com/search?q=${encoded}`
  }
}
