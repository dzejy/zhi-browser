export const PREFERENCES_SCHEMA_VERSION = 1

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export type ThemeMode = 'dark' | 'light' | 'system'
export type UIDensity = 'compact' | 'normal' | 'spacious'
export type StartupBehavior = 'homepage' | 'newtab' | 'restoreSession' | 'specificPages'
export type SearchEngineId = 'google' | 'bing' | 'baidu' | 'duckduckgo' | 'custom'
export type NewTabPosition = 'afterCurrent' | 'atEnd'
export type NewTabFocus = 'foreground' | 'background'
export type CloseTabActivate = 'left' | 'right' | 'recent'
export type AISearchMode = 'none' | 'xiaomi_web_search' | 'gemini_google_search'
export type ThemeColorId =
  | 'indigo'
  | 'violet'
  | 'rose'
  | 'teal'
  | 'amber'
  | 'emerald'
  | 'sky'
  | 'crimson'
export type UIFontId = 'system' | 'wenkai' | 'harmony' | 'source' | 'mono'
export type DownloaderType = 'idm' | 'fdm' | 'ndm' | 'custom' | 'builtin'
export type TabLayout = 'horizontal' | 'vertical'

export interface SearchEngineConfig {
  name: string
  urlTemplate: string
}

export interface ToolbarVisibility {
  backButton: boolean
  forwardButton: boolean
  reloadStopButton: boolean
  proxyButton: boolean
  homeButton: boolean
  adBlockButton: boolean
  darkModeButton: boolean
  translateButton: boolean
  readerButton: boolean
  bookmarkButton: boolean
  bookmarksButton: boolean
  historyButton: boolean
  downloadsButton: boolean
  snifferButton: boolean
  scriptsButton: boolean
  webPanelButton: boolean
  splitViewButton: boolean
  aiButton: boolean
  settingsButton: boolean
}

export interface AIProviderProfile {
  id: string
  name: string
  providerName: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxInputChars: number
  stream: boolean
  searchMode?: AISearchMode
}

export interface ProxyPreferences {
  enabled: boolean
  subscriptionUrl: string
  mixedPort: number
  apiPort: number
  secret: string
  autoStart: boolean
  lastUpdated: number | null
}

export interface Preferences {
  _schemaVersion: number
  showBookmarkBar: boolean
  themeColor: ThemeColorId
  uiFont: UIFontId
  webDarkMode: boolean
  startup: {
    behavior: StartupBehavior
    homepageUrl: string
    newTabUrl: string
    specificPages: string[]
  }
  search: {
    defaultEngine: SearchEngineId
    customEngine: SearchEngineConfig | null
  }
  appearance: {
    themeMode: ThemeMode
    accentColor: string
    density: UIDensity
  }
  toolbar: ToolbarVisibility
  tabs: {
    newTabPosition: NewTabPosition
    newTabFocus: NewTabFocus
    closeTabActivate: CloseTabActivate
  }
  downloads: {
    defaultDirectory: string
    askBeforeDownload: boolean
  }
  downloader: {
    enabled: boolean
    type: DownloaderType
    path: string
    defaultThreads: number
    maxConcurrent: number
    downloadDir: string
    useExternalDownloader: boolean
    externalDownloaderType: string
    externalDownloaderPath: string
  }
  quickSearch: {
    engine: string
  }
  proxy: ProxyPreferences
  workspace: {
    tabLayout: TabLayout
    sidebarWidth: number
    sidebarCollapsed: boolean
    autoCollapse: boolean
  }
  hibernation: {
    enabled: boolean
    timeoutMinutes: number
    whitelist: string[]
  }
  webPanels: Array<{ url: string; title: string; pinned: boolean }>
  advanced: {
    saveHistory: boolean
    saveDownloadsHistory: boolean
    devToolsEnabled: boolean
  }
  adblock: {
    enabled: boolean
    whitelist: string[]
    blockedCount: number
  }
  ai: {
    enabled: boolean
    providerName: string
    baseUrl: string
    apiKey: string
    model: string
    temperature: number
    maxInputChars: number
    stream: boolean
    searchMode?: AISearchMode
  }
  windowBounds: {
    x: number | undefined
    y: number | undefined
    width: number
    height: number
    isMaximized: boolean
  }
}

