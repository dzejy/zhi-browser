import { BrowserSettings } from '../shared/types'
import { readJSON, writeJSON } from './storage'
import { app, dialog, shell } from 'electron'
import { join } from 'path'

const SETTINGS_FILE = 'settings.json'

function getDefaultSettings(): BrowserSettings {
  return {
    searchEngine: 'google',
    homepage: 'about:blank',
    newTabBehavior: 'blank',
    restoreSession: true,
    downloadPath: app.getPath('downloads'),
    askWhereToSaveBeforeDownloading: true,
    saveHistory: true,
    saveDownloadsHistory: true,
    devToolsEnabled: true
  }
}

let cache: BrowserSettings | null = null

function normalizeSettings(saved: Partial<BrowserSettings>): BrowserSettings {
  const defaults = getDefaultSettings()
  const searchEngines: BrowserSettings['searchEngine'][] = ['google', 'bing', 'baidu', 'duckduckgo']
  const newTabBehaviors: BrowserSettings['newTabBehavior'][] = ['homepage', 'blank']

  return {
    ...defaults,
    ...saved,
    searchEngine: searchEngines.includes(saved.searchEngine as BrowserSettings['searchEngine'])
      ? (saved.searchEngine as BrowserSettings['searchEngine'])
      : defaults.searchEngine,
    homepage: typeof saved.homepage === 'string' ? saved.homepage : defaults.homepage,
    newTabBehavior: newTabBehaviors.includes(
      saved.newTabBehavior as BrowserSettings['newTabBehavior']
    )
      ? (saved.newTabBehavior as BrowserSettings['newTabBehavior'])
      : defaults.newTabBehavior,
    restoreSession:
      typeof saved.restoreSession === 'boolean' ? saved.restoreSession : defaults.restoreSession,
    downloadPath:
      typeof saved.downloadPath === 'string' ? saved.downloadPath : defaults.downloadPath,
    askWhereToSaveBeforeDownloading:
      typeof saved.askWhereToSaveBeforeDownloading === 'boolean'
        ? saved.askWhereToSaveBeforeDownloading
        : defaults.askWhereToSaveBeforeDownloading,
    saveHistory: typeof saved.saveHistory === 'boolean' ? saved.saveHistory : defaults.saveHistory,
    saveDownloadsHistory:
      typeof saved.saveDownloadsHistory === 'boolean'
        ? saved.saveDownloadsHistory
        : defaults.saveDownloadsHistory,
    devToolsEnabled:
      typeof saved.devToolsEnabled === 'boolean' ? saved.devToolsEnabled : defaults.devToolsEnabled
  }
}

export function getSettings(): BrowserSettings {
  if (cache === null) {
    const saved = readJSON<Partial<BrowserSettings>>(SETTINGS_FILE, {})
    cache = normalizeSettings(saved)
  }
  return cache
}

export function updateSettings(partial: Partial<BrowserSettings>): BrowserSettings {
  const current = getSettings()
  cache = normalizeSettings({ ...current, ...partial })
  writeJSON(SETTINGS_FILE, cache)
  return cache
}

export function resetSettings(): BrowserSettings {
  cache = getDefaultSettings()
  writeJSON(SETTINGS_FILE, cache)
  return cache
}

export async function selectDownloadPath(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Select Download Folder',
    defaultPath: getSettings().downloadPath || app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export function getUserDataPath(): string {
  return join(app.getPath('userData'), 'browser-data')
}

export function openUserDataFolder(): void {
  shell.openPath(getUserDataPath()).catch(() => {
    /* ignore */
  })
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
