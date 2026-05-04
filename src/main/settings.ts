import { app, dialog, shell } from 'electron'
import { join } from 'path'
import type { BrowserSettings, BrowserSettingsPatch } from '../shared/types'
import {
  DEFAULT_PREFERENCES,
  DeepPartial,
  PREFERENCES_SCHEMA_VERSION,
  Preferences,
  SearchEngineId,
  cloneDefaultPreferences,
  getSearchUrl as buildSearchUrl,
  migratePreferences,
  normalizeUrl,
  validateImport
} from '../shared/preferences'
import { readJSON, writeJSON } from './storage'

const PREFERENCES_FILE = 'preferences.json'
const LEGACY_SETTINGS_FILE = 'settings.json'

let cache: Preferences | null = null

export function getPreferences(): Preferences {
  if (cache === null) {
    const savedPrefs = readJSON<unknown>(PREFERENCES_FILE, null)
    if (savedPrefs) {
      cache = withRuntimeDefaults(migratePreferences(savedPrefs))
    } else {
      const legacy = readJSON<unknown>(LEGACY_SETTINGS_FILE, null)
      cache = withRuntimeDefaults(migratePreferences(legacyToPreferences(legacy)))
      writeJSON(PREFERENCES_FILE, cache)
    }
  }
  return clonePreferences(cache)
}

export function updatePreferences(partial: DeepPartial<Preferences>): Preferences {
  const current = getPreferences()
  cache = withRuntimeDefaults(
    migratePreferences(
      deepMerge(current as unknown as Record<string, unknown>, partialToRecord(partial))
    )
  )
  writeJSON(PREFERENCES_FILE, cache)
  return clonePreferences(cache)
}

export function resetPreferences(): BrowserSettings {
  cache = withRuntimeDefaults(cloneDefaultPreferences())
  writeJSON(PREFERENCES_FILE, cache)
  return getSettings()
}

export const resetSettings = resetPreferences

export function resetPreferenceGroup(group: string): BrowserSettings {
  const validGroups: Array<keyof Preferences> = [
    'startup',
    'search',
    'appearance',
    'toolbar',
    'tabs',
    'downloads',
    'downloader',
    'proxy',
    'webPanels',
    'advanced',
    'adblock',
    'themeColor',
    'uiFont',
    'ai'
  ]
  if (!validGroups.includes(group as keyof Preferences)) return getSettings()

  const current = getPreferences()
  const defaults = withRuntimeDefaults(cloneDefaultPreferences())
  const key = group as keyof Preferences
  const next = { ...current, [key]: defaults[key], _schemaVersion: PREFERENCES_SCHEMA_VERSION }
  cache = withRuntimeDefaults(migratePreferences(next))
  writeJSON(PREFERENCES_FILE, cache)
  return getSettings()
}

export function getSettings(): BrowserSettings {
  return toBrowserSettings(getPreferences())
}

export function updateSettings(partial: BrowserSettingsPatch): BrowserSettings {
  const patch = toPreferencePatch(partial)
  updatePreferences(patch)
  return getSettings()
}