export const BUILTIN_ENGINES: Record<
  Exclude<SearchEngineId, 'custom'>,
  { name: string; urlTemplate: string }
> = {
  google: { name: 'Google', urlTemplate: 'https://www.google.com/search?q=%s' },
  bing: { name: 'Bing', urlTemplate: 'https://www.bing.com/search?q=%s' },
  baidu: { name: '百度', urlTemplate: 'https://www.baidu.com/s?wd=%s' },
  duckduckgo: { name: 'DuckDuckGo', urlTemplate: 'https://duckduckgo.com/?q=%s' }
}

export const DENSITY_VALUES = {
  compact: { chrome: 68, tabbar: 31, toolbar: 37, tab: 27, address: 28 },
  normal: { chrome: 74, tabbar: 34, toolbar: 40, tab: 30, address: 30 },
  spacious: { chrome: 82, tabbar: 38, toolbar: 44, tab: 34, address: 34 }
} as const

export const DEFAULT_PREFERENCES: Preferences = {
  _schemaVersion: PREFERENCES_SCHEMA_VERSION,
  showBookmarkBar: true,
  themeColor: 'indigo',
  uiFont: 'system',
  webDarkMode: false,
  startup: {
    behavior: 'newtab',
    homepageUrl: 'https://www.baidu.com',
    newTabUrl: '',
    specificPages: []
  },
  search: {
    defaultEngine: 'google',
    customEngine: null
  },
  appearance: {
    themeMode: 'dark',
    accentColor: '#5a7fbf',
    density: 'normal'
  },
  toolbar: {
    backButton: true,
    forwardButton: true,
    reloadStopButton: true,
    proxyButton: true,
    homeButton: true,
    adBlockButton: true,
    darkModeButton: true,
    translateButton: true,
    readerButton: true,
    bookmarkButton: true,
    bookmarksButton: true,
    historyButton: true,
    downloadsButton: true,
    snifferButton: true,
    scriptsButton: true,
    webPanelButton: true,
    splitViewButton: true,
    aiButton: true,
    settingsButton: true
  },
  tabs: {
    newTabPosition: 'afterCurrent',
    newTabFocus: 'foreground',
    closeTabActivate: 'right'
  },
  downloads: {
    defaultDirectory: '',
    askBeforeDownload: false
  },
  downloader: {
    enabled: false,
    type: 'builtin',
    path: '',
    defaultThreads: 8,
    maxConcurrent: 3,
    downloadDir: '',
    useExternalDownloader: false,
    externalDownloaderType: '',
    externalDownloaderPath: ''
  },
  quickSearch: {
    engine: 'google'
  },
  proxy: {
    enabled: false,
    subscriptionUrl: '',
    mixedPort: 17890,
    apiPort: 19090,
    secret: 'zhi-browser-proxy',
    autoStart: false,
    lastUpdated: null
  },
  workspace: {
    tabLayout: 'horizontal',
    sidebarWidth: 240,
    sidebarCollapsed: false,
    autoCollapse: true
  },
  hibernation: {
    enabled: false,
    timeoutMinutes: 30,
    whitelist: []
  },
  webPanels: [],
  advanced: {
    saveHistory: true,
    saveDownloadsHistory: true,
    devToolsEnabled: true
  },
  adblock: {
    enabled: false,
    whitelist: [],
    blockedCount: 0
  },
  ai: {
    enabled: false,
    providerName: 'OpenAI Compatible',
    baseUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.3,
    maxInputChars: 12000,
    stream: false,
    searchMode: 'none'
  },
  windowBounds: {
    x: undefined,
    y: undefined,
    width: 1280,
    height: 800,
    isMaximized: false
  }
}

export function cloneDefaultPreferences(): Preferences {
  return JSON.parse(JSON.stringify(DEFAULT_PREFERENCES)) as Preferences
}