export async function selectDownloadPath(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: '选择下载目录',
    defaultPath: getPreferences().downloads.defaultDirectory || app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export function exportPreferences(): { data: string } {
  return { data: JSON.stringify(getPreferences(), null, 2) }
}

export async function exportPreferencesToFile(): Promise<{ success: boolean; error?: string }> {
  const { data } = exportPreferences()
  const result = await dialog.showSaveDialog({
    title: '导出偏好设置',
    defaultPath: 'zhi-preferences.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { success: false }
  try {
    const { writeFileSync } = await import('fs')
    writeFileSync(result.filePath, data, 'utf-8')
    return { success: true }
  } catch {
    return { success: false, error: '写入文件失败' }
  }
}

export function importPreferences(jsonStr: string): {
  success: boolean
  error?: string
  prefs?: BrowserSettings
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { success: false, error: 'JSON 解析失败' }
  }

  const validation = validateImport(parsed)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  cache = withRuntimeDefaults(migratePreferences(parsed))
  writeJSON(PREFERENCES_FILE, cache)
  return { success: true, prefs: getSettings() }
}

export async function importPreferencesFromFile(): Promise<{
  success: boolean
  error?: string
  prefs?: BrowserSettings
}> {
  const result = await dialog.showOpenDialog({
    title: '导入偏好设置',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return { success: false }
  try {
    const { readFileSync } = await import('fs')
    return importPreferences(readFileSync(result.filePaths[0], 'utf-8'))
  } catch {
    return { success: false, error: '读取文件失败' }
  }
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
  return buildSearchUrl(getPreferences(), query)
}

function toBrowserSettings(prefs: Preferences): BrowserSettings {
  const newTabBehavior: BrowserSettings['newTabBehavior'] = prefs.startup.newTabUrl
    ? 'homepage'
    : 'blank'

  return {
    ...clonePreferences(prefs),
    searchEngine: prefs.search.defaultEngine,
    homepage: prefs.startup.homepageUrl,
    newTabBehavior,
    restoreSession: prefs.startup.behavior === 'restoreSession',
    downloadPath: prefs.downloads.defaultDirectory,
    askWhereToSaveBeforeDownloading: prefs.downloads.askBeforeDownload,
    saveHistory: prefs.advanced.saveHistory,
    saveDownloadsHistory: prefs.advanced.saveDownloadsHistory,
    devToolsEnabled: prefs.advanced.devToolsEnabled
  }
}

function toPreferencePatch(partial: BrowserSettingsPatch): DeepPartial<Preferences> {
  const record = partialToRecord(partial)
  const patch: DeepPartial<Preferences> = {}
  const preferenceKeys: Array<keyof Preferences> = [
    '_schemaVersion',
    'showBookmarkBar',
    'webDarkMode',
    'startup',
    'search',
    'appearance',
    'toolbar',
    'tabs',
    'downloads',
    'downloader',
    'proxy',
    'webPanels',
    'advanced',
    'adblock',
    'themeColor',
    'uiFont',
    'ai'
  ]

  for (const key of preferenceKeys) {
    if (record[key] !== undefined) {
      ;(patch as Record<string, unknown>)[key] = record[key]
    }
  }

  if (typeof record.searchEngine === 'string') {
    patch.search = {
      ...(patch.search || {}),
      defaultEngine: record.searchEngine as SearchEngineId
    }
  }
  if (typeof record.homepage === 'string') {
    patch.startup = {
      ...(patch.startup || {}),
      homepageUrl: record.homepage
    }
  }
  if (record.newTabBehavior === 'homepage') {
    const homepage =
      typeof record.homepage === 'string' ? record.homepage : getPreferences().startup.homepageUrl
    patch.startup = {
      ...(patch.startup || {}),
      newTabUrl: homepage
    }
  } else if (record.newTabBehavior === 'blank') {
    patch.startup = {
      ...(patch.startup || {}),
      newTabUrl: ''
    }
  }
  if (typeof record.restoreSession === 'boolean') {
    patch.startup = {
      ...(patch.startup || {}),
      behavior: record.restoreSession ? 'restoreSession' : 'newtab'
    }
  }
  if (typeof record.downloadPath === 'string') {
    patch.downloads = {
      ...(patch.downloads || {}),
      defaultDirectory: record.downloadPath
    }
  }
  if (typeof record.askWhereToSaveBeforeDownloading === 'boolean') {
    patch.downloads = {
      ...(patch.downloads || {}),
      askBeforeDownload: record.askWhereToSaveBeforeDownloading
    }
  }
  if (typeof record.saveHistory === 'boolean') {
    patch.advanced = {
      ...(patch.advanced || {}),
      saveHistory: record.saveHistory
    }
  }
  if (typeof record.saveDownloadsHistory === 'boolean') {
    patch.advanced = {
      ...(patch.advanced || {}),
      saveDownloadsHistory: record.saveDownloadsHistory
    }
  }
  if (typeof record.devToolsEnabled === 'boolean') {
    patch.advanced = {
      ...(patch.advanced || {}),
      devToolsEnabled: record.devToolsEnabled
    }
  }

  return patch
}

function legacyToPreferences(data: unknown): DeepPartial<Preferences> {
  if (!isRecord(data)) return {}
  const patch: DeepPartial<Preferences> = {}

  if (typeof data.searchEngine === 'string') {
    patch.search = { defaultEngine: data.searchEngine as SearchEngineId }
  }
  if (typeof data.homepage === 'string') {
    patch.startup = {
      ...(patch.startup || {}),
      homepageUrl: data.homepage,
      newTabUrl: data.newTabBehavior === 'homepage' ? data.homepage : ''
    }
  }
  if (typeof data.restoreSession === 'boolean') {
    patch.startup = {
      ...(patch.startup || {}),
      behavior: data.restoreSession ? 'restoreSession' : 'newtab'
    }
  }
  if (typeof data.downloadPath === 'string') {
    patch.downloads = {
      defaultDirectory: data.downloadPath,
      askBeforeDownload:
        typeof data.askWhereToSaveBeforeDownloading === 'boolean'
          ? data.askWhereToSaveBeforeDownloading
          : DEFAULT_PREFERENCES.downloads.askBeforeDownload
    }
  }
  patch.advanced = {
    saveHistory:
      typeof data.saveHistory === 'boolean'
        ? data.saveHistory
        : DEFAULT_PREFERENCES.advanced.saveHistory,
    saveDownloadsHistory:
      typeof data.saveDownloadsHistory === 'boolean'
        ? data.saveDownloadsHistory
        : DEFAULT_PREFERENCES.advanced.saveDownloadsHistory,
    devToolsEnabled:
      typeof data.devToolsEnabled === 'boolean'
        ? data.devToolsEnabled
        : DEFAULT_PREFERENCES.advanced.devToolsEnabled
  }

  return patch
}

function withRuntimeDefaults(prefs: Preferences): Preferences {
  if (!prefs.downloads.defaultDirectory) {
    prefs.downloads.defaultDirectory = app.getPath('downloads')
  }
  prefs.startup.homepageUrl = prefs.startup.homepageUrl.trim()
  prefs.startup.newTabUrl = prefs.startup.newTabUrl.trim()

  if (isLegacyDefaultStartupUrl(prefs.startup.homepageUrl, ['jianavi.com', 'www.jianavi.com', 'baidu.com', 'www.baidu.com'])) {
    prefs.startup.homepageUrl = DEFAULT_PREFERENCES.startup.homepageUrl
  }
  if (prefs.startup.newTabUrl === 'about:blank') {
    prefs.startup.newTabUrl = DEFAULT_PREFERENCES.startup.newTabUrl
  }
  if (/^zhi:\/\/newtab\/?$/i.test(prefs.startup.newTabUrl)) {
    prefs.startup.newTabUrl = DEFAULT_PREFERENCES.startup.newTabUrl
  }
  return prefs
}

function isLegacyDefaultStartupUrl(value: string, hosts: string[]): boolean {
  const normalized = (normalizeUrl(value) || value).trim().toLowerCase().replace(/\/+$/, '')
  return hosts.some((host) => normalized === `https://${host}` || normalized === `http://${host}`)
}

function clonePreferences(prefs: Preferences): Preferences {
  return JSON.parse(JSON.stringify(prefs)) as Preferences
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = target[key]
    if (isRecord(sourceValue) && isRecord(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue)
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue
    }
  }
  return result
}

function partialToRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