export function getSearchUrl(prefs: Preferences, keyword: string): string {
  const encoded = encodeURIComponent(keyword)
  if (prefs.search.defaultEngine === 'custom' && prefs.search.customEngine) {
    const template = prefs.search.customEngine.urlTemplate
    if (validateSearchTemplate(template)) {
      return template.replace('%s', encoded)
    }
    return BUILTIN_ENGINES.google.urlTemplate.replace('%s', encoded)
  }

  const engine = BUILTIN_ENGINES[prefs.search.defaultEngine as Exclude<SearchEngineId, 'custom'>]
  return (engine || BUILTIN_ENGINES.google).urlTemplate.replace('%s', encoded)
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed || /\s/.test(trimmed)) return ''

  if (trimmed === 'about:blank') return trimmed
  if (trimmed.startsWith('data:')) return trimmed
  if (trimmed.startsWith('file://')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  if (/^localhost(:\d+)?([/?#].*)?$/i.test(trimmed)) return `http://${trimmed}`
  if (/^(?:\d{1,3}\.){3}\d{1,3}(:\d+)?([/?#].*)?$/.test(trimmed)) {
    return `http://${trimmed}`
  }
  if (/^\[[\da-fA-F:]+\](:\d+)?([/?#].*)?$/.test(trimmed)) return `http://${trimmed}`

  if (trimmed.includes('.') && /^[^\s]+$/.test(trimmed)) {
    return `https://${trimmed}`
  }

  return ''
}

export function isValidNavigableUrl(str: string): boolean {
  const trimmed = str.trim()
  if (!trimmed) return false
  if (trimmed === 'about:blank' || trimmed.startsWith('data:') || trimmed.startsWith('file://')) {
    return true
  }

  const normalized = normalizeUrl(trimmed)
  if (!normalized) return false
  try {
    new URL(normalized)
    return true
  } catch {
    return false
  }
}

export function validateSearchTemplate(template: string): boolean {
  if (typeof template !== 'string' || !template.includes('%s')) return false
  try {
    const url = new URL(template.replace('%s', 'test'))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function migratePreferences(data: unknown): Preferences {
  const base = cloneDefaultPreferences()
  if (!isPlainRecord(data)) return base
  return sanitizePreferences(
    deepMerge(base as unknown as Record<string, unknown>, data) as unknown as Preferences
  )
}

export function validateImport(data: unknown): { valid: boolean; error?: string } {
  if (!isPlainRecord(data)) {
    return { valid: false, error: '数据格式无效' }
  }
  if (typeof data._schemaVersion !== 'number') {
    return { valid: false, error: '缺少版本号' }
  }
  if (data._schemaVersion > PREFERENCES_SCHEMA_VERSION) {
    return { valid: false, error: '数据版本过高，请更新浏览器' }
  }
  return { valid: true }
}

function sanitizePreferences(prefs: Preferences): Preferences {
  const defaults = cloneDefaultPreferences()
  const raw = prefs as unknown as Record<string, unknown>
  if (!isPlainRecord(raw.startup)) prefs.startup = defaults.startup
  if (!isPlainRecord(raw.search)) prefs.search = defaults.search
  if (!isPlainRecord(raw.appearance)) prefs.appearance = defaults.appearance
  if (!isPlainRecord(raw.toolbar)) prefs.toolbar = defaults.toolbar
  if (!isPlainRecord(raw.tabs)) prefs.tabs = defaults.tabs
  if (!isPlainRecord(raw.downloads)) prefs.downloads = defaults.downloads
  if (!isPlainRecord(raw.downloader)) prefs.downloader = defaults.downloader
  if (!isPlainRecord(raw.proxy)) prefs.proxy = defaults.proxy
  if (!isPlainRecord(raw.workspace)) prefs.workspace = defaults.workspace
  if (!isPlainRecord(raw.hibernation)) prefs.hibernation = defaults.hibernation
  if (!Array.isArray(raw.webPanels)) prefs.webPanels = defaults.webPanels
  if (!isPlainRecord(raw.advanced)) prefs.advanced = defaults.advanced
  if (!isPlainRecord(raw.adblock)) prefs.adblock = defaults.adblock
  if (!isPlainRecord(raw.ai)) prefs.ai = defaults.ai
  if (typeof prefs.showBookmarkBar !== 'boolean') {
    prefs.showBookmarkBar = defaults.showBookmarkBar
  }
  if (typeof prefs.webDarkMode !== 'boolean') {
    prefs.webDarkMode = defaults.webDarkMode
  }

  const startupBehaviors: StartupBehavior[] = [
    'homepage',
    'newtab',
    'restoreSession',
    'specificPages'
  ]
  const engines: SearchEngineId[] = ['google', 'bing', 'baidu', 'duckduckgo', 'custom']
  const themes: ThemeMode[] = ['dark', 'light', 'system']
  const densities: UIDensity[] = ['compact', 'normal', 'spacious']
  const positions: NewTabPosition[] = ['afterCurrent', 'atEnd']
  const focusModes: NewTabFocus[] = ['foreground', 'background']
  const activateModes: CloseTabActivate[] = ['left', 'right', 'recent']
  const aiSearchModes: AISearchMode[] = ['none', 'xiaomi_web_search', 'gemini_google_search']
  const themeColors: ThemeColorId[] = [
    'indigo',
    'violet',
    'rose',
    'teal',
    'amber',
    'emerald',
    'sky',
    'crimson'
  ]
  const uiFonts: UIFontId[] = ['system', 'wenkai', 'harmony', 'source', 'mono']

  if (!startupBehaviors.includes(prefs.startup.behavior)) prefs.startup.behavior = 'newtab'
  if (!themeColors.includes(prefs.themeColor)) prefs.themeColor = defaults.themeColor
  if (!uiFonts.includes(prefs.uiFont)) prefs.uiFont = defaults.uiFont
  if (typeof prefs.startup.homepageUrl !== 'string') {
    prefs.startup.homepageUrl = defaults.startup.homepageUrl
  }
  if (typeof prefs.startup.newTabUrl !== 'string') {
    prefs.startup.newTabUrl = defaults.startup.newTabUrl
  }
  if (!Array.isArray(prefs.startup.specificPages)) prefs.startup.specificPages = []
  prefs.startup.specificPages = prefs.startup.specificPages.filter(
    (page): page is string => typeof page === 'string'
  )
  if (!engines.includes(prefs.search.defaultEngine)) prefs.search.defaultEngine = 'google'
  if (
    prefs.search.customEngine !== null &&
    (!prefs.search.customEngine ||
      typeof prefs.search.customEngine.name !== 'string' ||
      typeof prefs.search.customEngine.urlTemplate !== 'string')
  ) {
    prefs.search.customEngine = null
  }
  if (!themes.includes(prefs.appearance.themeMode)) prefs.appearance.themeMode = 'dark'
  if (typeof prefs.appearance.accentColor !== 'string') {
    prefs.appearance.accentColor = defaults.appearance.accentColor
  }
  if (!densities.includes(prefs.appearance.density)) prefs.appearance.density = 'normal'
  for (const key of Object.keys(defaults.toolbar) as Array<keyof ToolbarVisibility>) {
    if (typeof prefs.toolbar[key] !== 'boolean') prefs.toolbar[key] = defaults.toolbar[key]
  }
  if (!positions.includes(prefs.tabs.newTabPosition)) prefs.tabs.newTabPosition = 'afterCurrent'
  if (!focusModes.includes(prefs.tabs.newTabFocus)) prefs.tabs.newTabFocus = 'foreground'
  if (!activateModes.includes(prefs.tabs.closeTabActivate)) prefs.tabs.closeTabActivate = 'right'
  if (typeof prefs.downloads.defaultDirectory !== 'string') {
    prefs.downloads.defaultDirectory = defaults.downloads.defaultDirectory
  }
  if (typeof prefs.downloads.askBeforeDownload !== 'boolean') {
    prefs.downloads.askBeforeDownload = defaults.downloads.askBeforeDownload
  }
  const downloaderTypes: DownloaderType[] = ['idm', 'fdm', 'ndm', 'custom', 'builtin']
  if (typeof prefs.downloader.enabled !== 'boolean') {
    prefs.downloader.enabled = defaults.downloader.enabled
  }
  if (!downloaderTypes.includes(prefs.downloader.type)) {
    prefs.downloader.type = defaults.downloader.type
  }
  if (typeof prefs.downloader.path !== 'string') {
    prefs.downloader.path = defaults.downloader.path
  }
  if (typeof prefs.downloader.defaultThreads !== 'number') {
    prefs.downloader.defaultThreads = defaults.downloader.defaultThreads
  }
  if (typeof prefs.downloader.maxConcurrent !== 'number') {
    prefs.downloader.maxConcurrent = defaults.downloader.maxConcurrent
  }
  if (typeof prefs.downloader.downloadDir !== 'string') {
    prefs.downloader.downloadDir = defaults.downloader.downloadDir
  }
  if (typeof prefs.downloader.useExternalDownloader !== 'boolean') {
    prefs.downloader.useExternalDownloader = defaults.downloader.useExternalDownloader
  }
  if (typeof prefs.downloader.externalDownloaderType !== 'string') {
    prefs.downloader.externalDownloaderType = defaults.downloader.externalDownloaderType
  }
  if (typeof prefs.downloader.externalDownloaderPath !== 'string') {
    prefs.downloader.externalDownloaderPath = defaults.downloader.externalDownloaderPath
  }
  if (typeof prefs.proxy.enabled !== 'boolean') prefs.proxy.enabled = defaults.proxy.enabled
  if (typeof prefs.proxy.subscriptionUrl !== 'string') {
    prefs.proxy.subscriptionUrl = defaults.proxy.subscriptionUrl
  }
  if (
    typeof prefs.proxy.mixedPort !== 'number' ||
    !Number.isFinite(prefs.proxy.mixedPort) ||
    prefs.proxy.mixedPort < 1 ||
    prefs.proxy.mixedPort > 65535
  ) {
    prefs.proxy.mixedPort = defaults.proxy.mixedPort
  }
  if (
    typeof prefs.proxy.apiPort !== 'number' ||
    !Number.isFinite(prefs.proxy.apiPort) ||
    prefs.proxy.apiPort < 1 ||
    prefs.proxy.apiPort > 65535
  ) {
    prefs.proxy.apiPort = defaults.proxy.apiPort
  }
  if (typeof prefs.proxy.secret !== 'string') prefs.proxy.secret = defaults.proxy.secret
  if (typeof prefs.proxy.autoStart !== 'boolean') prefs.proxy.autoStart = defaults.proxy.autoStart
  if (typeof prefs.proxy.lastUpdated !== 'number') prefs.proxy.lastUpdated = null
  if (!['horizontal', 'vertical'].includes(prefs.workspace.tabLayout)) {
    prefs.workspace.tabLayout = defaults.workspace.tabLayout
  }
  if (
    typeof prefs.workspace.sidebarWidth !== 'number' ||
    !Number.isFinite(prefs.workspace.sidebarWidth)
  ) {
    prefs.workspace.sidebarWidth = defaults.workspace.sidebarWidth
  }
  prefs.workspace.sidebarWidth = Math.max(160, Math.min(420, prefs.workspace.sidebarWidth))
  if (typeof prefs.workspace.sidebarCollapsed !== 'boolean') {
    prefs.workspace.sidebarCollapsed = defaults.workspace.sidebarCollapsed
  }
  if (typeof prefs.workspace.autoCollapse !== 'boolean') {
    prefs.workspace.autoCollapse = defaults.workspace.autoCollapse
  }
  if (typeof prefs.hibernation.enabled !== 'boolean') {
    prefs.hibernation.enabled = defaults.hibernation.enabled
  }
  if (
    typeof prefs.hibernation.timeoutMinutes !== 'number' ||
    !Number.isFinite(prefs.hibernation.timeoutMinutes)
  ) {
    prefs.hibernation.timeoutMinutes = defaults.hibernation.timeoutMinutes
  }
  prefs.hibernation.timeoutMinutes = Math.max(1, Math.min(1440, prefs.hibernation.timeoutMinutes))
  if (!Array.isArray(prefs.hibernation.whitelist)) prefs.hibernation.whitelist = []
  prefs.hibernation.whitelist = prefs.hibernation.whitelist.filter(
    (host): host is string => typeof host === 'string'
  )
  prefs.webPanels = prefs.webPanels
    .filter((panel) => isPlainRecord(panel))
    .map((panel) => ({
      url: typeof panel.url === 'string' ? panel.url : '',
      title: typeof panel.title === 'string' ? panel.title : '',
      pinned: typeof panel.pinned === 'boolean' ? panel.pinned : true
    }))
    .filter((panel) => panel.url)
  if (typeof prefs.advanced.saveHistory !== 'boolean') {
    prefs.advanced.saveHistory = defaults.advanced.saveHistory
  }
  if (typeof prefs.advanced.saveDownloadsHistory !== 'boolean') {
    prefs.advanced.saveDownloadsHistory = defaults.advanced.saveDownloadsHistory
  }
  if (typeof prefs.advanced.devToolsEnabled !== 'boolean') {
    prefs.advanced.devToolsEnabled = defaults.advanced.devToolsEnabled
  }
  if (typeof prefs.adblock.enabled !== 'boolean') prefs.adblock.enabled = defaults.adblock.enabled
  if (!Array.isArray(prefs.adblock.whitelist)) prefs.adblock.whitelist = []
  prefs.adblock.whitelist = prefs.adblock.whitelist.filter(
    (host): host is string => typeof host === 'string'
  )
  if (typeof prefs.adblock.blockedCount !== 'number' || prefs.adblock.blockedCount < 0) {
    prefs.adblock.blockedCount = 0
  }
  if (typeof prefs.ai.enabled !== 'boolean') prefs.ai.enabled = defaults.ai.enabled
  if (typeof prefs.ai.providerName !== 'string') {
    prefs.ai.providerName = defaults.ai.providerName
  }
  if (typeof prefs.ai.baseUrl !== 'string') prefs.ai.baseUrl = defaults.ai.baseUrl
  if (typeof prefs.ai.apiKey !== 'string') prefs.ai.apiKey = defaults.ai.apiKey
  if (typeof prefs.ai.model !== 'string') prefs.ai.model = defaults.ai.model
  if (
    typeof prefs.ai.temperature !== 'number' ||
    !Number.isFinite(prefs.ai.temperature) ||
    prefs.ai.temperature < 0 ||
    prefs.ai.temperature > 2
  ) {
    prefs.ai.temperature = defaults.ai.temperature
  }
  if (
    typeof prefs.ai.maxInputChars !== 'number' ||
    !Number.isFinite(prefs.ai.maxInputChars) ||
    prefs.ai.maxInputChars < 1000
  ) {
    prefs.ai.maxInputChars = defaults.ai.maxInputChars
  }
  prefs.ai.maxInputChars = Math.min(Math.round(prefs.ai.maxInputChars), 100000)
  if (typeof prefs.ai.stream !== 'boolean') prefs.ai.stream = defaults.ai.stream
  if (!aiSearchModes.includes(prefs.ai.searchMode ?? 'none')) {
    prefs.ai.searchMode = defaults.ai.searchMode
  } else {
    prefs.ai.searchMode = prefs.ai.searchMode ?? 'none'
  }

  if (!isPlainRecord(raw.windowBounds)) {
    prefs.windowBounds = defaults.windowBounds
  } else {
    if (typeof prefs.windowBounds.width !== 'number') {
      prefs.windowBounds.width = defaults.windowBounds.width
    }
    if (typeof prefs.windowBounds.height !== 'number') {
      prefs.windowBounds.height = defaults.windowBounds.height
    }
    if (typeof prefs.windowBounds.isMaximized !== 'boolean') {
      prefs.windowBounds.isMaximized = defaults.windowBounds.isMaximized
    }
  }

  prefs._schemaVersion = PREFERENCES_SCHEMA_VERSION
  return prefs
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = target[key]
    if (isPlainRecord(sourceValue) && isPlainRecord(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue)
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue
    }
  }
  return result
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
