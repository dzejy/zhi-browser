import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import type { AIResponse, AISelectionAction, AIStatus } from '../../shared/aiTypes'
import { UI_SCALE } from '../../shared/uiScale'

// ===== Types (mirrored from shared/types for renderer use) =====
interface TabState {
  id: string
  webContentsId: number
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: LoadError | null
  isPinned: boolean
  zoomFactor: number
  isNewTab: boolean
  isAudible: boolean
  isMuted: boolean
  isIncognito: boolean
  isHibernated?: boolean
}
interface LoadError {
  url: string
  errorCode: number
  errorDescription: string
}
interface BrowserState {
  tabs: TabState[]
  activeTabId: string
  findState: FindState | null
  downloads: DownloadItem[]
  recentlyClosed: RecentlyClosedTab[]
}
interface FindState {
  tabId: string
  text: string
  activeMatchOrdinal: number
  matches: number
}
interface DownloadItem {
  id: string
  filename: string
  url: string
  totalBytes: number
  receivedBytes: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  savePath: string
  startedAt: number
}
interface RecentlyClosedTab {
  id?: string
  url: string
  title: string
  favicon: string
  closedAt: number
}
interface BookmarkItem {
  id?: string
  url: string
  title: string
  favicon: string
  createdAt: number
  folder?: string
}
interface HistoryItem {
  id?: string
  url: string
  title: string
  visitedAt: number
  favicon?: string
}
interface ToastMessage {
  id: string
  text: string
  duration: number
}
type AISearchMode = 'none' | 'xiaomi_web_search' | 'gemini_google_search'
type ThemeColorId = 'indigo' | 'violet' | 'rose' | 'teal' | 'amber' | 'emerald' | 'sky' | 'crimson'
type UIFontId = 'system' | 'wenkai' | 'harmony' | 'source' | 'mono'

const THEME_COLORS: Array<{ id: ThemeColorId; label: string; hue: number }> = [
  { id: 'indigo', label: '靛蓝', hue: 220 },
  { id: 'violet', label: '紫罗兰', hue: 262 },
  { id: 'rose', label: '玫瑰', hue: 340 },
  { id: 'teal', label: '松石绿', hue: 174 },
  { id: 'amber', label: '琥珀', hue: 36 },
  { id: 'emerald', label: '翡翠', hue: 152 },
  { id: 'sky', label: '天蓝', hue: 199 },
  { id: 'crimson', label: '绯红', hue: 4 }
]

const UI_FONTS: Array<{ id: UIFontId; label: string; preview: string }> = [
  { id: 'system', label: '系统默认', preview: '浏览世界，从这里开始' },
  { id: 'wenkai', label: '霞鹜文楷', preview: '浏览世界，从这里开始' },
  { id: 'harmony', label: '鸿蒙字体', preview: '浏览世界，从这里开始' },
  { id: 'source', label: '思源黑体', preview: '浏览世界，从这里开始' },
  { id: 'mono', label: '等宽极客', preview: '浏览世界，从这里开始' }
]

interface BrowserSettings {
  _schemaVersion: number
  showBookmarkBar: boolean
  themeColor: ThemeColorId
  uiFont: UIFontId
  webDarkMode: boolean
  startup: {
    behavior: 'homepage' | 'newtab' | 'restoreSession' | 'specificPages'
    homepageUrl: string
    newTabUrl: string
    specificPages: string[]
  }
  search: {
    defaultEngine: 'google' | 'bing' | 'baidu' | 'duckduckgo' | 'custom'
    customEngine: { name: string; urlTemplate: string } | null
  }
  appearance: {
    themeMode: 'dark' | 'light' | 'system'
    accentColor: string
    density: 'compact' | 'normal' | 'spacious'
  }
  toolbar: {
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
  tabs: {
    newTabPosition: 'afterCurrent' | 'atEnd'
    newTabFocus: 'foreground' | 'background'
    closeTabActivate: 'left' | 'right' | 'recent'
  }
  downloads: {
    defaultDirectory: string
    askBeforeDownload: boolean
  }
  downloader: {
    enabled: boolean
    type: 'idm' | 'fdm' | 'ndm' | 'custom' | 'builtin'
    path: string
  }
  proxy: {
    enabled: boolean
    subscriptionUrl: string
    mixedPort: number
    apiPort: number
    secret: string
    autoStart: boolean
    lastUpdated: number | null
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
  adblock: AdBlockState
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
  searchEngine: 'google' | 'bing' | 'baidu' | 'duckduckgo' | 'custom'
  homepage: string
  newTabBehavior: 'homepage' | 'blank'
  restoreSession: boolean
  downloadPath: string
  askWhereToSaveBeforeDownloading: boolean
  saveHistory: boolean
  saveDownloadsHistory: boolean
  devToolsEnabled: boolean
}

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

interface AdBlockState {
  enabled: boolean
  whitelist: string[]
  blockedCount: number
}

interface AdBlockCurrentSite {
  hostname: string
  canWhitelist: boolean
}

interface AboutInfo {
  appName: string
  appVersion: string
  electronVersion: string
  chromiumVersion: string
  nodeVersion: string
  userDataPath: string
}

interface BookmarkEditState {
  id: string
  title: string
  url: string
  folder: string
}

interface ProxyNode {
  name: string
  type: string
  alive: boolean
  delay: number | null
}

interface ProxyGroup {
  name: string
  type: string
  now: string
  all: string[]
}

interface ProxyStatus {
  running: boolean
  enabled: boolean
  currentNode: string
  groups: ProxyGroup[]
}

interface PasswordListItem {
  id: string
  url: string
  username: string
  title: string
  createdAt: number
  updatedAt: number
}

interface PasswordFormState {
  id: string
  title: string
  url: string
  username: string
  password: string
}

interface PasswordSavePrompt {
  url: string
  username: string
  password: string
  existing: boolean
}

interface PasswordFillPrompt {
  url: string
  webContentsId: number
  entries: Array<{ id: string; username: string }>
}

interface ConfirmDialogState {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

interface UserScriptItem {
  id: string
  meta: {
    name: string
    version: string
    description: string
    author: string
    match: string[]
  }
  enabled: boolean
  installTime: number
  updateTime: number
}

interface SniffedResource {
  id: string
  url: string
  contentType: string
  size: string | null
  filename: string
  tabId: number
  timestamp: number
  resourceType: 'video' | 'audio' | 'document' | 'archive' | 'other'
}

type SidePanelType =
  | 'bookmarks'
  | 'history'
  | 'downloads'
  | 'settings'
  | 'proxy'
  | 'about'
  | 'ai'
  | 'scripts'
  | 'webpanel'
  | 'sniffer'

const SIDE_PANEL_TYPES = new Set<SidePanelType>([
  'bookmarks',
  'history',
  'downloads',
  'settings',
  'proxy',
  'about',
  'ai',
  'scripts',
  'webpanel',
  'sniffer'
])

function isSidePanelType(value: unknown): value is SidePanelType {
  return typeof value === 'string' && SIDE_PANEL_TYPES.has(value as SidePanelType)
}

interface AIChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// `UI_TEST_SCALE` is the layout-offset multiplier used for values sent to the
// main process (chrome height, page top, etc.). The visual scaling is handled
// separately by CSS `zoom` on the document root — see main.css. Keep them
// in sync via the shared UI_SCALE constant.
const UI_TEST_SCALE = UI_SCALE
const TOP_CHROME_HEIGHT = 92
const BOOKMARK_BAR_HEIGHT = 28
const FIND_BAR_HEIGHT = 40
const ERROR_BAR_HEIGHT = 38
const FLOATING_MENU_HEIGHT = 430
const PROXY_MENU_HEIGHT = 350

type ToastTone = 'info' | 'success' | 'error'

interface LocalToastMessage extends ToastMessage {
  tone?: ToastTone
}

function getDownloadStateLabel(state: DownloadItem['state'] | string): string {
  switch (state) {
    case 'progressing':
      return '下载中'
    case 'completed':
      return '已完成'
    case 'cancelled':
      return '已取消'
    case 'interrupted':
      return '已中断'
    default:
      return '未知'
  }
}

function getDownloadProgress(download: DownloadItem): string {
  if (download.state !== 'progressing' || download.totalBytes <= 0) {
    return getDownloadStateLabel(download.state)
  }
  return `下载中 ${Math.round((download.receivedBytes / download.totalBytes) * 100)}%`
}

function getPanelEmptyText(
  total: number,
  filtered: number,
  emptyText: string,
  noResultText: string
): string {
  if (total === 0) return emptyText
  if (filtered === 0) return noResultText
  return ''
}

function formatAboutInfo(aboutInfo: AboutInfo): string {
  return `${aboutInfo.appName} ${aboutInfo.appVersion}\nElectron ${aboutInfo.electronVersion}\nChromium ${aboutInfo.chromiumVersion}\nNode.js ${aboutInfo.nodeVersion}\n数据目录 ${aboutInfo.userDataPath}`
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  return text
    .split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g)
    .filter(Boolean)
    .flatMap((part, index): React.ReactNode[] => {
      const key = `${keyPrefix}-inline-${index}`
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        const href = linkMatch[2]
        const safeHref = /^https?:\/\//i.test(href) ? href : undefined
        return [
          safeHref ? (
            <a
              key={key}
              href={safeHref}
              onClick={(event) => {
                event.preventDefault()
                window.api.openUrl(safeHref, false)
              }}
            >
              {linkMatch[1]}
            </a>
          ) : (
            linkMatch[1]
          )
        ]
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return [<code key={key}>{part.slice(1, -1)}</code>]
      }

      if (part.startsWith('**') && part.endsWith('**')) {
        return [<strong key={key}>{part.slice(2, -2)}</strong>]
      }

      if (part.startsWith('*') && part.endsWith('*')) {
        return [<em key={key}>{part.slice(1, -1)}</em>]
      }

      return part.split('\n').flatMap((piece, pieceIndex): React.ReactNode[] => {
        if (pieceIndex === 0) return [piece]
        return [<br key={`${key}-br-${pieceIndex}`} />, piece]
      })
    })
}

function renderMarkdownMessage(content: string): React.ReactNode {
  const blocks: React.ReactNode[] = []
  const lines = content.split('\n')
  let paragraph: string[] = []
  let index = 0

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return
    const blockIndex = blocks.length
    blocks.push(
      <p key={`p-${blockIndex}`}>{renderInlineMarkdown(paragraph.join('\n'), `p-${blockIndex}`)}</p>
    )
    paragraph = []
  }

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      flushParagraph()
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(
        <pre key={`code-${blocks.length}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      const blockIndex = blocks.length
      const headingContent = renderInlineMarkdown(headingMatch[2], `h-${blockIndex}`)
      const headingLevel = Math.min(headingMatch[1].length, 4)
      if (headingLevel === 1) {
        blocks.push(<h1 key={`h-${blockIndex}`}>{headingContent}</h1>)
      } else if (headingLevel === 2) {
        blocks.push(<h2 key={`h-${blockIndex}`}>{headingContent}</h2>)
      } else if (headingLevel === 3) {
        blocks.push(<h3 key={`h-${blockIndex}`}>{headingContent}</h3>)
      } else {
        blocks.push(<h4 key={`h-${blockIndex}`}>{headingContent}</h4>)
      }
      index += 1
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      const blockIndex = blocks.length
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''))
        index += 1
      }
      blocks.push(
        <ul key={`ul-${blockIndex}`}>
          {items.map((item, itemIndex) => (
            <li key={`ul-${blockIndex}-${itemIndex}`}>
              {renderInlineMarkdown(item, `ul-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      const blockIndex = blocks.length
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''))
        index += 1
      }
      blocks.push(
        <ol key={`ol-${blockIndex}`}>
          {items.map((item, itemIndex) => (
            <li key={`ol-${blockIndex}-${itemIndex}`}>
              {renderInlineMarkdown(item, `ol-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph()
      const quoteLines: string[] = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      const blockIndex = blocks.length
      blocks.push(
        <blockquote key={`quote-${blockIndex}`}>
          {renderInlineMarkdown(quoteLines.join('\n'), `quote-${blockIndex}`)}
        </blockquote>
      )
      continue
    }

    paragraph.push(line)
    index += 1
  }

  flushParagraph()
  return <div className="ai-markdown">{blocks}</div>
}

function SkeletonRows({ rows = 3 }: { rows?: number }): React.ReactElement {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="skeleton-row" key={`skeleton-${rowIndex}`}>
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ))}
    </>
  )
}

function handlePanelSpotlightMove(e: React.MouseEvent<HTMLElement>): void {
  const rect = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
  e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
}

const DENSITY_VALUES = {
  compact: { chrome: 84, tabbar: 36, toolbar: 48, tab: 32, address: 34 },
  normal: { chrome: 92, tabbar: 40, toolbar: 52, tab: 36, address: 38 },
  spacious: { chrome: 100, tabbar: 44, toolbar: 56, tab: 40, address: 42 }
} as const

function applyAppearance(settings: BrowserSettings | null): (() => void) | undefined {
  if (!settings) return undefined
  const root = document.documentElement
  const values = DENSITY_VALUES[settings.appearance.density]
  root.style.setProperty('--ui-scale', `${UI_TEST_SCALE}`)
  root.style.setProperty('--chrome-height', `${scaleUiSize(values.chrome)}px`)
  root.style.setProperty('--tabbar-height', `${scaleUiSize(values.tabbar)}px`)
  root.style.setProperty('--toolbar-height', `${scaleUiSize(values.toolbar)}px`)
  root.style.setProperty('--tab-height', `${scaleUiSize(values.tab)}px`)
  root.style.setProperty('--address-bar-height', `${scaleUiSize(values.address)}px`)
  root.style.setProperty('--legacy-accent-color', settings.appearance.accentColor)
  root.style.setProperty('--color-accent', 'var(--theme)')
  root.style.setProperty('--color-accent-hover', 'hsl(var(--theme-hue), var(--theme-sat), 54%)')
  root.style.setProperty('--color-loading', 'var(--theme)')
  root.style.setProperty('--border-focus', 'var(--theme-border)')
  root.setAttribute('data-theme-color', settings.themeColor)
  root.setAttribute('data-ui-font', settings.uiFont)

  const setTheme = (mode: 'dark' | 'light'): void => {
    root.setAttribute('data-theme', mode)
  }

  if (settings.appearance.themeMode === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(mq.matches ? 'dark' : 'light')
    const listener = (event: MediaQueryListEvent): void =>
      setTheme(event.matches ? 'dark' : 'light')
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }

  setTheme(settings.appearance.themeMode)
  return undefined
}

function scaleUiSize(value: number): number {
  return Math.round(value * UI_TEST_SCALE)
}

export interface WebPanelItem {
  id: string
  name: string
  url: string
  icon: string
  order: number
}

interface QuickSearchEngine {
  id: string
  name: string
  icon: string
  urlTemplate: string
}

const QUICK_SEARCH_ENGINES: QuickSearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    icon: 'G',
    urlTemplate: 'https://www.google.com/search?q={query}'
  },
  {
    id: 'baidu',
    name: '百度',
    icon: '百',
    urlTemplate: 'https://www.baidu.com/s?wd={query}'
  },
  {
    id: 'bing',
    name: 'Bing',
    icon: 'B',
    urlTemplate: 'https://www.bing.com/search?q={query}'
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    icon: 'D',
    urlTemplate: 'https://duckduckgo.com/?q={query}'
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'GH',
    urlTemplate: 'https://github.com/search?q={query}'
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶️',
    urlTemplate: 'https://www.youtube.com/results?search_query={query}'
  }
]

function getQuickSearchEngines(settings: BrowserSettings | null): QuickSearchEngine[] {
  const customEngine = settings?.search.customEngine
  return [
    ...QUICK_SEARCH_ENGINES,
    {
      id: 'custom',
      name: customEngine?.name?.trim() || '自定义',
      icon: '自',
      urlTemplate: customEngine?.urlTemplate?.trim() || ''
    }
  ]
}

function hasSearchPlaceholder(template: string): boolean {
  return template.includes('{query}') || template.includes('%s')
}

function buildQuickSearchUrl(template: string, query: string): string {
  const encoded = encodeURIComponent(query)
  return template.replaceAll('{query}', encoded).replaceAll('%s', encoded)
}

function getProxyDelayClass(delay: number | null | undefined): string {
  if (delay === null || delay === undefined || delay < 0) return 'delay-timeout'
  if (delay < 150) return 'delay-fast'
  if (delay <= 300) return 'delay-medium'
  return 'delay-slow'
}

function App(): React.ReactElement {
  return window.location.search.includes('panel=true') ? <App_PanelOnly /> : <BrowserApp />
}

function BrowserApp(): React.ReactElement {
  const [browserState, setBrowserState] = useState<BrowserState>({
    tabs: [],
    activeTabId: '',
    findState: null,
    downloads: [],
    recentlyClosed: []
  })
  const [inputUrl, setInputUrl] = useState('')
  const [activePanel, setActivePanel] = useState<SidePanelType | null>(null)
  const [settings, setSettings] = useState<BrowserSettings | null>(null)
  const [hoverUrl, setHoverUrl] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ---------- Proxy state ----------
  const [proxyEnabled, setProxyEnabled] = useState(false)
  const [showProxyMenu, setShowProxyMenu] = useState(false)
  const [quickProxyStatus, setQuickProxyStatus] = useState<ProxyStatus | null>(null)
  const [quickProxyGroups, setQuickProxyGroups] = useState<ProxyGroup[]>([])
  const [quickProxyNodes, setQuickProxyNodes] = useState<ProxyNode[]>([])
  const [selectedQuickProxyGroup, setSelectedQuickProxyGroup] = useState('')
  const [quickProxyDelayMap, setQuickProxyDelayMap] = useState<Record<string, number>>({})
  const [quickProxySubscriptionInput, setQuickProxySubscriptionInput] = useState('')
  const [quickProxyUpdating, setQuickProxyUpdating] = useState(false)
  const [quickProxyLogsVisible, setQuickProxyLogsVisible] = useState(false)
  const [quickProxyLogs, setQuickProxyLogs] = useState<string[]>([])

  // ---------- Quick Search states ----------
  const [quickSearchEngine, setQuickSearchEngine] = useState('google')
  const [quickSearchQuery, setQuickSearchQuery] = useState('')
  const [showEngineDropdown, setShowEngineDropdown] = useState(false)
  const [quickCustomName, setQuickCustomName] = useState('')
  const [quickCustomTemplate, setQuickCustomTemplate] = useState('')
  const quickSearchRef = useRef<HTMLInputElement>(null)
  const engineDropdownRef = useRef<HTMLDivElement>(null)
  const proxyMenuRef = useRef<HTMLDivElement>(null)
  const proxyButtonRef = useRef<HTMLButtonElement>(null)

  // ---------- Left Web Panel states ----------
  const [webPanels, setWebPanels] = useState<WebPanelItem[]>([])
  const [activePanelId, setActivePanelId] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [showAddPanelDialog, setShowAddPanelDialog] = useState(false)
  const [newPanelName, setNewPanelName] = useState('')
  const [newPanelUrl, setNewPanelUrl] = useState('')
  const [newPanelIcon, setNewPanelIcon] = useState('🌐')

  // ---------- Workspace / Vertical sidebar states ----------
  interface WorkspaceItem {
    id: string
    name: string
    icon: string
    color: string
    tabIds: string[]
    pinnedTabIds: string[]
    isDefault: boolean
  }
  const [tabLayoutState, setTabLayoutState] = useState<'horizontal' | 'vertical'>('horizontal')
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [autoCollapse, setAutoCollapse] = useState(true)
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false)
  const [showNewWorkspaceDialog, setShowNewWorkspaceDialog] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceIcon, setNewWorkspaceIcon] = useState('📁')
  const [newWorkspaceColor, setNewWorkspaceColor] = useState('#6366f1')
  const [toolbarActionPage, setToolbarActionPage] = useState<0 | 1>(0)
  const sidebarHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workspaceSyncingRef = useRef(false)

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [bookmarkQuery, setBookmarkQuery] = useState('')
  const [showFind, setShowFind] = useState(false)
  const [findText, setFindText] = useState('')
  const [findResult, setFindResult] = useState<{
    activeMatchOrdinal: number
    matches: number
  } | null>(null)
  const [toast, setToast] = useState<LocalToastMessage | null>(null)
  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)
  const [adBlockState, setAdBlockState] = useState<AdBlockState | null>(null)
  const [currentAdBlockSite, setCurrentAdBlockSite] = useState<AdBlockCurrentSite | null>(null)
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [showBookmarkBar, setShowBookmarkBar] = useState(true)
  const [enteringTabIds, setEnteringTabIds] = useState<Set<string>>(new Set())
  const [closingTabIds, setClosingTabIds] = useState<Set<string>>(new Set())
  const [loadedTabIds, setLoadedTabIds] = useState<Set<string>>(new Set())
  const [webDarkMode, setWebDarkMode] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [readerActive, setReaderActive] = useState(false)
  const [readerAvailable, setReaderAvailable] = useState(false)
  const [snifferCounts, setSnifferCounts] = useState<Record<number, number>>({})
  const [splitViewActive, setSplitViewActive] = useState(false)
  const [splitViewInput, setSplitViewInput] = useState('')
  const [previewTabId, setPreviewTabId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0
  })
  const [passwordSavePrompt, setPasswordSavePrompt] = useState<PasswordSavePrompt | null>(null)
  const [passwordFillPrompt, setPasswordFillPrompt] = useState<PasswordFillPrompt | null>(null)
  // Built-in Downloader tasks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [downloadTasks, setDownloadTasks] = useState<any[]>([])

  const addressBarWrapperRef = useRef<HTMLDivElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knownTabIdsRef = useRef<Set<string>>(new Set())
  const loadingTabIdsRef = useRef<Set<string>>(new Set())
  const tabCloseTimers = useRef<Map<string, number>>(new Map())
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeTab = browserState.tabs.find((t) => t.id === browserState.activeTabId)

  const showToast = useCallback((text: string, tone: ToastTone = 'success', duration = 2200) => {
    setToast({ id: `${Date.now()}`, text, duration, tone })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), duration)
  }, [])

  const collapseFullscreenUi = useCallback((): void => {
    setShowProxyMenu(false)
    setShowEngineDropdown(false)
    setActivePanel(null)
    setPanelVisible(false)
    setActivePanelId(null)
    window.api.hidePanel()
    window.api.webPanelHide().catch(() => {})
  }, [])

  const applySettingsSnapshot = useCallback((updated: BrowserSettings): void => {
    setSettings(updated)
    setQuickCustomName(updated.search.customEngine?.name || '')
    setQuickCustomTemplate(updated.search.customEngine?.urlTemplate || '')
    setQuickProxySubscriptionInput(updated.proxy.subscriptionUrl)
    setProxyEnabled(updated.proxy.enabled)
  }, [])

  // Keep async bookmark actions pointed at the latest active tab.
  const activeTabRef = useRef(activeTab)
  // ---------- Effects ----------
  useLayoutEffect(() => {
    // Load quick search engine preference
    window.api
      .quickSearchGetEngine()
      .then((engine: string) => {
        setQuickSearchEngine(engine)
      })
      .catch(() => {})

    // Load web panels
    window.api
      .webPanelGetAll()
      .then((panels: WebPanelItem[]) => {
        setWebPanels(panels)
      })
      .catch(() => {})

    // Load workspace state
    window.api
      .workspaceGetState()
      .then((s) => {
        if (!s) return
        setTabLayoutState(s.tabLayout)
        setWorkspaces(s.workspaces as WorkspaceItem[])
        setActiveWorkspaceId(s.activeWorkspaceId)
        setSidebarCollapsed(s.sidebarCollapsed)
        setSidebarWidth(s.sidebarWidth)
        setAutoCollapse(s.autoCollapse)
      })
      .catch(() => {})

    // Load proxy status
    window.api
      .proxyStatus()
      .then((status: ProxyStatus) => {
        setProxyEnabled(status.enabled)
        setQuickProxyStatus(status)
      })
      .catch(() => {})

    window.api
      .isFullscreen()
      .then((fullscreen) => {
        setIsFullscreen(fullscreen)
        if (fullscreen) {
          collapseFullscreenUi()
        }
      })
      .catch(() => {})
    const unsubscribeFullscreen = window.api.onFullscreenChanged((fullscreen) => {
      setIsFullscreen(fullscreen)
      if (fullscreen) {
        collapseFullscreenUi()
      }
    })

    // Close floating menus on outside click
    const handleClickOutside = (e: MouseEvent): void => {
      const target = e.target as HTMLElement | null
      if (engineDropdownRef.current && !engineDropdownRef.current.contains(target as Node)) {
        setShowEngineDropdown(false)
      }
      if (!target) return
      // Workspace dialog: clicks inside the dialog or its overlay must not
      // bubble up into the proxy-menu auto-close path.
      if (target.closest('.ws-dialog-overlay') || target.closest('.ws-dialog')) return
      // Proxy menu: keep open for clicks on the trigger or the menu itself.
      if (target.closest('.proxy-btn') || target.closest('.proxy-control')) return
      if (target.closest('.proxy-menu')) return
      setShowProxyMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      unsubscribeFullscreen()
    }
  }, [collapseFullscreenUi])

  // ---------- Quick Search handlers ----------
  const handleQuickSearchEngineChange = async (engineId: string): Promise<void> => {
    setQuickSearchEngine(engineId)
    if (engineId !== 'custom') {
      setShowEngineDropdown(false)
    }
    await window.api.quickSearchSetEngine(engineId)
  }

  const handleSaveQuickCustomEngine = async (): Promise<void> => {
    const name = quickCustomName.trim() || '自定义'
    const urlTemplate = quickCustomTemplate.trim()
    if (!urlTemplate || !hasSearchPlaceholder(urlTemplate)) {
      showToast('自定义搜索地址需要包含 {query} 或 %s', 'error')
      return
    }
    const updated = await window.api.updateSettings({
      search: {
        customEngine: {
          name,
          urlTemplate
        }
      }
    })
    setSettings(updated)
    setQuickSearchEngine('custom')
    await window.api.quickSearchSetEngine('custom')
    setShowEngineDropdown(false)
    showToast('自定义搜索已保存')
  }

  const handleQuickSearch = (): void => {
    const query = quickSearchQuery.trim()
    if (!query) return
    const engine = quickSearchEngines.find((e) => e.id === quickSearchEngine)
    if (!engine) return
    if (!engine.urlTemplate || !hasSearchPlaceholder(engine.urlTemplate)) {
      setShowEngineDropdown(true)
      showToast('先设置自定义搜索地址', 'error')
      return
    }
    const url = buildQuickSearchUrl(engine.urlTemplate, query)
    setInputUrl(url)
    if (activeTab) {
      window.api.loadUrl(activeTab.id, url)
    }
    setQuickSearchQuery('')
    quickSearchRef.current?.blur()
  }

  const handleQuickSearchKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleQuickSearch()
    }
  }

  // ---------- Proxy menu handlers ----------
  const loadQuickProxyState = async (preferredGroup?: string): Promise<void> => {
    const [status, groups] = await Promise.all([
      window.api.proxyStatus(),
      window.api.proxyGetGroups()
    ])
    setQuickProxyStatus(status)
    setQuickProxyGroups(groups)
    setProxyEnabled(status.enabled)

    const nextGroup = preferredGroup || selectedQuickProxyGroup || groups[0]?.name || ''
    setSelectedQuickProxyGroup(nextGroup)
    if (nextGroup) {
      const nodes = await window.api.proxyGetNodes(nextGroup)
      setQuickProxyNodes(nodes)
    } else {
      setQuickProxyNodes([])
    }
  }

  const handleProxyButtonClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    setShowProxyMenu((prev) => {
      if (!prev) loadQuickProxyState().catch(console.error)
      return !prev
    })
  }

  const handleProxyButtonMouseDown = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
  }

  const handleProxyMenuMouseEvent = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.stopPropagation()
  }

  const handleQuickProxyToggle = async (enabled: boolean): Promise<void> => {
    const result = await window.api.proxyToggle(enabled)
    if (result.success) {
      const updated = await window.api.getSettings()
      applySettingsSnapshot(updated)
      await loadQuickProxyState()
      showToast(enabled ? '代理已启用' : '代理已关闭')
    } else {
      showToast(result.error || '代理切换失败', 'error')
    }
  }

  const handleQuickProxySettingsUpdate = async (
    patch: Partial<BrowserSettings['proxy']>
  ): Promise<void> => {
    const updated = await window.api.updateSettings({ proxy: patch })
    applySettingsSnapshot(updated)
    showToast('已保存')
  }

  const handleQuickProxySubscriptionUpdate = async (): Promise<void> => {
    const url = quickProxySubscriptionInput.trim()
    if (!url) {
      showToast('先填订阅链接', 'error')
      return
    }
    setQuickProxyUpdating(true)
    try {
      const result = await window.api.proxyUpdateSubscription(url)
      if (result.success) {
        const updated = await window.api.getSettings()
        applySettingsSnapshot(updated)
        await loadQuickProxyState()
        showToast(`订阅已更新，共 ${result.nodeCount || 0} 个节点`)
      } else {
        showToast(result.error || '订阅更新失败', 'error')
      }
    } finally {
      setQuickProxyUpdating(false)
    }
  }

  const handleQuickProxyGroupChange = async (group: string): Promise<void> => {
    setSelectedQuickProxyGroup(group)
    if (!group) {
      setQuickProxyNodes([])
      return
    }
    const nodes = await window.api.proxyGetNodes(group)
    setQuickProxyNodes(nodes)
  }

  const handleQuickProxyTestAll = async (): Promise<void> => {
    if (!selectedQuickProxyGroup) return
    const result = await window.api.proxyTestAllDelay(selectedQuickProxyGroup)
    setQuickProxyDelayMap(result)
    await handleQuickProxyGroupChange(selectedQuickProxyGroup)
  }

  const handleQuickProxySwitch = async (node: string): Promise<void> => {
    if (!selectedQuickProxyGroup) return
    const result = await window.api.proxySwitch(selectedQuickProxyGroup, node)
    if (result.success) {
      await loadQuickProxyState(selectedQuickProxyGroup)
      showToast('节点已切换')
    } else {
      showToast('节点切换失败', 'error')
    }
  }

  const handleQuickProxyLogs = async (): Promise<void> => {
    const logs = await window.api.proxyGetLogs()
    setQuickProxyLogs(logs)
    setQuickProxyLogsVisible((visible) => !visible)
  }

  const handleFullscreenToggle = async (): Promise<void> => {
    const fullscreen = await window.api.toggleFullscreen()
    setIsFullscreen(fullscreen)
    if (fullscreen) {
      collapseFullscreenUi()
    }
  }

  // ---------- Web Panel handlers ----------
  const handlePanelToggle = async (id: string): Promise<void> => {
    const result = await window.api.webPanelToggle(id)
    setPanelVisible(result.visible)
    setActivePanelId(result.activeId)
  }

  const handleAddPanel = async (): Promise<void> => {
    if (!newPanelName.trim() || !newPanelUrl.trim()) return
    let url = newPanelUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    const newPanel = await window.api.webPanelAdd({
      name: newPanelName.trim(),
      url,
      icon: newPanelIcon
    })
    setWebPanels((prev) => [...prev, newPanel])
    setNewPanelName('')
    setNewPanelUrl('')
    setNewPanelIcon('🌐')
    setShowAddPanelDialog(false)
  }

  const handleRemovePanel = async (id: string): Promise<void> => {
    await window.api.webPanelRemove(id)
    setWebPanels((prev) => prev.filter((p) => p.id !== id))
    if (activePanelId === id) {
      setActivePanelId(null)
      setPanelVisible(false)
    }
  }

  // ---------- Workspace handlers ----------
  const handleToggleTabLayout = async (): Promise<void> => {
    const next = tabLayoutState === 'horizontal' ? 'vertical' : 'horizontal'
    setTabLayoutState(next)
    setToolbarActionPage(0)
    await window.api.workspaceSetLayout(next)
  }

  const handleSwitchWorkspace = async (id: string): Promise<void> => {
    setActiveWorkspaceId(id)
    await window.api.workspaceSwitch(id)
    const workspace = workspaces.find((item) => item.id === id)
    const targetTab = browserState.tabs.find((tab) => workspace?.tabIds.includes(tab.id))
    if (targetTab) {
      handleSwitchTab(targetTab.id)
    } else {
      handleNewTab()
    }
  }

  const handleAddWorkspace = async (): Promise<void> => {
    const name = newWorkspaceName.trim() || '新工作区'
    const result = await window.api.workspaceAdd({
      name,
      icon: newWorkspaceIcon,
      color: newWorkspaceColor
    })
    if (result.success && result.id) {
      const fresh = await window.api.workspaceGetAll()
      setWorkspaces(fresh as WorkspaceItem[])
      setActiveWorkspaceId(result.id)
      await window.api.workspaceSwitch(result.id)
    }
    setNewWorkspaceName('')
    setNewWorkspaceIcon('📁')
    setNewWorkspaceColor('#6366f1')
    setShowNewWorkspaceDialog(false)
  }

  const handleRemoveWorkspace = async (id: string): Promise<void> => {
    if (id === 'default') return
    if (!confirm('删除该工作区？其中的标签页设置也会移除')) return
    const r = await window.api.workspaceRemove(id)
    if (r.success) {
      const fresh = await window.api.workspaceGetAll()
      setWorkspaces(fresh as WorkspaceItem[])
      if (activeWorkspaceId === id) setActiveWorkspaceId('default')
    }
  }

  const handleSidebarMouseEnter = (): void => {
    if (sidebarHoverTimerRef.current) {
      clearTimeout(sidebarHoverTimerRef.current)
      sidebarHoverTimerRef.current = null
    }
    setIsHoveringSidebar(true)
    if (autoCollapse && sidebarCollapsed) {
      setSidebarCollapsed(false)
      window.api.workspaceSetSidebarCollapsed(false).catch(() => {})
    }
  }

  const handleSidebarMouseLeave = (): void => {
    if (!autoCollapse) return
    if (sidebarHoverTimerRef.current) clearTimeout(sidebarHoverTimerRef.current)
    sidebarHoverTimerRef.current = setTimeout(() => {
      setIsHoveringSidebar(false)
      setSidebarCollapsed(true)
      window.api.workspaceSetSidebarCollapsed(true).catch(() => {})
    }, 300)
  }

  const handleToggleAutoCollapse = async (): Promise<void> => {
    const next = !autoCollapse
    const nextCollapsed = next
    setAutoCollapse(next)
    setSidebarCollapsed(nextCollapsed)
    await window.api.workspaceSetAutoCollapse(next)
    await window.api.workspaceSetSidebarCollapsed(nextCollapsed)
  }

  const quickSearchEngines = getQuickSearchEngines(settings)
  const currentEngine =
    quickSearchEngines.find((e) => e.id === quickSearchEngine) || quickSearchEngines[0]

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    if (workspaceSyncingRef.current || workspaces.length === 0 || browserState.tabs.length === 0) {
      return
    }

    const syncWorkspaces = async (): Promise<void> => {
      workspaceSyncingRef.current = true
      try {
        const liveTabIds = new Set(browserState.tabs.map((tab) => tab.id))
        const assignedTabIds = new Set(workspaces.flatMap((workspace) => workspace.tabIds))
        const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId)
        const targetWorkspaceId = activeWorkspace?.id ?? 'default'
        let changed = false

        for (const tab of browserState.tabs) {
          if (!assignedTabIds.has(tab.id)) {
            await window.api.workspaceAddTab(targetWorkspaceId, tab.id)
            changed = true
          }
        }

        for (const workspace of workspaces) {
          for (const tabId of workspace.tabIds) {
            if (!liveTabIds.has(tabId)) {
              await window.api.workspaceRemoveTab(workspace.id, tabId)
              changed = true
            }
          }
        }

        if (changed) {
          const fresh = await window.api.workspaceGetAll()
          setWorkspaces(fresh as WorkspaceItem[])
        }
      } finally {
        workspaceSyncingRef.current = false
      }
    }

    syncWorkspaces().catch(() => {
      workspaceSyncingRef.current = false
    })
  }, [activeWorkspaceId, browserState.tabs, workspaces])

  useEffect(() => {
    const previousIds = knownTabIdsRef.current
    const previousLoadingIds = loadingTabIdsRef.current
    const currentIds = new Set(browserState.tabs.map((tab) => tab.id))
    const currentLoadingIds = new Set(
      browserState.tabs.filter((tab) => tab.isLoading).map((tab) => tab.id)
    )
    const isInitialSync = previousIds.size === 0

    if (!isInitialSync) {
      const nextEnteringIds = browserState.tabs
        .map((tab) => tab.id)
        .filter((tabId) => !previousIds.has(tabId))

      if (nextEnteringIds.length > 0) {
        setEnteringTabIds((current) => {
          const next = new Set(current)
          nextEnteringIds.forEach((tabId) => next.add(tabId))
          return next
        })
        nextEnteringIds.forEach((tabId) => {
          window.setTimeout(() => {
            setEnteringTabIds((current) => {
              const next = new Set(current)
              next.delete(tabId)
              return next
            })
          }, 320)
        })
      }
    }

    const nextLoadedIds = browserState.tabs
      .map((tab) => tab.id)
      .filter((tabId) => previousLoadingIds.has(tabId) && !currentLoadingIds.has(tabId))

    if (nextLoadedIds.length > 0) {
      setLoadedTabIds((current) => {
        const next = new Set(current)
        nextLoadedIds.forEach((tabId) => next.add(tabId))
        return next
      })
      nextLoadedIds.forEach((tabId) => {
        window.setTimeout(() => {
          setLoadedTabIds((current) => {
            const next = new Set(current)
            next.delete(tabId)
            return next
          })
        }, 340)
      })
    }

    setClosingTabIds((current) => {
      if ([...current].every((tabId) => currentIds.has(tabId))) return current
      const next = new Set([...current].filter((tabId) => currentIds.has(tabId)))
      return next
    })

    knownTabIdsRef.current = currentIds
    loadingTabIdsRef.current = currentLoadingIds
  }, [browserState.tabs])

  useEffect(() => {
    const timers = tabCloseTimers.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const openPanel = useCallback((panel: SidePanelType): void => {
    setActivePanel(panel)
  }, [])

  const closePanel = useCallback((): void => {
    setActivePanel(null)
  }, [])

  const togglePanel = useCallback((panel: SidePanelType): void => {
    setActivePanel((current) => (current === panel ? null : panel))
  }, [])

  const openAIPanel = useCallback((): void => {
    openPanel('ai')
  }, [openPanel])

  const toggleAIPanel = useCallback((): void => {
    togglePanel('ai')
  }, [togglePanel])

  const loadPanelData = useCallback(
    (panel: SidePanelType): void => {
      if (panel === 'bookmarks') {
        window.api.getBookmarks().then(setBookmarks).catch(console.error)
      } else if (panel === 'history') {
        window.api.getHistory(200).then(setHistoryItems).catch(console.error)
      } else if (panel === 'settings') {
        window.api.getSettings().then(applySettingsSnapshot).catch(console.error)
      }
    },
    [applySettingsSnapshot]
  )

  const handleToggleBookmark = useCallback(async () => {
    const tab = activeTabRef.current
    if (!tab || tab.isNewTab) return
    const bms = await window.api.getBookmarks()
    const exists = bms.some((b: BookmarkItem) => b.url === tab.url)
    if (exists) {
      await window.api.removeBookmark(tab.url)
      showToast('书签已删除')
    } else {
      await window.api.addBookmark(tab.url, tab.title, tab.favicon)
      showToast('已收藏')
    }
    const updated = await window.api.getBookmarks()
    setBookmarks(updated)
  }, [showToast])

  const handleToggleBookmarkBar = useCallback(async () => {
    const visible = await window.api.toggleBookmarkBar()
    setShowBookmarkBar(visible)
  }, [])

  const handleToggleDarkMode = useCallback(async () => {
    const newState = await window.api.toggleDarkMode()
    setWebDarkMode(newState)
  }, [])

  const handleToggleTranslate = useCallback(async () => {
    const newState = !isTranslating
    setIsTranslating(newState)
    try {
      await window.api.translatePage(newState)
      showToast(newState ? '沉浸式翻译已开启' : '沉浸式翻译已关闭')
    } catch {
      setIsTranslating(!newState)
      showToast('翻译失败', 'error')
    }
  }, [isTranslating, showToast])

  const handleToggleReader = useCallback(async () => {
    if (readerActive) {
      await window.api.readerExit()
      setReaderActive(false)
      return
    }

    const result = await window.api.readerEnter()
    if (result.success) {
      setReaderActive(true)
    } else {
      showToast(result.error || '当前页面不适合阅读模式', 'error')
    }
  }, [readerActive, showToast])

  const handleTabMouseEnter = useCallback((tab: TabState, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    setPreviewPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 8 })

    previewTimerRef.current = setTimeout(async () => {
      const image = await window.api.tabPreviewCapture(tab.webContentsId)
      if (image) {
        setPreviewTabId(tab.id)
        setPreviewImage(image)
      }
    }, 400)
  }, [])

  const handleTabMouseLeave = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current)
      previewTimerRef.current = null
    }
    setPreviewTabId(null)
    setPreviewImage(null)
  }, [])

  const handleSplitViewOpen = useCallback(
    async (url?: string) => {
      const targetUrl = url || splitViewInput.trim() || activeTab?.url || 'about:blank'
      let finalUrl = targetUrl
      if (
        !finalUrl.startsWith('http://') &&
        !finalUrl.startsWith('https://') &&
        finalUrl !== 'about:blank'
      ) {
        finalUrl = `https://${finalUrl}`
      }
      const result = await window.api.splitViewOpen(finalUrl)
      if (result.success) {
        setSplitViewActive(true)
        setSplitViewInput('')
      }
    },
    [activeTab?.url, splitViewInput]
  )

  const handleSplitViewClose = useCallback(async () => {
    await window.api.splitViewClose()
    setSplitViewActive(false)
  }, [])

  const handleSaveDetectedPassword = useCallback(async (): Promise<void> => {
    if (!passwordSavePrompt) return
    await window.api.passwordAutoSave({
      url: passwordSavePrompt.url,
      username: passwordSavePrompt.username,
      password: passwordSavePrompt.password,
      title: activeTab?.title || passwordSavePrompt.url
    })
    setPasswordSavePrompt(null)
    showToast(passwordSavePrompt.existing ? '密码已更新' : '密码已保存')
  }, [activeTab?.title, passwordSavePrompt, showToast])

  const handleFillDetectedPassword = useCallback(
    async (id: string): Promise<void> => {
      if (!passwordFillPrompt) return
      const result = await window.api.passwordAutoFill(id, passwordFillPrompt.webContentsId)
      setPasswordFillPrompt(null)
      showToast(result.success ? '已填充密码' : '密码填充失败', result.success ? 'success' : 'error')
    },
    [passwordFillPrompt, showToast]
  )

  // Initial load — get state synchronously on mount so tab bar appears immediately
  useEffect(() => {
    window.api.getBrowserState().then((state: BrowserState) => {
      setBrowserState(state)
    })
    window.api.getBookmarks().then(setBookmarks)
    window.api.getBookmarkBarVisible().then(setShowBookmarkBar)
    window.api.getSettings().then((loaded) => {
      applySettingsSnapshot(loaded)
      setWebDarkMode(loaded.webDarkMode)
    })
    window.api.getDarkMode().then(setWebDarkMode)
    window.api.getAdBlockState().then(setAdBlockState).catch(console.error)
    window.api.getCurrentSiteForAdBlock().then(setCurrentAdBlockSite).catch(console.error)
    window.api
      .splitViewGetState()
      .then((state) => setSplitViewActive(state.active))
      .catch(console.error)
  }, [applySettingsSnapshot])

  // === Built-in Downloader Init & Handlers ===
  useEffect(() => {
    async function loadDownloadTasks(): Promise<void> {
      try {
        const list = await window.api.builtinDownloadGetList()
        setDownloadTasks(list)
      } catch {
        /* ignore */
      }
    }
    loadDownloadTasks()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsub = window.api.onDownloadProgress((progress: any) => {
      setDownloadTasks((prev) =>
        prev.map((t) => (t.id === progress.id ? { ...t, ...progress } : t))
      )
    })
    return unsub
  }, [])

  async function loadDownloadTasks(): Promise<void> {
    try {
      const list = await window.api.builtinDownloadGetList()
      setDownloadTasks(list)
    } catch {
      /* ignore */
    }
  }

  async function handleDownloadPause(id: string): Promise<void> {
    await window.api.builtinDownloadPause(id)
    loadDownloadTasks()
  }

  async function handleDownloadResume(id: string): Promise<void> {
    await window.api.builtinDownloadResume(id)
    loadDownloadTasks()
  }

  async function handleDownloadCancel(id: string): Promise<void> {
    await window.api.builtinDownloadCancel(id)
    loadDownloadTasks()
  }

  async function handleDownloadRemove(id: string): Promise<void> {
    await window.api.builtinDownloadRemove(id)
    loadDownloadTasks()
  }

  async function handleDownloadOpenFile(id: string): Promise<void> {
    await window.api.builtinDownloadOpenFile(id)
  }

  async function handleDownloadOpenFolder(id: string): Promise<void> {
    await window.api.builtinDownloadOpenFolder(id)
  }

  async function handleDownloadClearCompleted(): Promise<void> {
    await window.api.builtinDownloadClearCompleted()
    loadDownloadTasks()
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
  }

  function formatSpeed(bytesPerSec: number): string {
    return formatSize(bytesPerSec) + '/s'
  }

  useEffect(() => {
    return applyAppearance(settings)
  }, [settings])

  // Listeners
  useEffect(() => {
    const unsub1 = window.api.onBrowserState((state: BrowserState) => setBrowserState(state))
    const unsub2 = window.api.onFocusAddressBar(() => {
      urlInputRef.current?.focus()
      urlInputRef.current?.select()
    })
    const unsub3 = window.api.onFocusFind(() => {
      setShowFind(true)
      setTimeout(() => {
        findInputRef.current?.focus()
        findInputRef.current?.select()
      }, 50)
    })
    const unsub4 = window.api.onToggleBookmark(() => {
      handleToggleBookmark()
    })
    const unsub5 = window.api.onFindResult((result) => setFindResult(result))
    const unsub6 = window.api.onDownloadUpdate(() => openPanel('downloads'))
    const unsub7 = window.api.onToast((msg: ToastMessage) => {
      setToast(msg)
      if (msg.duration > 0) {
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), msg.duration)
      }
    })

    const unsub8 = window.api.onOpenHistoryPanel(() => openPanel('history'))
    const unsub9 = window.api.onOpenDownloadsPanel(() => openPanel('downloads'))
    const unsub10 = window.api.onPanelClosed(() => {
      closePanel()
    })
    const unsub11 = window.api.onOpenBookmarksPanel(() => openPanel('bookmarks'))
    const unsub12 = window.api.onOpenSettingsPanel(() => openPanel('settings'))
    const unsub13 = window.api.onOpenAboutPanel(() => openPanel('about'))
    const unsub14 = window.api.onAddBookmark(() => {
      handleToggleBookmark()
    })
    const unsub15 = window.api.onSettings((updated) => {
      applySettingsSnapshot(updated)
      setWebDarkMode(updated.webDarkMode)
    })
    const unsub16 = window.api.onDownloadCompleted((item: DownloadItem) => {
      showToast(`下载完成：${item.filename}`, 'success')
    })
    const unsub17 = window.api.onHoverUrl((url) => setHoverUrl(typeof url === 'string' ? url : ''))
    const unsub18 = window.api.onAdBlockStateChanged((state: AdBlockState) => {
      setAdBlockState(state)
      window.api.getCurrentSiteForAdBlock().then(setCurrentAdBlockSite).catch(console.error)
    })
    const unsub19 = window.api.onOpenAIPanel(openAIPanel)
    const unsub20 = window.api.onToggleAIPanel(toggleAIPanel)
    const unsub21 = window.api.onOpenPanel((panel) => {
      if (isSidePanelType(panel)) {
        openPanel(panel)
      }
    })
    const unsub22 = window.api.onBookmarkBarChanged((visible) => {
      setShowBookmarkBar(visible)
    })
    const unsub23 = window.api.onBookmarksChanged((updatedBookmarks) => {
      setBookmarks(updatedBookmarks)
    })
    const unsub24 = window.api.onResourceFound((data) => {
      setSnifferCounts((current) => ({ ...current, [data.tabId]: data.count }))
    })
    const unsub25 = window.api.onPasswordSavePrompt((data) => {
      setPasswordSavePrompt(data)
    })
    const unsub26 = window.api.onPasswordFillPrompt((data) => {
      setPasswordFillPrompt(data)
    })

    return () => {
      unsub1()
      unsub2()
      unsub3()
      unsub4()
      unsub5()
      unsub6()
      unsub7()
      unsub8()
      unsub9()
      unsub10()
      unsub11()
      unsub12()
      unsub13()
      unsub14()
      unsub15()
      unsub16()
      unsub17()
      unsub18()
      unsub19()
      unsub20()
      unsub21()
      unsub22()
      unsub23()
      unsub24()
      unsub25()
      unsub26()
    }
  }, [
    applySettingsSnapshot,
    closePanel,
    handleToggleBookmark,
    openAIPanel,
    openPanel,
    showToast,
    toggleAIPanel
  ])

  const appearanceDensity = settings?.appearance.density

  useEffect(() => {
    if (activePanel) {
      loadPanelData(activePanel)
    }
  }, [activePanel, loadPanelData])

  // Dynamic layout: chrome/page positioning is independent from side-panel visibility.
  useEffect(() => {
    const densityValues = appearanceDensity ? DENSITY_VALUES[appearanceDensity] : null
    const baseChromeHeight =
      tabLayoutState === 'vertical'
        ? densityValues?.toolbar ?? DENSITY_VALUES.normal.toolbar
        : densityValues?.chrome ?? TOP_CHROME_HEIGHT
    const chromeHeight = scaleUiSize(baseChromeHeight)
    const fullscreenButtonSize = scaleUiSize(
      appearanceDensity ? DENSITY_VALUES[appearanceDensity].tab : DENSITY_VALUES.normal.tab
    )

    if (isFullscreen) {
      window.api.setLayout({
        uiViewHeight: fullscreenButtonSize,
        uiViewWidth: fullscreenButtonSize,
        pageTop: 0
      })
      window.api.hidePanel()
      return
    }

    const bookmarkBarHeight = showBookmarkBar ? scaleUiSize(BOOKMARK_BAR_HEIGHT) : 0
    const floatingMenuHeight = showProxyMenu
      ? PROXY_MENU_HEIGHT
      : showEngineDropdown
        ? scaleUiSize(FLOATING_MENU_HEIGHT)
        : 0
    const pageTop =
      chromeHeight +
      bookmarkBarHeight +
      (showFind ? scaleUiSize(FIND_BAR_HEIGHT) : 0) +
      (activeTab?.error ? scaleUiSize(ERROR_BAR_HEIGHT) : 0)
    const uiViewHeight =
      tabLayoutState === 'vertical' ? 100000 : pageTop + floatingMenuHeight

    window.api.setLayout({
      uiViewHeight,
      uiViewWidth: null,
      pageTop
    })

    if (activePanel) {
      window.api.showPanel(activePanel)
    } else {
      window.api.hidePanel()
    }
  }, [
    isFullscreen,
    showBookmarkBar,
    showFind,
    activeTab?.id,
    activeTab?.error,
    appearanceDensity,
    activePanel,
    showEngineDropdown,
    showProxyMenu,
    tabLayoutState
  ])

  useEffect(() => {
    window.api.getCurrentSiteForAdBlock().then(setCurrentAdBlockSite).catch(console.error)
  }, [activeTab?.id, activeTab?.url])

  useEffect(() => {
    Promise.resolve().then(() => setReaderActive(false))
    window.api
      .readerCanExtract()
      .then(setReaderAvailable)
      .catch(() => setReaderAvailable(false))
    if (activeTab?.webContentsId) {
      window.api
        .snifferGetResourcesForTab(activeTab.webContentsId)
        .then((resources) => {
          setSnifferCounts((current) => ({
            ...current,
            [activeTab.webContentsId]: resources.length
          }))
        })
        .catch(() => {})
    }
  }, [activeTab?.id, activeTab?.url, activeTab?.webContentsId])

  // Sync address bar
  const [prevActiveTabId, setPrevActiveTabId] = useState<string | undefined>(undefined)
  const [prevActiveTabUrl, setPrevActiveTabUrl] = useState<string | undefined>(undefined)
  const [prevActiveTabIsNew, setPrevActiveTabIsNew] = useState<boolean | undefined>(undefined)
  if (
    activeTab &&
    (activeTab.id !== prevActiveTabId ||
      (!isEditingAddress && activeTab.url !== prevActiveTabUrl) ||
      activeTab.isNewTab !== prevActiveTabIsNew)
  ) {
    setPrevActiveTabId(activeTab.id)
    setPrevActiveTabUrl(activeTab.url)
    setPrevActiveTabIsNew(activeTab.isNewTab)
    setInputUrl(activeTab.isNewTab ? '' : activeTab.url)
  }

  // Handlers
  function triggerAddressRipple(): void {
    const wrapper = addressBarWrapperRef.current
    if (!wrapper) return
    wrapper.classList.remove('ripple')
    void wrapper.offsetWidth
    wrapper.classList.add('ripple')
    window.setTimeout(() => wrapper.classList.remove('ripple'), 550)
  }

  function handleNavigate(): void {
    if (!activeTab) return
    const trimmed = inputUrl.trim()
    if (!trimmed) return
    triggerAddressRipple()
    window.api.loadUrl(activeTab.id, trimmed)
    setIsEditingAddress(false)
    urlInputRef.current?.blur()
  }

  function handleUrlKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') handleNavigate()
    else if (e.key === 'Escape') {
      if (activeTab) setInputUrl(activeTab.isNewTab ? '' : activeTab.url)
      setIsEditingAddress(false)
      urlInputRef.current?.blur()
    }
  }

  function handleNewTab(): void {
    window.api.createTab()
  }

  const handleNewIncognitoTab = useCallback((): void => {
    window.api.incognitoNewTab().catch(() => showToast('无痕标签页创建失败', 'error'))
  }, [showToast])

  function handleCloseTab(tabId: string, e?: React.MouseEvent): void {
    if (e) e.stopPropagation()
    if (closingTabIds.has(tabId)) return
    setClosingTabIds((current) => {
      const next = new Set(current)
      next.add(tabId)
      return next
    })
    const timer = window.setTimeout(() => {
      tabCloseTimers.current.delete(tabId)
      window.api.closeTab(tabId)
    }, 220)
    tabCloseTimers.current.set(tabId, timer)
  }
  function handleSwitchTab(tabId: string): void {
    window.api.switchTab(tabId)
  }
  function handleTabMouseDown(tabId: string, e: React.MouseEvent): void {
    if (e.button === 1) {
      e.preventDefault()
      handleCloseTab(tabId, e)
    }
  }
  function handleTabContextMenu(tabId: string, e: React.MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    window.api.tabContextMenu(tabId).catch(console.error)
  }

  function handleDragStart(tabId: string, e: React.DragEvent): void {
    setDragTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tabId)
  }
  function handleDragOver(tabId: string, e: React.DragEvent): void {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragTabId && tabId !== dragTabId) setDragOverTabId(tabId)
  }
  function handleDragLeave(): void {
    setDragOverTabId(null)
  }
  function handleDrop(targetTabId: string, e: React.DragEvent): void {
    e.preventDefault()
    setDragOverTabId(null)
    if (!dragTabId || dragTabId === targetTabId) {
      setDragTabId(null)
      return
    }
    const targetIndex = browserState.tabs.findIndex((t) => t.id === targetTabId)
    if (targetIndex !== -1) window.api.moveTab(dragTabId, targetIndex)
    setDragTabId(null)
  }
  function handleDragEnd(): void {
    setDragTabId(null)
    setDragOverTabId(null)
  }

  async function handleShowBookmarks(): Promise<void> {
    const bms = await window.api.getBookmarks()
    setBookmarks(bms)
    togglePanel('bookmarks')
  }

  async function handleShowHistory(): Promise<void> {
    const items = await window.api.getHistory(200)
    setHistoryItems(items)
    togglePanel('history')
  }

  function handleShowDownloads(): void {
    togglePanel('downloads')
  }
  function handleShowScripts(): void {
    togglePanel('scripts')
  }
  function handleShowSniffer(): void {
    togglePanel('sniffer')
  }
  function handleShowWebPanel(): void {
    togglePanel('webpanel')
  }
  function handleShowSettings(): void {
    togglePanel('settings')
  }

  function handleShowAI(): void {
    toggleAIPanel()
  }

  async function handleAdBlockQuickToggle(): Promise<void> {
    const nextEnabled = !(adBlockState?.enabled ?? false)
    const nextState = await window.api.setAdBlockEnabled(nextEnabled)
    if (nextState) {
      setAdBlockState(nextState)
      setSettings((current) => (current ? { ...current, adblock: nextState } : current))
    }
    window.api.getCurrentSiteForAdBlock().then(setCurrentAdBlockSite).catch(console.error)
    showToast(nextEnabled ? '已启用 AdBlock Zhi' : '已关闭 AdBlock Zhi')
  }

  function handleOpenBookmark(url: string): void {
    window.api.openUrl(url, false)
    closePanel()
  }
  function handleOpenBookmarkFromBar(url: string): void {
    window.api.openUrl(url, false)
  }
  function handleOpenHistory(url: string): void {
    window.api.openUrl(url, false)
    closePanel()
  }

  async function handleDeleteBookmark(url: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.removeBookmark(url)
    const updated = await window.api.getBookmarks()
    setBookmarks(updated)
  }

  async function handleClearHistory(): Promise<void> {
    await window.api.clearHistory()
    setHistoryItems([])
  }

  function handleFindKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      if (!activeTab) return
      if (e.shiftKey) window.api.findNext(activeTab.id, false)
      else if (findText) window.api.findStart(activeTab.id, findText)
    } else if (e.key === 'Escape') handleCloseFind()
  }

  function handleFindChange(text: string): void {
    setFindText(text)
    if (activeTab && text) window.api.findStart(activeTab.id, text)
  }

  function handleCloseFind(): void {
    if (activeTab) window.api.findStop(activeTab.id, 'clearSelection')
    setShowFind(false)
    setFindText('')
    setFindResult(null)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && key === 'i') {
        e.preventDefault()
        toggleAIPanel()
      } else if (ctrl && key === 'l') {
        e.preventDefault()
        urlInputRef.current?.focus()
        urlInputRef.current?.select()
      } else if (ctrl && key === 'f') {
        e.preventDefault()
        setShowFind(true)
        setTimeout(() => {
          findInputRef.current?.focus()
          findInputRef.current?.select()
        }, 50)
      } else if (ctrl && key === 'd') {
        e.preventDefault()
        handleToggleBookmark()
      } else if (ctrl && e.shiftKey && key === 'n') {
        e.preventDefault()
        handleNewIncognitoTab()
      } else if (ctrl && key === 'h') {
        e.preventDefault()
        openPanel('history')
      } else if (ctrl && key === 'j') {
        e.preventDefault()
        openPanel('downloads')
      } else if (ctrl && key === ',') {
        e.preventDefault()
        openPanel('settings')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewIncognitoTab, handleToggleBookmark, openPanel, toggleAIPanel])

  const isCurrentBookmarked = bookmarks.some((b) => activeTab && b.url === activeTab.url)
  const activeSnifferCount = activeTab?.webContentsId
    ? snifferCounts[activeTab.webContentsId] || 0
    : 0
  const currentAdBlockHostname = currentAdBlockSite?.hostname || ''
  const isCurrentAdBlockWhitelisted = Boolean(
    currentAdBlockHostname && adBlockState?.whitelist.includes(currentAdBlockHostname)
  )
  const filteredBookmarks = bookmarkQuery
    ? bookmarks.filter(
        (b) =>
          b.url.toLowerCase().includes(bookmarkQuery.toLowerCase()) ||
          b.title.toLowerCase().includes(bookmarkQuery.toLowerCase())
      )
    : bookmarks
  const filteredHistory = historyQuery
    ? historyItems.filter(
        (h) =>
          h.url.toLowerCase().includes(historyQuery.toLowerCase()) ||
          h.title.toLowerCase().includes(historyQuery.toLowerCase())
      )
    : historyItems
  const tabLayout = tabLayoutState
  const hasWebPanelShortcuts = webPanels.length > 0
  const sidebarPixels = tabLayout === 'vertical'
    ? sidebarCollapsed && !isHoveringSidebar
      ? 48
      : sidebarWidth
    : 0

  return (
    <div
      className={`browser-root browser-layout-${tabLayout} ${hasWebPanelShortcuts ? 'browser-has-web-panels' : ''} ${showBookmarkBar && !isFullscreen ? 'browser-bookmark-bar-visible' : ''} ${isFullscreen ? 'browser-fullscreen' : ''}`}
    >
      {/* ===== Left Icon Bar (Web Panels) ===== */}
      {hasWebPanelShortcuts && !isFullscreen && (
        <div className="left-icon-bar">
          <div className="left-icon-list">
            {webPanels.map((panel) => (
              <button
                key={panel.id}
                className={`left-icon-btn ${activePanelId === panel.id && panelVisible ? 'active' : ''}`}
                onClick={() => handlePanelToggle(panel.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (confirm(`删除面板 "${panel.name}"？`)) {
                    handleRemovePanel(panel.id)
                  }
                }}
                title={panel.name}
              >
                <span className="left-icon-emoji">{panel.icon}</span>
              </button>
            ))}
          </div>
          <button
            className="left-icon-btn left-icon-add"
            onClick={() => setShowAddPanelDialog(true)}
            title="添加网页面板"
          >
            <span className="left-icon-emoji">＋</span>
          </button>
        </div>
      )}

      {/* ===== Vertical Sidebar (Workspaces + Tabs) ===== */}
      {tabLayout === 'vertical' && !isFullscreen && (
        <div
          className={`vertical-sidebar ${sidebarCollapsed && !isHoveringSidebar ? 'collapsed' : ''}`}
          style={{ width: sidebarPixels }}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        >
          <div className="vsidebar-workspaces">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className={`vsidebar-ws-btn ${activeWorkspaceId === ws.id ? 'active' : ''}`}
                style={{ ['--ws-color' as string]: ws.color }}
                onClick={() => handleSwitchWorkspace(ws.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  handleRemoveWorkspace(ws.id)
                }}
                title={ws.name}
              >
                <span className="vsidebar-ws-icon">{ws.icon}</span>
              </button>
            ))}
            <button
              className="vsidebar-ws-btn vsidebar-ws-add"
              onClick={() => setShowNewWorkspaceDialog(true)}
              title="新建工作区"
            >
              ＋
            </button>
          </div>
          <div className="vsidebar-divider" />
          <div className="vsidebar-tabs-area">
            {(() => {
              const activeWs =
                workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0]
              const workspaceTabIds = new Set(activeWs?.tabIds ?? [])
              const workspaceTabs =
                activeWs && workspaceTabIds.size > 0
                  ? browserState.tabs.filter((t) => workspaceTabIds.has(t.id))
                  : activeWs?.isDefault
                    ? browserState.tabs
                    : []
              const pinnedSet = new Set(activeWs?.pinnedTabIds ?? [])
              const pinnedTabs = workspaceTabs.filter((t) => pinnedSet.has(t.id) || t.isPinned)
              const normalTabs = workspaceTabs.filter((t) => !pinnedSet.has(t.id) && !t.isPinned)
              return (
                <>
                  {pinnedTabs.length > 0 && (
                    <div className="vsidebar-pinned-grid">
                      {pinnedTabs.map((tab) => (
                        <button
                          key={tab.id}
                          className={`vsidebar-pinned-tab ${tab.id === browserState.activeTabId ? 'active' : ''}`}
                          onClick={() => handleSwitchTab(tab.id)}
                          title={tab.title || tab.url}
                        >
                          {tab.favicon ? (
                            <img src={tab.favicon} alt="" />
                          ) : (
                            <span className="vsidebar-tab-dot" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {pinnedTabs.length > 0 && normalTabs.length > 0 && (
                    <div className="vsidebar-tab-divider" />
                  )}
                  <div className="vsidebar-tab-list">
                    {workspaceTabs.length === 0 && (
                      <div className="vsidebar-empty">此工作区暂无标签页</div>
                    )}
                    {normalTabs.map((tab) => (
                      <div
                        key={tab.id}
                        className={`vsidebar-tab ${tab.id === browserState.activeTabId ? 'active' : ''} ${tab.isLoading ? 'loading' : ''} ${tab.isHibernated ? 'is-hibernated' : ''}`}
                        onClick={() => handleSwitchTab(tab.id)}
                        onContextMenu={(e) => handleTabContextMenu(tab.id, e)}
                        title={tab.title || tab.url}
                      >
                        <span className="vsidebar-tab-icon">
                          {tab.isLoading ? (
                            <span className="tab-spinner" />
                          ) : tab.favicon ? (
                            <img src={tab.favicon} alt="" />
                          ) : (
                            <span className="vsidebar-tab-dot" />
                          )}
                        </span>
                        <span className="vsidebar-tab-title">{tab.title || '新标签页'}</span>
                        {tab.isHibernated ? <span className="vsidebar-tab-hint">☾</span> : null}
                        <button
                          className="vsidebar-tab-close"
                          onClick={(e) => handleCloseTab(tab.id, e)}
                          title="关闭"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
          <div className="vsidebar-footer">
            <button
              className="vsidebar-footer-btn"
              onClick={handleNewTab}
              title="新标签页 (Ctrl+T)"
            >
              ＋
            </button>
            <button
              className="vsidebar-footer-btn"
              onClick={handleToggleAutoCollapse}
              title={autoCollapse ? '关闭自动收起' : '开启自动收起'}
            >
              {autoCollapse ? '⇤' : '⇥'}
            </button>
            <button
              className="vsidebar-footer-btn"
              onClick={handleToggleTabLayout}
              title="切换为水平标签栏"
            >
              ☰
            </button>
          </div>
        </div>
      )}

      {showNewWorkspaceDialog && (
        <div
          className="ws-dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewWorkspaceDialog(false)
          }}
        >
          <div className="ws-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ws-dialog-title">新建工作区</div>
            <input
              className="ws-dialog-input"
              type="text"
              placeholder="工作区名称"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              autoFocus
            />
            <div className="ws-dialog-section-label">图标</div>
            <div className="ws-dialog-emoji-grid">
              {['📁', '💼', '🎨', '🚀', '⚡', '🌟', '🎯', '📚', '🎮', '🛠️'].map((emo) => (
                <button
                  key={emo}
                  className={`ws-dialog-emoji ${newWorkspaceIcon === emo ? 'active' : ''}`}
                  onClick={() => setNewWorkspaceIcon(emo)}
                >
                  {emo}
                </button>
              ))}
            </div>
            <div className="ws-dialog-section-label">颜色</div>
            <div className="ws-dialog-color-grid">
              {[
                '#6366f1',
                '#ec4899',
                '#22c55e',
                '#eab308',
                '#ef4444',
                '#06b6d4',
                '#a855f7',
                '#f97316'
              ].map((c) => (
                <button
                  key={c}
                  className={`ws-dialog-color ${newWorkspaceColor === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewWorkspaceColor(c)}
                />
              ))}
            </div>
            <div className="ws-dialog-actions">
              <button
                className="ws-dialog-btn"
                onClick={() => setShowNewWorkspaceDialog(false)}
              >
                取消
              </button>
              <button
                className="ws-dialog-btn ws-dialog-btn-primary"
                onClick={handleAddWorkspace}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="main-area browser-shell browser-ui-shell"
        data-hover-url-active={hoverUrl ? 'true' : undefined}
      >
        <div className="browser-chrome">
          <div className="tab-bar">
            <button
              className="zhi-logo-btn"
              onClick={() => handleFullscreenToggle().catch(console.error)}
              title="切换全屏"
              aria-label="切换全屏"
              aria-pressed={isFullscreen}
            >
              Z
            </button>
            <div className="tabs-container">
              {browserState.tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`tab ${tab.id === browserState.activeTabId ? 'active' : ''} ${tab.isPinned ? 'pinned' : ''} ${tab.isIncognito ? 'incognito' : ''} ${tab.isLoading ? 'tab-loading' : ''} ${tab.isHibernated ? 'is-hibernated' : ''} ${loadedTabIds.has(tab.id) ? 'tab-loaded' : ''} ${tab.isAudible && !tab.isMuted ? 'tab-audible' : ''} ${enteringTabIds.has(tab.id) ? 'tab-entering' : ''} ${closingTabIds.has(tab.id) ? 'tab-exiting' : ''} ${dragTabId === tab.id ? 'dragging' : ''} ${dragOverTabId === tab.id ? 'drag-over' : ''}`}
                  onClick={() => handleSwitchTab(tab.id)}
                  onMouseDown={(e) => handleTabMouseDown(tab.id, e)}
                  onMouseEnter={(e) => handleTabMouseEnter(tab, e)}
                  onMouseLeave={handleTabMouseLeave}
                  onContextMenu={(e) => handleTabContextMenu(tab.id, e)}
                  draggable
                  onDragStart={(e) => handleDragStart(tab.id, e)}
                  onDragOver={(e) => handleDragOver(tab.id, e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(tab.id, e)}
                  onDragEnd={handleDragEnd}
                  title={tab.title || tab.url}
                >
                  <span className="tab-icon">
                    {tab.isHibernated ? (
                      <span className="tab-hibernated-mark" title="已休眠">
                        ☾
                      </span>
                    ) : tab.isLoading ? (
                      <span className="tab-spinner" />
                    ) : tab.favicon ? (
                      <img
                        className="tab-favicon"
                        src={tab.favicon}
                        alt=""
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="tab-dot" />
                    )}
                  </span>
                  {!tab.isPinned && <span className="tab-title">{tab.title || '新标签页'}</span>}
                  {tab.isIncognito && <span className="tab-incognito-mark">◐</span>}
                  {tab.isAudible && !tab.isMuted && (
                    <button
                      className="tab-audio tab-audio-icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.api.toggleMuteTab(tab.id)
                      }}
                      title="静音"
                    >
                      ◔
                    </button>
                  )}
                  {tab.isMuted && (
                    <button
                      className="tab-audio tab-audio-icon muted"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.api.toggleMuteTab(tab.id)
                      }}
                      title="取消静音"
                    >
                      ◌
                    </button>
                  )}
                  {tab.isHibernated && !tab.isPinned && (
                    <span className="tab-hibernated-label">休眠</span>
                  )}
                  {!tab.isPinned && (
                    <button
                      className="tab-close"
                      onClick={(e) => handleCloseTab(tab.id, e)}
                      title="关闭标签页"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="new-tab-btn" onClick={handleNewTab} title="新标签页 (Ctrl+T)">
              +
            </button>
            <button
              className="new-tab-btn incognito-tab-btn"
              onClick={handleNewIncognitoTab}
              title="新建无痕标签页 (Ctrl+Shift+N)"
            >
              ◐
            </button>
            <div className="tabbar-spacer" />
            <button
              className="menu-button"
              onClick={() => window.api.popupMenu().catch(console.error)}
              title="菜单"
            >
              ☰
            </button>
          </div>

          <div className="toolbar">
            <div className="nav-buttons">
              {settings?.toolbar.backButton !== false && (
                <button
                  className="nav-btn"
                  onClick={() => activeTab && window.api.goBack(activeTab.id)}
                  disabled={!activeTab?.canGoBack}
                  title="后退 (Alt+←)"
                >
                  ←
                </button>
              )}
              {settings?.toolbar.forwardButton !== false && (
                <button
                  className="nav-btn"
                  onClick={() => activeTab && window.api.goForward(activeTab.id)}
                  disabled={!activeTab?.canGoForward}
                  title="前进 (Alt+→)"
                >
                  →
                </button>
              )}
              {settings?.toolbar.proxyButton !== false && (
                <div className="proxy-control">
                  <button
                    ref={proxyButtonRef}
                    className={`nav-btn proxy-btn ${proxyEnabled ? 'active' : ''}`}
                    data-proxy-btn="true"
                    onClick={handleProxyButtonClick}
                    onMouseDown={handleProxyButtonMouseDown}
                    title={proxyEnabled ? '代理菜单 - 已开启' : '代理菜单 - 已关闭'}
                    aria-haspopup="menu"
                    aria-expanded={showProxyMenu}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M10.4 1.8L3.8 10.1H8L7.3 16.2L14.2 7.2H9.8L10.4 1.8Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>

                  {showProxyMenu && (
                    <div
                      className="proxy-menu"
                      ref={proxyMenuRef}
                      data-proxy-menu="true"
                      role="menu"
                      style={{ top: 'calc(100% + 8px)' }}
                      onClick={handleProxyMenuMouseEvent}
                      onMouseDown={handleProxyMenuMouseEvent}
                    >
                      <div className="proxy-menu-panel">
                        <div className="proxy-menu-header">
                          <div>
                            <strong>代理</strong>
                            <span>
                              {quickProxyStatus?.running
                                ? proxyEnabled
                                  ? '已连接'
                                  : '内核运行中'
                                : '未连接'}
                            </span>
                          </div>
                          <label className="proxy-switch">
                            <input
                              type="checkbox"
                              checked={proxyEnabled}
                              onChange={(e) =>
                                handleQuickProxyToggle(e.target.checked).catch(console.error)
                              }
                            />
                            <span />
                          </label>
                        </div>

                        <div className="proxy-menu-section">
                          <label className="proxy-menu-check">
                            <input
                              type="checkbox"
                              checked={Boolean(settings?.proxy.autoStart)}
                              onChange={(e) =>
                                handleQuickProxySettingsUpdate({
                                  autoStart: e.target.checked
                                }).catch(console.error)
                              }
                            />
                            <span>启动时自动连接</span>
                          </label>
                        </div>

                        <div className="proxy-menu-section">
                          <label className="proxy-menu-label">订阅链接</label>
                          <div className="proxy-menu-row">
                            <input
                              className="proxy-menu-input"
                              type="text"
                              value={quickProxySubscriptionInput}
                              onChange={(e) => setQuickProxySubscriptionInput(e.target.value)}
                              placeholder="https://..."
                            />
                            <button
                              className="proxy-menu-action"
                              disabled={quickProxyUpdating}
                              onClick={() =>
                                handleQuickProxySubscriptionUpdate().catch(console.error)
                              }
                            >
                              {quickProxyUpdating ? '更新中' : '更新'}
                            </button>
                          </div>
                        </div>

                        <div className="proxy-menu-section">
                          <div className="proxy-menu-grid">
                            <label>
                              <span>Mixed</span>
                              <input
                                type="number"
                                value={settings?.proxy.mixedPort ?? 17890}
                                onChange={(e) =>
                                  handleQuickProxySettingsUpdate({
                                    mixedPort: Number.parseInt(e.target.value, 10) || 17890
                                  }).catch(console.error)
                                }
                              />
                            </label>
                            <label>
                              <span>API</span>
                              <input
                                type="number"
                                value={settings?.proxy.apiPort ?? 19090}
                                onChange={(e) =>
                                  handleQuickProxySettingsUpdate({
                                    apiPort: Number.parseInt(e.target.value, 10) || 19090
                                  }).catch(console.error)
                                }
                              />
                            </label>
                            <label>
                              <span>Secret</span>
                              <input
                                type="password"
                                value={settings?.proxy.secret ?? ''}
                                onChange={(e) =>
                                  handleQuickProxySettingsUpdate({
                                    secret: e.target.value
                                  }).catch(console.error)
                                }
                              />
                            </label>
                          </div>
                        </div>

                        <div className="proxy-menu-section">
                          <label className="proxy-menu-label">节点选择</label>
                          <div className="proxy-menu-row">
                            <select
                              className="proxy-menu-select"
                              value={selectedQuickProxyGroup}
                              onChange={(e) =>
                                handleQuickProxyGroupChange(e.target.value).catch(console.error)
                              }
                            >
                              <option value="">选择分组</option>
                              {quickProxyGroups.map((group) => (
                                <option key={group.name} value={group.name}>
                                  {group.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="proxy-menu-action"
                              onClick={() => loadQuickProxyState().catch(console.error)}
                            >
                              刷新
                            </button>
                          </div>
                          <div className="proxy-menu-actions">
                            <button onClick={() => handleQuickProxyTestAll().catch(console.error)}>
                              全部测速
                            </button>
                            <button onClick={() => handleQuickProxyLogs().catch(console.error)}>
                              查看日志
                            </button>
                          </div>
                        </div>

                        {selectedQuickProxyGroup && (
                          <div className="proxy-menu-node-list">
                            {quickProxyNodes.length === 0 ? (
                              <div className="proxy-menu-empty">当前分组暂无节点</div>
                            ) : (
                              quickProxyNodes.map((node) => {
                                const delay = quickProxyDelayMap[node.name] ?? node.delay
                                const active =
                                  quickProxyGroups.find(
                                    (group) => group.name === selectedQuickProxyGroup
                                  )?.now === node.name
                                return (
                                  <button
                                    key={node.name}
                                    className={`proxy-menu-node ${active ? 'active' : ''}`}
                                    onClick={() =>
                                      handleQuickProxySwitch(node.name).catch(console.error)
                                    }
                                  >
                                    <span>{node.name}</span>
                                    <small className={getProxyDelayClass(delay)}>
                                      {delay === null || delay === undefined || delay < 0
                                        ? '超时'
                                        : `${delay}ms`}
                                    </small>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}

                        {quickProxyLogsVisible && (
                          <div className="proxy-menu-logs">
                            {quickProxyLogs.length === 0 ? (
                              <span>暂无日志</span>
                            ) : (
                              quickProxyLogs.map((line, index) => (
                                <code key={`${line}-${index}`}>{line}</code>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {settings?.toolbar.reloadStopButton !== false && (
                <button
                  className="nav-btn"
                  onClick={() => {
                    if (!activeTab) return
                    activeTab.isLoading
                      ? window.api.stop(activeTab.id)
                      : window.api.reload(activeTab.id)
                  }}
                  title={activeTab?.isLoading ? '停止 (Esc)' : '刷新 (Ctrl+R)'}
                >
                  {activeTab?.isLoading ? '✕' : '↻'}
                </button>
              )}
              {settings?.toolbar.homeButton !== false && (
                <button
                  className="nav-btn"
                  onClick={() =>
                    activeTab &&
                    window.api.loadUrl(activeTab.id, settings?.startup.homepageUrl || '')
                  }
                  title="主页"
                >
                  ⌂
                </button>
              )}
            </div>

            <div className="toolbar-divider" />

            <div
              ref={addressBarWrapperRef}
              className={`address-bar address-bar-wrapper ${activeTab?.isLoading ? 'loading' : ''} ${activeTab?.error ? 'has-error' : ''}`}
            >
              <input
                ref={urlInputRef}
                className="url-input"
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                onFocus={(e) => {
                  setIsEditingAddress(true)
                  e.target.select()
                }}
                onBlur={() => {
                  setIsEditingAddress(false)
                  if (activeTab) setInputUrl(activeTab.isNewTab ? '' : activeTab.url)
                }}
                placeholder="输入网址或搜索内容"
                spellCheck={false}
              />
            </div>

            {/* Quick Search Box */}
            <div className="quick-search-wrapper" ref={engineDropdownRef}>
              <button
                className="quick-search-engine-btn"
                onClick={() => setShowEngineDropdown(!showEngineDropdown)}
                title={`当前: ${currentEngine.name} - 点击切换`}
              >
                <span className="engine-icon">{currentEngine.icon}</span>
                <svg className="engine-arrow" width="10" height="10" viewBox="0 0 10 10">
                  <path
                    d="M2 4L5 7L8 4"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>

              <input
                className="quick-search-input"
                ref={quickSearchRef}
                type="text"
                value={quickSearchQuery}
                onChange={(e) => setQuickSearchQuery(e.target.value)}
                onKeyDown={handleQuickSearchKeyDown}
                placeholder={`搜索 ${currentEngine.name}`}
                spellCheck={false}
              />

              {/* Engine Dropdown */}
              {showEngineDropdown && (
                <div className="engine-dropdown">
                  {quickSearchEngines.map((engine) => (
                    <button
                      key={engine.id}
                      className={`engine-option ${engine.id === quickSearchEngine ? 'active' : ''}`}
                      onClick={() => handleQuickSearchEngineChange(engine.id).catch(console.error)}
                    >
                      <span className="engine-option-icon">{engine.icon}</span>
                      <span className="engine-option-name">{engine.name}</span>
                      {engine.id === quickSearchEngine && (
                        <span className="engine-option-check">✓</span>
                      )}
                    </button>
                  ))}
                  <div className="engine-custom-editor">
                    <label>自定义搜索</label>
                    <input
                      type="text"
                      value={quickCustomName}
                      onChange={(e) => setQuickCustomName(e.target.value)}
                      placeholder="名称"
                    />
                    <input
                      type="text"
                      value={quickCustomTemplate}
                      onChange={(e) => setQuickCustomTemplate(e.target.value)}
                      placeholder="https://example.com/search?q={query}"
                    />
                    <button onClick={() => handleSaveQuickCustomEngine().catch(console.error)}>
                      保存并使用
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="toolbar-divider" />

            <div className={`toolbar-actions toolbar-actions-page-${toolbarActionPage}`}>
              <button
                className="action-btn toolbar-page-primary command-palette-btn"
                onClick={() => window.api.commandPaletteToggle().catch(console.error)}
                title="命令面板 (Ctrl+K)"
                aria-label="打开命令面板"
              >
                ⌘
              </button>
              <button
                className="action-btn toolbar-page-primary screenshot-btn"
                onClick={() => window.api.screenshotOpen().catch(console.error)}
                title="截图 (Alt+A)"
                aria-label="截图"
              >
                ⛶
              </button>
              <button
                className="action-btn toolbar-page-primary quick-note-btn"
                onClick={() => window.api.quickNoteToggle().catch(console.error)}
                title="快捷笔记 (Alt+N)"
                aria-label="打开快捷笔记"
              >
                笔
              </button>
              <button
                className="action-btn toolbar-page-primary"
                onClick={() => handleToggleTabLayout().catch(console.error)}
                title={tabLayout === 'horizontal' ? '切换为垂直标签栏' : '切换为水平标签栏'}
              >
                ☰
              </button>
              {settings?.toolbar.adBlockButton !== false && (
                <button
                  className={`action-btn toolbar-page-primary adblock-quick-button ${adBlockState?.enabled ? 'active' : ''} ${isCurrentAdBlockWhitelisted ? 'whitelisted' : ''}`}
                  onClick={() => handleAdBlockQuickToggle().catch(console.error)}
                  title={
                    !adBlockState?.enabled
                      ? 'AdBlock Zhi 已关闭'
                      : isCurrentAdBlockWhitelisted
                        ? `AdBlock Zhi 已启用，当前网站在白名单 (${currentAdBlockHostname})`
                        : 'AdBlock Zhi 已启用'
                  }
                  aria-pressed={Boolean(adBlockState?.enabled)}
                >
                  🛡
                </button>
              )}
              {settings?.toolbar.darkModeButton !== false && (
                <button
                  className={`action-btn toolbar-page-primary ${webDarkMode ? 'active' : ''}`}
                  onClick={() => handleToggleDarkMode().catch(console.error)}
                  title="网页暗色模式"
                  aria-pressed={webDarkMode}
                >
                  🌙
                </button>
              )}
              {settings?.toolbar.translateButton !== false && (
                <button
                  className={`action-btn toolbar-page-primary ${isTranslating ? 'active' : ''}`}
                  onClick={() => handleToggleTranslate().catch(console.error)}
                  title="沉浸式翻译"
                  aria-pressed={isTranslating}
                >
                  译
                </button>
              )}
              {settings?.toolbar.readerButton !== false && (
                <button
                  className={`action-btn toolbar-page-primary ${readerActive ? 'active' : ''}`}
                  onClick={() => handleToggleReader().catch(console.error)}
                  disabled={!readerActive && !readerAvailable}
                  title={readerActive ? '退出阅读模式' : '阅读模式'}
                  aria-pressed={readerActive}
                >
                  读
                </button>
              )}
              {settings?.toolbar.bookmarkButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary bookmark-btn ${isCurrentBookmarked ? 'bookmarked' : ''}`}
                  onClick={() => handleToggleBookmark()}
                  title="收藏 (Ctrl+D)"
                >
                  {isCurrentBookmarked ? '★' : '☆'}
                </button>
              )}
              {settings?.toolbar.bookmarksButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary ${activePanel === 'bookmarks' ? 'active' : ''}`}
                  onClick={handleShowBookmarks}
                  title="书签"
                  aria-pressed={activePanel === 'bookmarks'}
                >
                  ▤
                </button>
              )}
              {settings?.toolbar.historyButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary ${activePanel === 'history' ? 'active' : ''}`}
                  onClick={handleShowHistory}
                  title="历史"
                  aria-pressed={activePanel === 'history'}
                >
                  ◷
                </button>
              )}
              {settings?.toolbar.downloadsButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary ${activePanel === 'downloads' ? 'active' : ''}`}
                  onClick={handleShowDownloads}
                  title="下载"
                  aria-pressed={activePanel === 'downloads'}
                >
                  ↓
                </button>
              )}
              {settings?.toolbar.snifferButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary sniffer-action-btn ${activePanel === 'sniffer' ? 'active' : ''}`}
                  onClick={handleShowSniffer}
                  title="资源嗅探"
                  aria-pressed={activePanel === 'sniffer'}
                >
                  ⧉
                  {activeSnifferCount > 0 && (
                    <span className="sniffer-badge">{activeSnifferCount}</span>
                  )}
                </button>
              )}
              {settings?.toolbar.scriptsButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary ${activePanel === 'scripts' ? 'active' : ''}`}
                  onClick={handleShowScripts}
                  title="用户脚本"
                  aria-pressed={activePanel === 'scripts'}
                >
                  脚
                </button>
              )}
              {settings?.toolbar.webPanelButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary ${activePanel === 'webpanel' ? 'active' : ''}`}
                  onClick={handleShowWebPanel}
                  title="侧边栏网页面板"
                  aria-pressed={activePanel === 'webpanel'}
                >
                  ⊞
                </button>
              )}
              {settings?.toolbar.splitViewButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary ${splitViewActive ? 'active' : ''}`}
                  onClick={() =>
                    splitViewActive
                      ? handleSplitViewClose().catch(console.error)
                      : handleSplitViewOpen().catch(console.error)
                  }
                  title="分屏浏览"
                  aria-pressed={splitViewActive}
                >
                  ⫘
                </button>
              )}
              {settings?.toolbar.aiButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary toolbar-ai-btn ${activePanel === 'ai' ? 'active' : ''}`}
                  onClick={handleShowAI}
                  title="AI 助手"
                  aria-pressed={activePanel === 'ai'}
                >
                  ✦
                </button>
              )}
              {settings?.toolbar.settingsButton !== false && (
                <button
                  className={`action-btn toolbar-page-secondary ${activePanel === 'settings' ? 'active' : ''}`}
                  onClick={handleShowSettings}
                  title="设置"
                  aria-pressed={activePanel === 'settings'}
                >
                  ⚙
                </button>
              )}
              {tabLayout === 'vertical' && (
                <button
                  className="action-btn toolbar-page-toggle"
                  onClick={() => setToolbarActionPage((page) => (page === 0 ? 1 : 0))}
                  title={toolbarActionPage === 0 ? '更多工具' : '返回常用工具'}
                  aria-label={toolbarActionPage === 0 ? '更多工具' : '返回常用工具'}
                >
                  {toolbarActionPage === 0 ? '›' : '‹'}
                </button>
              )}
            </div>
            {splitViewActive && (
              <div className="split-view-bar">
                <button
                  className="split-view-btn"
                  onClick={() => window.api.splitViewGoBack().catch(console.error)}
                  title="右侧后退"
                >
                  ←
                </button>
                <button
                  className="split-view-btn"
                  onClick={() => window.api.splitViewGoForward().catch(console.error)}
                  title="右侧前进"
                >
                  →
                </button>
                <button
                  className="split-view-btn"
                  onClick={() => window.api.splitViewReload().catch(console.error)}
                  title="右侧刷新"
                >
                  ↻
                </button>
                <input
                  className="split-view-url"
                  value={splitViewInput}
                  onChange={(e) => setSplitViewInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const value = splitViewInput.trim()
                    if (!value) return
                    const url = value.startsWith('http') ? value : `https://${value}`
                    window.api.splitViewNavigate(url).catch(console.error)
                  }}
                  placeholder="右侧窗口地址..."
                />
                <button
                  className="split-view-btn close"
                  onClick={() => handleSplitViewClose().catch(console.error)}
                  title="关闭分屏"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {!isFullscreen && showBookmarkBar && (
          <div className="bookmark-bar" aria-label="书签栏">
            {bookmarks.length > 0 ? (
              bookmarks.map((bookmark) => (
                <button
                  key={bookmark.id || bookmark.url}
                  className="bookmark-bar-item"
                  onClick={() => handleOpenBookmarkFromBar(bookmark.url)}
                  title={bookmark.url}
                >
                  {bookmark.favicon && (
                    <img
                      className="bookmark-bar-item-icon"
                      src={bookmark.favicon}
                      alt=""
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <span className="bookmark-bar-item-title">{bookmark.title || bookmark.url}</span>
                </button>
              ))
            ) : (
              <span className="bookmark-bar-empty">将书签添加到书签栏以便快速访问</span>
            )}
          </div>
        )}

        {!isFullscreen && showFind && (
          <div className="find-bar">
            <input
              ref={findInputRef}
              className="find-input"
              type="text"
              value={findText}
              onChange={(e) => handleFindChange(e.target.value)}
              onKeyDown={handleFindKeyDown}
              placeholder="在页面中查找"
              spellCheck={false}
            />
            {findResult && (
              <span className="find-count">
                {findResult.matches > 0
                  ? `${findResult.activeMatchOrdinal}/${findResult.matches}`
                  : '0/0'}
              </span>
            )}
            <button
              className="find-btn"
              onClick={() => activeTab && window.api.findNext(activeTab.id, false)}
              title="上一项 (Shift+Enter)"
            >
              ▲
            </button>
            <button
              className="find-btn"
              onClick={() => activeTab && window.api.findNext(activeTab.id, true)}
              title="下一项 (Enter)"
            >
              ▼
            </button>
            <button className="find-btn find-close" onClick={handleCloseFind} title="关闭 (Esc)">
              ✕
            </button>
          </div>
        )}

        {!isFullscreen && activeTab?.error && (
          <div className="error-bar">
            <span className="error-text">
              页面没打开：可能是地址写错了、网络断了，或者对面服务器在摸鱼。技术信息：
              {activeTab.error.url} · {activeTab.error.errorDescription} (
              {activeTab.error.errorCode})
            </span>
            <button className="error-retry-btn" onClick={() => window.api.retryLoad(activeTab.id)}>
              重新加载
            </button>
            <button
              className="error-secondary-btn"
              onClick={() => activeTab && window.api.goBack(activeTab.id)}
              disabled={!activeTab.canGoBack}
            >
              返回
            </button>
            <button
              className="error-secondary-btn"
              onClick={() => {
                window.api
                  .copyToClipboard(activeTab.error?.url || activeTab.url)
                  .catch(console.error)
                showToast('已复制到剪贴板')
              }}
            >
              复制地址
            </button>
          </div>
        )}

        {activePanel === 'bookmarks' && <div className="panel-overlay" onClick={closePanel} />}
        {activePanel === 'bookmarks' && (
          <div className="panel bookmarks-panel">
            <div className="panel-header">
              <h3>书签</h3>
              <input
                className="panel-search"
                type="text"
                value={bookmarkQuery}
                onChange={(e) => setBookmarkQuery(e.target.value)}
                placeholder="搜索书签"
              />
              <button
                className={`panel-header-btn ${showBookmarkBar ? 'active' : ''}`}
                onClick={() => handleToggleBookmarkBar().catch(console.error)}
                title={showBookmarkBar ? '隐藏书签栏 (Ctrl+Shift+B)' : '显示书签栏 (Ctrl+Shift+B)'}
              >
                {showBookmarkBar ? '隐藏书签栏' : '显示书签栏'}
              </button>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list">
              {filteredBookmarks.length === 0 && (
                <div className="panel-empty">
                  {getPanelEmptyText(
                    bookmarks.length,
                    filteredBookmarks.length,
                    '书签夹空空如也。喜欢就收藏，别装清高。',
                    '没找到，换个关键词试试。'
                  )}
                </div>
              )}
              {filteredBookmarks.map((b) => (
                <div
                  key={b.url}
                  className="panel-item"
                  onMouseMove={handlePanelSpotlightMove}
                  onClick={() => handleOpenBookmark(b.url)}
                >
                  {b.favicon && (
                    <img
                      className="panel-item-icon"
                      src={b.favicon}
                      alt=""
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <span className="panel-item-title">{b.title || b.url}</span>
                  <span className="panel-item-url">{b.url}</span>
                  <button
                    className="panel-item-delete"
                    onClick={(e) => handleDeleteBookmark(b.url, e)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activePanel === 'history' && <div className="panel-overlay" onClick={closePanel} />}
        {activePanel === 'history' && (
          <div className="panel history-panel">
            <div className="panel-header">
              <h3>历史</h3>
              <input
                className="panel-search"
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="搜索历史记录"
              />
              <button className="panel-clear" onClick={handleClearHistory}>
                清空全部
              </button>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list">
              {filteredHistory.length === 0 && (
                <div className="panel-empty">
                  {getPanelEmptyText(
                    historyItems.length,
                    filteredHistory.length,
                    '还没有浏览记录。上网了才有历史，道理大家都懂。',
                    '没找到相关记录。'
                  )}
                </div>
              )}
              {filteredHistory.map((h, i) => (
                <div
                  key={`${h.url}-${i}`}
                  className="panel-item"
                  onMouseMove={handlePanelSpotlightMove}
                  onClick={() => handleOpenHistory(h.url)}
                >
                  <span className="panel-item-title">{h.title || h.url}</span>
                  <span className="panel-item-url">{h.url}</span>
                  <span className="panel-item-time">{new Date(h.visitedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activePanel === 'downloads' && <div className="panel-overlay" onClick={closePanel} />}
        {activePanel === 'downloads' && (
          <div className="panel downloads-panel download-panel">
            <div className="panel-header download-panel-header">
              <h3>下载</h3>
              <div className="download-panel-actions">
                <button
                  onClick={handleDownloadClearCompleted}
                  title="清除已完成"
                  style={{
                    padding: '0 8px',
                    background: 'transparent',
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  🗑️
                </button>
                <button className="panel-close" onClick={closePanel} style={{ marginLeft: '4px' }}>
                  ✕
                </button>
              </div>
            </div>
            <div className="panel-list download-list">
              {downloadTasks.length === 0 && (
                <div className="panel-empty download-empty">暂无下载任务</div>
              )}
              {downloadTasks.map((task) => (
                <div
                  key={task.id}
                  className={`panel-item download-item download-${task.status}`}
                  onMouseMove={handlePanelSpotlightMove}
                  style={{ flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <div className="download-item-info">
                    <div className="download-item-name" title={task.filename}>
                      {task.filename}
                    </div>
                    <div className="download-item-meta">
                      {task.status === 'downloading' && (
                        <>
                          <span>
                            {formatSize(task.downloadedSize)} / {formatSize(task.totalSize)}
                          </span>
                          <span className="download-speed" style={{ marginLeft: 'auto' }}>
                            {formatSpeed(task.speed)}
                          </span>
                          <span className="download-threads">{task.threads}线程</span>
                        </>
                      )}
                      {task.status === 'completed' && (
                        <span className="download-completed-text">
                          {formatSize(task.totalSize)} - 下载完成
                        </span>
                      )}
                      {task.status === 'paused' && (
                        <span>
                          {formatSize(task.downloadedSize)} / {formatSize(task.totalSize)} - 已暂停
                        </span>
                      )}
                      {task.status === 'error' && (
                        <span className="download-error-text">{task.error || '下载失败'}</span>
                      )}
                      {task.status === 'merging' && <span>合并分片中...</span>}
                    </div>
                  </div>

                  {(task.status === 'downloading' ||
                    task.status === 'paused' ||
                    task.status === 'merging') && (
                    <div className="download-progress-bar" style={{ marginBottom: '8px' }}>
                      <div
                        className="download-progress-fill"
                        style={{ width: `${task.progress || 0}%` }}
                      />
                    </div>
                  )}

                  <div
                    className="download-item-actions panel-item-actions"
                    style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}
                  >
                    {task.status === 'downloading' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadPause(task.id)
                        }}
                        title="暂停"
                      >
                        ⏸
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadResume(task.id)
                        }}
                        title="继续"
                      >
                        ▶
                      </button>
                    )}
                    {task.status === 'completed' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownloadOpenFile(task.id)
                          }}
                          title="打开文件"
                        >
                          📂
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownloadOpenFolder(task.id)
                          }}
                          title="打开所在文件夹"
                        >
                          📁
                        </button>
                      </>
                    )}
                    {(task.status === 'downloading' || task.status === 'paused') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadCancel(task.id)
                        }}
                        title="取消"
                      >
                        ✕
                      </button>
                    )}
                    {(task.status === 'completed' || task.status === 'error') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadRemove(task.id)
                        }}
                        title="移除记录"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activePanel === 'settings' && settings && (
          <div className="panel-overlay" onClick={closePanel} />
        )}
        {activePanel === 'settings' && settings && (
          <div className="panel settings-panel">
            <div className="panel-header">
              <h3>设置</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list" style={{ padding: '12px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                  搜索引擎
                </label>
                <select
                  value={settings.searchEngine}
                  onChange={async (e) => {
                    const newSet = await window.api.updateSettings({
                      searchEngine: e.target.value as 'google' | 'bing' | 'baidu' | 'duckduckgo'
                    })
                    setSettings(newSet)
                  }}
                  style={{ width: '100%', padding: '4px' }}
                >
                  <option value="google">Google</option>
                  <option value="bing">Bing</option>
                  <option value="baidu">百度</option>
                  <option value="duckduckgo">DuckDuckGo</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                  下载路径
                </label>
                <input
                  type="text"
                  value={settings.downloadPath}
                  onChange={async (e) => {
                    const newSet = await window.api.updateSettings({ downloadPath: e.target.value })
                    setSettings(newSet)
                  }}
                  style={{
                    width: '100%',
                    padding: '4px',
                    background: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#eee',
                    fontSize: '12px'
                  }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', fontSize: '12px', gap: '6px' }}
                >
                  <input
                    type="checkbox"
                    checked={settings.askWhereToSaveBeforeDownloading}
                    onChange={async (e) => {
                      const newSet = await window.api.updateSettings({
                        askWhereToSaveBeforeDownloading: e.target.checked
                      })
                      setSettings(newSet)
                    }}
                  />
                  下载前询问位置
                </label>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', fontSize: '12px', gap: '6px' }}
                >
                  <input
                    type="checkbox"
                    checked={settings.restoreSession}
                    onChange={async (e) => {
                      const newSet = await window.api.updateSettings({
                        restoreSession: e.target.checked
                      })
                      setSettings(newSet)
                    }}
                  />
                  启动时恢复标签
                </label>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', fontSize: '12px', gap: '6px' }}
                >
                  <input
                    type="checkbox"
                    checked={webDarkMode}
                    onChange={() => handleToggleDarkMode().catch(console.error)}
                  />
                  网页暗色模式
                </label>
              </div>
            </div>
          </div>
        )}

        {previewTabId && previewImage && (
          <div
            className="tab-preview-tooltip"
            style={{
              left: previewPosition.x,
              top: previewPosition.y
            }}
          >
            <img src={previewImage} alt="preview" className="tab-preview-image" />
          </div>
        )}

        {toast && <div className={`toast toast-${toast.tone || 'info'}`}>{toast.text}</div>}

        {passwordSavePrompt && (
          <div className="password-prompt password-save-prompt">
            <div className="password-prompt-main">
              <strong>{passwordSavePrompt.existing ? '更新密码？' : '保存密码？'}</strong>
              <span>{passwordSavePrompt.username || '未填写用户名'}</span>
            </div>
            <div className="password-prompt-actions">
              <button onClick={() => setPasswordSavePrompt(null)}>忽略</button>
              <button
                className="primary"
                onClick={() => handleSaveDetectedPassword().catch(console.error)}
              >
                {passwordSavePrompt.existing ? '更新' : '保存'}
              </button>
            </div>
          </div>
        )}

        {passwordFillPrompt && (
          <div className="password-prompt password-fill-prompt">
            <div className="password-prompt-main">
              <strong>填充密码</strong>
              <span>{passwordFillPrompt.entries[0]?.username || passwordFillPrompt.url}</span>
            </div>
            <div className="password-prompt-actions">
              <button onClick={() => setPasswordFillPrompt(null)}>关闭</button>
              {passwordFillPrompt.entries.slice(0, 2).map((entry) => (
                <button
                  key={entry.id}
                  className="primary"
                  onClick={() => handleFillDetectedPassword(entry.id).catch(console.error)}
                >
                  {entry.username || '填充'}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab?.isNewTab && (
          <div className="new-tab-content">
            <h1 className="new-tab-title">Zhi Browser</h1>
            <p className="new-tab-hint">在地址栏输入网址或搜索内容</p>
            {browserState.recentlyClosed.length > 0 && (
              <div className="new-tab-recent">
                <button className="restore-btn" onClick={() => window.api.restoreClosed()}>
                  恢复上次关闭的标签
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== Add Panel Dialog ===== */}
        {showAddPanelDialog && (
          <div className="dialog-overlay" onClick={() => setShowAddPanelDialog(false)}>
            <div className="dialog-box add-panel-dialog" onClick={(e) => e.stopPropagation()}>
              <h3 className="dialog-title">添加网页面板</h3>

              <div className="dialog-field">
                <label className="dialog-label">图标</label>
                <div className="icon-picker">
                  {['🌐', '🎵', '🤖', '💬', '📝', '📧', '📺', '🎮', '📚', '🔧', '☁️', '📊'].map(
                    (emoji) => (
                      <button
                        key={emoji}
                        className={`icon-picker-item ${newPanelIcon === emoji ? 'active' : ''}`}
                        onClick={() => setNewPanelIcon(emoji)}
                      >
                        {emoji}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="dialog-field">
                <label className="dialog-label">名称</label>
                <input
                  className="dialog-input"
                  type="text"
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                  placeholder="如：网易云音乐"
                  autoFocus
                />
              </div>

              <div className="dialog-field">
                <label className="dialog-label">网址</label>
                <input
                  className="dialog-input"
                  type="text"
                  value={newPanelUrl}
                  onChange={(e) => setNewPanelUrl(e.target.value)}
                  placeholder="https://music.163.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddPanel().catch(console.error)
                  }}
                />
              </div>

              <div className="dialog-actions">
                <button
                  className="dialog-btn dialog-btn-cancel"
                  onClick={() => setShowAddPanelDialog(false)}
                >
                  取消
                </button>
                <button
                  className="dialog-btn dialog-btn-confirm"
                  onClick={() => handleAddPanel().catch(console.error)}
                  disabled={!newPanelName.trim() || !newPanelUrl.trim()}
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function App_PanelOnly(): React.ReactElement {
  const [panelType, setPanelType] = useState<SidePanelType>('bookmarks')
  const [browserState, setBrowserState] = useState<BrowserState>({
    tabs: [],
    activeTabId: '',
    findState: null,
    downloads: [],
    recentlyClosed: []
  })
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [bookmarkQuery, setBookmarkQuery] = useState('')
  const [bookmarkFolderFilter, setBookmarkFolderFilter] = useState('')
  const [bookmarkFolders, setBookmarkFolders] = useState<string[]>([])
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '', folder: '未分类' })
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set())
  const [downloadQuery, setDownloadQuery] = useState('')
  const [settings, setSettings] = useState<BrowserSettings | null>(null)
  const [showBookmarkBar, setShowBookmarkBar] = useState(true)
  const [webDarkMode, setWebDarkMode] = useState(false)
  const [adBlockState, setAdBlockState] = useState<AdBlockState | null>(null)
  const [currentAdBlockSite, setCurrentAdBlockSite] = useState<AdBlockCurrentSite | null>(null)
  const [editingBookmark, setEditingBookmark] = useState<BookmarkEditState | null>(null)
  const [bookmarkEditError, setBookmarkEditError] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null)
  const [toast, setToast] = useState<LocalToastMessage | null>(null)
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const [aiContextLoading, setAiContextLoading] = useState(false)
  const [aiShowSettings, setAiShowSettings] = useState(false)
  const [aiSearchMode, setAiSearchMode] = useState(false)
  const [userScripts, setUserScripts] = useState<UserScriptItem[]>([])
  const [scriptInstallUrl, setScriptInstallUrl] = useState('')
  const [sniffedResources, setSniffedResources] = useState<SniffedResource[]>([])
  const [webPanelVisible, setWebPanelVisible] = useState(false)
  const [savedWebPanels, setSavedWebPanels] = useState<
    Array<{ url: string; title: string; pinned: boolean }>
  >([])
  const [webPanelInput, setWebPanelInput] = useState('')
  const [detectedDownloaders, setDetectedDownloaders] = useState<Record<string, string | null>>({})
  const [passwordItems, setPasswordItems] = useState<PasswordListItem[]>([])
  const [passwordQuery, setPasswordQuery] = useState('')
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    id: '',
    title: '',
    url: '',
    username: '',
    password: ''
  })
  const [visiblePassword, setVisiblePassword] = useState<{ id: string; value: string } | null>(null)
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null)
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([])
  const [selectedProxyGroup, setSelectedProxyGroup] = useState('')
  const [proxyNodes, setProxyNodes] = useState<ProxyNode[]>([])
  const [proxyDelayMap, setProxyDelayMap] = useState<Record<string, number>>({})
  const [proxySubscriptionInput, setProxySubscriptionInput] = useState('')
  const [proxyUpdating, setProxyUpdating] = useState(false)
  const [proxyLogsVisible, setProxyLogsVisible] = useState(false)
  const [proxyLogs, setProxyLogs] = useState<string[]>([])
  const [hibernationPrefs, setHibernationPrefs] = useState<{
    enabled: boolean
    timeoutMinutes: number
    whitelist: string[]
  }>({ enabled: false, timeoutMinutes: 30, whitelist: [] })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passwordRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiMessageListRef = useRef<HTMLDivElement | null>(null)
  const aiInputRef = useRef<HTMLTextAreaElement>(null)

  const showToast = useCallback((text: string, tone: ToastTone = 'success', duration = 2200) => {
    setToast({ id: `${Date.now()}`, text, duration, tone })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), duration)
  }, [])

  const requestConfirm = useCallback(
    (
      title: string,
      message: string,
      confirmLabel: string,
      onConfirm: () => void | Promise<void>,
      cancelLabel = '我再想想',
      danger = true
    ): void => {
      setConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onConfirm })
    },
    []
  )

  const refreshAIContext = useCallback(async (): Promise<void> => {
    setAiContextLoading(true)
    try {
      try {
        const status = await window.api.getAIStatus()
        setAiStatus(status)
      } catch {
        setAiStatus(null)
      }
    } finally {
      setAiContextLoading(false)
    }
  }, [])

  useEffect(() => {
    if (panelType === 'ai') {
      const timer = setTimeout(() => {
        if (aiInputRef.current) {
          aiInputRef.current.focus()
        }
      }, 150)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [panelType])

  useEffect(() => {
    if (panelType !== 'ai' || aiShowSettings) return undefined

    const frameId = window.requestAnimationFrame(() => {
      const messageList = aiMessageListRef.current
      if (messageList) {
        messageList.scrollTop = messageList.scrollHeight
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [aiError, aiLoading, aiMessages, aiShowSettings, panelType])

  const runAIAction = useCallback(
    async (userLabel: string, request: () => Promise<AIResponse | null>): Promise<void> => {
      if (aiLoading) return
      setAiLoading(true)
      setAiError(null)
      setAiMessages((current) => [...current, { role: 'user', content: userLabel }])

      try {
        const result = await request()
        const text = result?.text
        if (result?.success && text) {
          setAiMessages((current) => [...current, { role: 'assistant', content: text }])
        } else {
          setAiError(result?.error || '请求失败')
        }
      } catch {
        setAiError('请求异常')
      } finally {
        setAiLoading(false)
      }
    },
    [aiLoading]
  )

  const handleAISummarizePage = useCallback(async (): Promise<void> => {
    if (aiLoading || !aiStatus?.enabled || !aiStatus?.configured) return
    await runAIAction('省流版本', () => window.api.summarizeCurrentPage())
  }, [aiLoading, aiStatus?.configured, aiStatus?.enabled, runAIAction])

  const handleAIVerifyPage = useCallback(async (): Promise<void> => {
    if (aiLoading || !aiStatus?.enabled || !aiStatus?.configured) return
    await runAIAction('丁真一下', () => window.api.verifyCurrentPage())
  }, [aiLoading, aiStatus?.configured, aiStatus?.enabled, runAIAction])

  const handleAISearchPage = useCallback(async (): Promise<void> => {
    if (aiLoading || !aiStatus?.enabled || !aiStatus?.configured) return
    await runAIAction('全网通缉', () => window.api.searchCurrentPage())
  }, [aiLoading, aiStatus?.configured, aiStatus?.enabled, runAIAction])

  const handleAIDebatePage = useCallback(async (): Promise<void> => {
    if (aiLoading || !aiStatus?.enabled || !aiStatus?.configured) return
    await runAIAction('大司马模式', () => window.api.debateCurrentPage())
  }, [aiLoading, aiStatus?.configured, aiStatus?.enabled, runAIAction])

  const handleAIYouAskPage = useCallback(async (): Promise<void> => {
    if (aiLoading || !aiStatus?.enabled || !aiStatus?.configured) return
    await runAIAction('你问我答', () => window.api.youAskCurrentPage())
  }, [aiLoading, aiStatus?.configured, aiStatus?.enabled, runAIAction])

  const handleAITranslateSelection = useCallback(async (): Promise<void> => {
    await runAIAction('翻译选中内容', () => window.api.translateSelection())
  }, [runAIAction])

  const handleAIExplainSelection = useCallback(async (): Promise<void> => {
    await runAIAction('解释选中内容', () => window.api.explainSelection())
  }, [runAIAction])

  const handleAISummarizeSelection = useCallback(async (): Promise<void> => {
    await runAIAction('总结选中内容', () => window.api.summarizeSelection())
  }, [runAIAction])

  const handleAIChat = useCallback(async (): Promise<void> => {
    const message = aiInput.trim()
    if (!message || aiLoading || !aiStatus?.enabled || !aiStatus?.configured) return
    setAiInput('')
    await runAIAction(message, () =>
      aiSearchMode ? window.api.aiSearchLibrary(message) : window.api.chatWithAI(message)
    )
  }, [aiInput, aiLoading, aiSearchMode, aiStatus?.configured, aiStatus?.enabled, runAIAction])

  const handleToggleAISearchMode = useCallback((): void => {
    setAiSearchMode((current) => !current)
    setAiError(null)
  }, [])

  const handleClearAIMessages = useCallback((): void => {
    setAiMessages([])
    setAiError(null)
  }, [])

  const handleCopyAIMessage = useCallback(
    async (content: string): Promise<void> => {
      await window.api.copyToClipboard(content)
      showToast('已复制')
    },
    [showToast]
  )

  const handleAITriggeredAction = useCallback(
    (action: AISelectionAction): void => {
      setPanelType('ai')
      setAiShowSettings(false)
      setAiError(null)
      refreshAIContext().catch(() => {
        /* panel context will retry when opened */
      })

      if (action === 'explain-selection') {
        handleAIExplainSelection().catch(() => setAiError('请求异常'))
      } else if (action === 'translate-selection') {
        handleAITranslateSelection().catch(() => setAiError('请求异常'))
      } else if (action === 'summarize-selection') {
        handleAISummarizeSelection().catch(() => setAiError('请求异常'))
      }
    },
    [
      handleAIExplainSelection,
      handleAISummarizeSelection,
      handleAITranslateSelection,
      refreshAIContext
    ]
  )

  useEffect(() => {
    const unsubPanelType = window.api.onPanelType((type) => {
      setPanelType(type)
      setAiShowSettings(false)
      setAiError(null)
      setAiSearchMode(false)
      setEditingBookmark(null)
      setBookmarkEditError('')
      setConfirmDialog(null)
      setSelectedHistoryIds(new Set())
    })
    const unsubBrowserState = window.api.onBrowserState((state: BrowserState) =>
      setBrowserState(state)
    )
    const unsubDownloadUpdate = window.api.onDownloadUpdate(() => {
      window.api.getBrowserState().then(setBrowserState)
    })
    const unsubSettings = window.api.onSettings((updated) => {
      setSettings(updated)
      setWebDarkMode(updated.webDarkMode)
      setProxySubscriptionInput(updated.proxy.subscriptionUrl)
    })
    const unsubBookmarkBar = window.api.onBookmarkBarChanged((visible) => {
      setShowBookmarkBar(visible)
    })
    const unsubBookmarksChanged = window.api.onBookmarksChanged((updatedBookmarks) => {
      setBookmarks(updatedBookmarks)
    })
    const unsubResourceFound = window.api.onResourceFound(() => {
      if (panelType === 'sniffer') {
        loadSniffedResources().catch(console.error)
      }
    })
    const unsubUserScriptInstalled = window.api.onUserScriptInstalled((data) => {
      if (panelType === 'scripts') {
        loadUserScripts().catch(console.error)
      }
      showToast(`已安装脚本：${data.name}`)
    })
    const unsubClearData = window.api.onClearDataConfirm(() => {
      requestConfirm(
        '清除浏览数据？',
        '将清空浏览历史和下载记录。书签和设置不受影响。',
        '清除',
        async () => {
          await window.api.clearHistory()
          await window.api.clearDownloads()
          setHistoryItems([])
          const downloads = await window.api.getDownloads()
          setBrowserState((current) => ({ ...current, downloads }))
          showToast('已清除')
        },
        '取消'
      )
    })

    window.api.getBrowserState().then(setBrowserState)
    window.api.getBookmarks().then(setBookmarks)
    window.api.getBookmarkBarVisible().then(setShowBookmarkBar)
    window.api.getSettings().then((loaded) => {
      setSettings(loaded)
      setWebDarkMode(loaded.webDarkMode)
      setProxySubscriptionInput(loaded.proxy.subscriptionUrl)
    })
    window.api.getDarkMode().then(setWebDarkMode)
    window.api.getAdBlockState().then(setAdBlockState).catch(console.error)
    window.api.getCurrentSiteForAdBlock().then(setCurrentAdBlockSite).catch(console.error)
    window.api.hibernationGetPrefs().then(setHibernationPrefs).catch(console.error)

    const unsubAdBlock = window.api.onAdBlockStateChanged((state) => {
      setAdBlockState(state)
      window.api.getCurrentSiteForAdBlock().then(setCurrentAdBlockSite).catch(console.error)
    })

    return () => {
      unsubPanelType()
      unsubBrowserState()
      unsubDownloadUpdate()
      unsubSettings()
      unsubBookmarkBar()
      unsubBookmarksChanged()
      unsubClearData()
      unsubAdBlock()
      unsubResourceFound()
      unsubUserScriptInstalled()
      if (toastTimer.current) clearTimeout(toastTimer.current)
      if (passwordRevealTimer.current) clearTimeout(passwordRevealTimer.current)
    }
  }, [panelType, requestConfirm, showToast])

  useEffect(() => {
    const unsubscribe = window.api.onAITriggerAction(handleAITriggeredAction)
    return () => unsubscribe()
  }, [handleAITriggeredAction])

  useEffect(() => {
    return applyAppearance(settings)
  }, [settings])

  useEffect(() => {
    window.api.getCurrentSiteForAdBlock().then(setCurrentAdBlockSite).catch(console.error)
  }, [browserState.activeTabId, browserState.tabs])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (ctrl && e.shiftKey && !e.altKey && key === 'b') {
        e.preventDefault()
        window.api
          .toggleBookmarkBar()
          .then((visible) => {
            setShowBookmarkBar(visible)
            showToast(visible ? '已显示书签栏' : '已隐藏书签栏')
          })
          .catch(console.error)
        return
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && key === 'i') {
        e.preventDefault()
        setAiShowSettings(false)
        if (panelType === 'ai') {
          setAiError(null)
          window.api.hidePanel()
        } else {
          setPanelType('ai')
          setAiError(null)
          window.api.showPanel('ai')
        }
        return
      }

      if (e.key !== 'Escape') return
      if (editingBookmark) {
        setEditingBookmark(null)
        setBookmarkEditError('')
        return
      }
      if (confirmDialog) {
        setConfirmDialog(null)
        return
      }
      window.api.hidePanel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingBookmark, confirmDialog, panelType, showToast])

  useEffect(() => {
    if (panelType === 'bookmarks') {
      loadBookmarkManager().catch(console.error)
    } else if (panelType === 'history') {
      window.api.getHistory(200).then((items) => {
        setHistoryItems(items)
        setSelectedHistoryIds(new Set())
      })
    } else if (panelType === 'downloads') {
      window.api.getBrowserState().then(setBrowserState)
    } else if (panelType === 'proxy') {
      window.api.getSettings().then((loaded) => {
        setSettings(loaded)
        setProxySubscriptionInput(loaded.proxy.subscriptionUrl)
      })
      loadProxyState().catch(console.error)
    } else if (panelType === 'settings') {
      window.api.getSettings().then((loaded) => {
        setSettings(loaded)
      })
      window.api.downloaderDetect().then(setDetectedDownloaders).catch(console.error)
      window.api.passwordsGetAll().then(setPasswordItems).catch(console.error)
    } else if (panelType === 'about') {
      window.api.getAboutInfo().then(setAboutInfo).catch(console.error)
    } else if (panelType === 'ai') {
      Promise.resolve()
        .then(refreshAIContext)
        .catch(() => {
          /* context is optional */
        })
    } else if (panelType === 'scripts') {
      loadUserScripts().catch(console.error)
    } else if (panelType === 'sniffer') {
      loadSniffedResources().catch(console.error)
    } else if (panelType === 'webpanel') {
      loadSavedWebPanels().catch(console.error)
    }
  }, [
    panelType,
    refreshAIContext,
    settings?.ai.enabled,
    settings?.ai.baseUrl,
    settings?.ai.apiKey,
    settings?.ai.model,
    settings?.ai.maxInputChars
  ])

  const filteredBookmarks = bookmarkQuery
    ? bookmarks.filter(
        (b) =>
          b.url.toLowerCase().includes(bookmarkQuery.toLowerCase()) ||
          b.title.toLowerCase().includes(bookmarkQuery.toLowerCase())
      )
    : bookmarks
  const filteredHistory = historyQuery
    ? historyItems.filter(
        (h) =>
          h.url.toLowerCase().includes(historyQuery.toLowerCase()) ||
          h.title.toLowerCase().includes(historyQuery.toLowerCase())
      )
    : historyItems
  const groupedHistory = filteredHistory.reduce<Array<{ label: string; items: HistoryItem[] }>>(
    (groups, item) => {
      const label = new Date(item.visitedAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      const group = groups.find((entry) => entry.label === label)
      if (group) {
        group.items.push(item)
      } else {
        groups.push({ label, items: [item] })
      }
      return groups
    },
    []
  )
  const folderFilteredBookmarks = bookmarkFolderFilter
    ? filteredBookmarks.filter((bookmark) => (bookmark.folder || '未分类') === bookmarkFolderFilter)
    : filteredBookmarks
  const filteredDownloads = downloadQuery
    ? browserState.downloads.filter(
        (d) =>
          d.url.toLowerCase().includes(downloadQuery.toLowerCase()) ||
          d.filename.toLowerCase().includes(downloadQuery.toLowerCase()) ||
          d.savePath.toLowerCase().includes(downloadQuery.toLowerCase())
      )
    : browserState.downloads
  const filteredPasswords = passwordQuery
    ? passwordItems.filter(
        (item) =>
          item.title.toLowerCase().includes(passwordQuery.toLowerCase()) ||
          item.url.toLowerCase().includes(passwordQuery.toLowerCase()) ||
          item.username.toLowerCase().includes(passwordQuery.toLowerCase())
      )
    : passwordItems
  const canUseAI = Boolean(aiStatus?.enabled && aiStatus.configured)
  const aiUnavailableText = !aiStatus?.enabled
    ? '请在 AI 设置中启用 AI 功能。'
    : !aiStatus?.configured
      ? '请在 AI 设置中完成 Base URL、API Key 和模型名称。'
      : ''
  const activeAIPageTab = browserState.tabs.find((tab) => tab.id === browserState.activeTabId)
  const aiPageInfo = activeAIPageTab
    ? {
        title: activeAIPageTab.title || '无标题',
        url: activeAIPageTab.url || '当前页面'
      }
    : null

  function closePanel(): void {
    if (panelType === 'ai') {
      setAiShowSettings(false)
      setAiError(null)
    }
    window.api.hidePanel()
  }

  function handleOpenBookmark(url: string, newTab = false): void {
    window.api.openUrl(url, newTab)
    closePanel()
  }

  function handleOpenHistory(url: string, newTab = false): void {
    window.api.openUrl(url, newTab)
    closePanel()
  }

  function handleCopyUrl(url: string, e?: React.MouseEvent): void {
    e?.stopPropagation()
    window.api
      .copyToClipboard(url)
      .then(() => showToast('已复制到剪贴板'))
      .catch(console.error)
  }

  function handleDeleteBookmark(url: string, e: React.MouseEvent): void {
    e.stopPropagation()
    requestConfirm('删除这条书签？', '删了就没了，不会进回收站。', '确认删除', async () => {
      await window.api.removeBookmark(url)
      await loadBookmarkManager()
      showToast('书签已删除')
    })
  }

  function handleEditBookmark(bookmark: BookmarkItem, e: React.MouseEvent): void {
    e.stopPropagation()
    setEditingBookmark({
      id: bookmark.id || bookmark.url,
      title: bookmark.title || bookmark.url,
      url: bookmark.url,
      folder: bookmark.folder || '未分类'
    })
    setBookmarkEditError('')
  }

  async function handleSaveBookmark(): Promise<void> {
    if (!editingBookmark) return
    const title = editingBookmark.title.trim()
    const url = editingBookmark.url.trim()
    if (!title || !url) {
      setBookmarkEditError('名称和地址都要填。')
      return
    }

    const result = await window.api.bookmarksUpdate(editingBookmark.id, {
      title,
      url,
      folder: editingBookmark.folder || '未分类'
    })
    if (!result.success) {
      setBookmarkEditError('保存失败，请检查地址。')
      return
    }
    await loadBookmarkManager()
    setEditingBookmark(null)
    setBookmarkEditError('')
    showToast('书签已更新')
  }

  function handleClearBookmarks(): void {
    requestConfirm('清空所有书签？', '全部删掉，一条不留。想好了？', '确认删除', async () => {
      await window.api.clearBookmarks()
      await loadBookmarkManager()
      showToast('已处理')
    })
  }

  async function handleToggleBookmarkBar(): Promise<void> {
    const visible = await window.api.toggleBookmarkBar()
    setShowBookmarkBar(visible)
    showToast(visible ? '已显示书签栏' : '已隐藏书签栏')
  }

  async function handleToggleDarkMode(): Promise<void> {
    const newState = await window.api.toggleDarkMode()
    setWebDarkMode(newState)
    showToast(newState ? '网页暗色模式已开启' : '网页暗色模式已关闭')
  }

  function handleRemoveHistoryEntry(item: HistoryItem, e: React.MouseEvent): void {
    e.stopPropagation()
    requestConfirm('删除这条记录？', '只删这一条，其他不动。', '清空', async () => {
      await window.api.removeHistoryEntry(item.id || item.url)
      const updated = await window.api.getHistory(200)
      setHistoryItems(updated)
      setSelectedHistoryIds((current) => {
        const next = new Set(current)
        next.delete(item.id || item.url)
        return next
      })
      showToast('已清除')
    })
  }

  async function handleClearHistory(): Promise<void> {
    requestConfirm(
      '清空全部历史？',
      '确认清空历史记录？清完就真没了，别回头问我刚才看过啥。',
      '清空',
      async () => {
        await window.api.clearHistory()
        setHistoryItems([])
        setSelectedHistoryIds(new Set())
        showToast('历史已清空')
      }
    )
  }

  async function handleOpenDownloadFile(downloadId: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    try {
      await window.api.openDownloadFile(downloadId)
    } catch {
      showToast('文件打不开，可能已被移动或删除。', 'error')
    }
  }

  async function handleShowDownloadInFolder(
    downloadId: string,
    e: React.MouseEvent
  ): Promise<void> {
    e.stopPropagation()
    try {
      await window.api.showDownloadInFolder(downloadId)
    } catch {
      showToast('文件打不开，可能已被移动或删除。', 'error')
    }
  }

  function handleRemoveDownload(downloadId: string, e: React.MouseEvent): void {
    e.stopPropagation()
    requestConfirm('从列表移除？', '只移除记录，不删文件。', '确认删除', async () => {
      await window.api.removeDownload(downloadId)
      const downloads = await window.api.getDownloads()
      setBrowserState((current) => ({ ...current, downloads }))
      showToast('已处理')
    })
  }

  function handleClearDownloads(): void {
    requestConfirm(
      '清空全部下载记录？',
      '清除所有记录。已下载的文件还在磁盘上，放心。',
      '清空',
      async () => {
        await window.api.clearDownloads()
        setBrowserState((current) => ({ ...current, downloads: [] }))
        showToast('下载记录已清空')
      }
    )
  }

  function handleUpdateSettings(partial: DeepPartial<BrowserSettings>): void {
    window.api
      .updateSettings(partial)
      .then((updated) => {
        setSettings(updated)
        setProxySubscriptionInput(updated.proxy.subscriptionUrl)
        showToast('已保存')
      })
      .catch(console.error)
  }

  async function handleHibernationPrefsUpdate(
    patch: Partial<{ enabled: boolean; timeoutMinutes: number; whitelist: string[] }>
  ): Promise<void> {
    const next = { ...hibernationPrefs, ...patch }
    setHibernationPrefs(next)
    await window.api.hibernationSetPrefs(next)
    handleUpdateSettings({ hibernation: next })
  }

  async function loadBookmarkManager(): Promise<void> {
    const [items, folders] = await Promise.all([
      window.api.getBookmarks(),
      window.api.bookmarksGetFolders()
    ])
    setBookmarks(items)
    setBookmarkFolders(folders.length > 0 ? folders : ['未分类'])
  }

  async function handleAddManagedBookmark(): Promise<void> {
    const url = newBookmark.url.trim()
    const title = newBookmark.title.trim() || url
    const folder = newBookmark.folder.trim() || '未分类'
    if (!url) {
      showToast('先填书签地址', 'error')
      return
    }
    const result = await window.api.bookmarksAdd({ url, title, folder })
    if (result.success) {
      setNewBookmark({ title: '', url: '', folder })
      await loadBookmarkManager()
      showToast('书签已添加')
    } else {
      showToast('添加书签失败', 'error')
    }
  }

  function toggleHistorySelection(id: string): void {
    setSelectedHistoryIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleDeleteSelectedHistory(): Promise<void> {
    const ids = [...selectedHistoryIds]
    if (ids.length === 0) return
    const result = await window.api.historyDelete(ids)
    if (result.success) {
      const updated = await window.api.getHistory(200)
      setHistoryItems(updated)
      setSelectedHistoryIds(new Set())
      showToast('已删除选中历史')
    } else {
      showToast('删除失败', 'error')
    }
  }

  async function loadPasswordItems(): Promise<void> {
    const items = passwordQuery
      ? await window.api.passwordsSearch(passwordQuery)
      : await window.api.passwordsGetAll()
    setPasswordItems(items)
  }

  function resetPasswordForm(): void {
    setPasswordForm({ id: '', title: '', url: '', username: '', password: '' })
  }

  async function handleSavePassword(): Promise<void> {
    const url = passwordForm.url.trim()
    const username = passwordForm.username.trim()
    const password = passwordForm.password
    const title = passwordForm.title.trim() || url
    if (!url || !username || (!passwordForm.id && !password)) {
      showToast('网站、用户名和密码都要填', 'error')
      return
    }

    const result = passwordForm.id
      ? await window.api.passwordsUpdate(passwordForm.id, {
          url,
          username,
          title,
          ...(password ? { password } : {})
        })
      : await window.api.passwordsAdd({ url, username, password, title })

    if (result.success) {
      resetPasswordForm()
      await loadPasswordItems()
      showToast(passwordForm.id ? '密码已更新' : '密码已保存')
    } else {
      showToast('保存密码失败', 'error')
    }
  }

  async function handleRevealPassword(id: string): Promise<void> {
    const value = await window.api.passwordsGetPassword(id)
    if (!value) {
      showToast('无法读取密码', 'error')
      return
    }
    setVisiblePassword({ id, value })
    if (passwordRevealTimer.current) clearTimeout(passwordRevealTimer.current)
    passwordRevealTimer.current = setTimeout(() => setVisiblePassword(null), 3000)
  }

  function handleEditPassword(item: PasswordListItem): void {
    setPasswordForm({
      id: item.id,
      title: item.title,
      url: item.url,
      username: item.username,
      password: ''
    })
  }

  function handleDeletePassword(id: string): void {
    requestConfirm('删除这条密码？', '只会删除本机保存的这条登录信息。', '删除', async () => {
      const result = await window.api.passwordsDelete(id)
      if (result.success) {
        await loadPasswordItems()
        showToast('密码已删除')
      } else {
        showToast('删除失败', 'error')
      }
    })
  }

  function getDelayClass(delay: number | null | undefined): string {
    if (delay === null || delay === undefined || delay < 0) return 'delay-timeout'
    if (delay < 150) return 'delay-fast'
    if (delay <= 300) return 'delay-medium'
    return 'delay-slow'
  }

  async function loadProxyState(): Promise<void> {
    const [status, groups] = await Promise.all([
      window.api.proxyStatus(),
      window.api.proxyGetGroups()
    ])
    setProxyStatus(status)
    setProxyGroups(groups)
    const nextGroup = selectedProxyGroup || groups[0]?.name || ''
    setSelectedProxyGroup(nextGroup)
    if (nextGroup) {
      const nodes = await window.api.proxyGetNodes(nextGroup)
      setProxyNodes(nodes)
    } else {
      setProxyNodes([])
    }
  }

  async function loadProxyNodes(group: string): Promise<void> {
    setSelectedProxyGroup(group)
    if (!group) {
      setProxyNodes([])
      return
    }
    const nodes = await window.api.proxyGetNodes(group)
    setProxyNodes(nodes)
  }

  async function handleProxyToggle(enabled: boolean): Promise<void> {
    const result = await window.api.proxyToggle(enabled)
    if (result.success) {
      const updated = await window.api.getSettings()
      setSettings(updated)
      setProxySubscriptionInput(updated.proxy.subscriptionUrl)
      await loadProxyState()
      showToast(enabled ? '代理已启用' : '代理已关闭')
    } else {
      showToast(result.error || '代理切换失败', 'error')
    }
  }

  async function handleUpdateProxySubscription(): Promise<void> {
    const url = proxySubscriptionInput.trim()
    if (!url) {
      showToast('先填订阅链接', 'error')
      return
    }
    setProxyUpdating(true)
    try {
      const result = await window.api.proxyUpdateSubscription(url)
      if (result.success) {
        const updated = await window.api.getSettings()
        setSettings(updated)
        await loadProxyState()
        showToast(`订阅已更新，共 ${result.nodeCount || 0} 个节点`)
      } else {
        showToast(result.error || '订阅更新失败', 'error')
      }
    } finally {
      setProxyUpdating(false)
    }
  }

  async function handleProxyTestAll(): Promise<void> {
    if (!selectedProxyGroup) return
    const result = await window.api.proxyTestAllDelay(selectedProxyGroup)
    setProxyDelayMap(result)
    await loadProxyNodes(selectedProxyGroup)
  }

  async function handleProxySwitch(node: string): Promise<void> {
    if (!selectedProxyGroup) return
    const result = await window.api.proxySwitch(selectedProxyGroup, node)
    if (result.success) {
      await loadProxyState()
      showToast('节点已切换')
    } else {
      showToast('节点切换失败', 'error')
    }
  }

  async function refreshProxyLogs(): Promise<void> {
    const logs = await window.api.proxyGetLogs()
    setProxyLogs(logs)
    setProxyLogsVisible(true)
  }

  async function loadUserScripts(): Promise<void> {
    const scripts = await window.api.userscriptGetAll()
    setUserScripts(scripts)
  }

  async function handleToggleUserScript(id: string, enabled: boolean): Promise<void> {
    await window.api.userscriptToggle(id, enabled)
    await loadUserScripts()
    showToast(enabled ? '脚本已启用' : '脚本已停用')
  }

  function handleRemoveUserScript(id: string): void {
    requestConfirm('删除这个用户脚本？', '删除后脚本文件和配置会从本机移除。', '删除', async () => {
      await window.api.userscriptRemove(id)
      await loadUserScripts()
      showToast('脚本已删除')
    })
  }

  async function handleInstallFromUrl(): Promise<void> {
    if (!scriptInstallUrl.trim()) return
    const result = await window.api.userscriptInstallFromUrl(scriptInstallUrl.trim())
    if (result.success) {
      setScriptInstallUrl('')
      await loadUserScripts()
      showToast('脚本已安装')
    } else {
      showToast(result.error || '安装失败', 'error')
    }
  }

  async function handleUpdateUserScript(id: string): Promise<void> {
    const result = await window.api.userscriptUpdate(id)
    await loadUserScripts()
    showToast(
      result.success ? `已更新到 ${result.newVersion}` : result.error || '无需更新',
      result.success ? 'success' : 'info'
    )
  }

  async function loadSniffedResources(): Promise<void> {
    const resources = await window.api.snifferGetResources()
    setSniffedResources(resources)
  }

  async function handleCopyResource(resource: SniffedResource): Promise<void> {
    await window.api.copyToClipboard(resource.url)
    showToast('链接已复制')
  }

  async function handleDownloadResource(resource: SniffedResource): Promise<void> {
    const result = await window.api.downloaderSend({
      url: resource.url,
      filename: resource.filename
    })
    showToast(
      result.success ? '已发送到下载器' : result.error || '发送失败',
      result.success ? 'success' : 'error'
    )
  }

  async function loadSavedWebPanels(): Promise<void> {
    try {
      const panels = await window.api.webPanelGetAll()
      const visible = await window.api.webPanelIsVisible()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSavedWebPanels(panels.map((p: any) => ({ url: p.url, title: p.name, pinned: true })))
      setWebPanelVisible(visible)
    } catch {
      /* ignore */
    }
  }

  async function handleOpenWebPanel(url: string): Promise<void> {
    const result = await window.api.webPanelToggle(url)
    if (result.visible) {
      setWebPanelVisible(true)
      await loadSavedWebPanels()
      showToast('网页面板已打开')
    }
  }

  async function handleCloseWebPanel(): Promise<void> {
    await window.api.webPanelHide()
    setWebPanelVisible(false)
    showToast('网页面板已关闭')
  }

  async function handleAddWebPanel(): Promise<void> {
    if (!webPanelInput.trim()) return
    let url = webPanelInput.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }
    await handleOpenWebPanel(url)
    setWebPanelInput('')
  }

  async function handleRemoveWebPanel(url: string): Promise<void> {
    try {
      const panels = await window.api.webPanelGetAll()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const panel = panels.find((p: any) => p.url === url)
      if (panel) {
        await window.api.webPanelRemove(panel.id)
      }
      await loadSavedWebPanels()
      showToast('已移除')
    } catch {
      /* ignore */
    }
  }

  function handleUpdateAISettings(patch: Partial<BrowserSettings['ai']>): void {
    if (!settings) return
    const nextAI = { ...settings.ai, ...patch }
    setAiError(null)
    setAiStatus({
      enabled: nextAI.enabled,
      configured: Boolean(nextAI.baseUrl && nextAI.apiKey && nextAI.model)
    })
    handleUpdateSettings({ ai: nextAI })
  }

  async function handleTestAIConnection(): Promise<void> {
    try {
      const result = await window.api.testAIConnection()
      if (result?.success) {
        showToast('AI 连接测试成功')
      } else {
        showToast(result?.error || 'AI 连接测试失败', 'error')
      }
    } catch {
      showToast('AI 连接测试失败', 'error')
    } finally {
      refreshAIContext().catch(() => undefined)
    }
  }

  async function handleSelectDownloadPath(): Promise<void> {
    const selected = await window.api.selectDownloadPath()
    if (selected) {
      handleUpdateSettings({ downloadPath: selected })
    }
  }

  function handleResetSettings(): void {
    requestConfirm(
      '恢复默认设置？',
      '所有设置项会回到初始值。书签、历史、下载记录不受影响。',
      '恢复',
      async () => {
        const updated = await window.api.resetSettings()
        setSettings(updated)
        showToast('已恢复默认设置')
      },
      '算了'
    )
  }

  async function handleExportSettings(): Promise<void> {
    const result = await window.api.exportSettings()
    showToast(
      result.success ? '偏好设置已导出' : result.error || '已取消导出',
      result.success ? 'success' : 'info'
    )
  }

  async function handleImportSettings(): Promise<void> {
    const result = await window.api.importSettings()
    if (result.success && result.prefs) {
      setSettings(result.prefs)
      showToast('偏好设置已导入')
    } else {
      showToast(result.error || '已取消导入', result.error ? 'error' : 'info')
    }
  }

  async function handleAdBlockToggle(enabled: boolean): Promise<void> {
    const state = await window.api.setAdBlockEnabled(enabled)
    setAdBlockState(state)
    setSettings((current) => (current ? { ...current, adblock: state } : current))
    showToast(enabled ? '已启用 AdBlock Zhi' : '已关闭 AdBlock Zhi')
  }

  async function handleAdBlockWhitelistToggle(): Promise<void> {
    if (!currentAdBlockSite?.canWhitelist) return
    const state = await window.api.toggleCurrentSiteAdBlockWhitelist()
    setAdBlockState(state)
    const isWhitelisted = state.whitelist.includes(currentAdBlockSite.hostname)
    showToast(
      isWhitelisted ? '已将当前网站加入 AdBlock Zhi 白名单' : '已将当前网站移出 AdBlock Zhi 白名单'
    )
    window.api.getCurrentSiteForAdBlock().then(setCurrentAdBlockSite).catch(console.error)
  }

  async function handleRemoveAdBlockWhitelist(hostname: string): Promise<void> {
    const state = await window.api.removeAdBlockWhitelist(hostname)
    setAdBlockState(state)
    showToast('已将当前网站移出 AdBlock Zhi 白名单')
  }

  async function handleClearAdBlockCount(): Promise<void> {
    const state = await window.api.clearAdBlockCount()
    setAdBlockState(state)
    showToast('已清空 AdBlock Zhi 拦截计数')
  }

  async function handleOpenUserDataFolder(): Promise<void> {
    await window.api.openUserDataFolder()
    showToast('已打开数据目录')
  }

  async function handleCopyAboutInfo(aboutInfo: AboutInfo): Promise<void> {
    await window.api.copyToClipboard(formatAboutInfo(aboutInfo))
    showToast('版本信息已复制')
  }

  function formatSniffedSize(size: string | null): string {
    if (!size) return '未知大小'
    const value = Number.parseInt(size, 10)
    return Number.isFinite(value) ? formatBytes(value) : size
  }

  function getResourceIcon(type: SniffedResource['resourceType']): string {
    switch (type) {
      case 'video':
        return '▶'
      case 'audio':
        return '♪'
      case 'document':
        return 'PDF'
      case 'archive':
        return 'ZIP'
      default:
        return '•'
    }
  }

  async function handleConfirmDialog(): Promise<void> {
    const dialog = confirmDialog
    if (!dialog) return
    try {
      await dialog.onConfirm()
    } catch (error) {
      console.error(error)
    } finally {
      setConfirmDialog(null)
    }
  }

  return (
    <div className="panel-only-shell">
      <div className={`panel panel-only-panel ${panelType}-panel`}>
        {panelType === 'bookmarks' && (
          <>
            <div className="panel-header">
              <h3>书签</h3>
              <button
                className={`panel-header-btn ${showBookmarkBar ? 'active' : ''}`}
                onClick={() => handleToggleBookmarkBar().catch(console.error)}
                title={showBookmarkBar ? '隐藏书签栏 (Ctrl+Shift+B)' : '显示书签栏 (Ctrl+Shift+B)'}
              >
                {showBookmarkBar ? '隐藏书签栏' : '显示书签栏'}
              </button>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-search-wrap">
              <input
                className="panel-search"
                type="text"
                value={bookmarkQuery}
                onChange={(e) => setBookmarkQuery(e.target.value)}
                placeholder="搜索书签"
              />
            </div>
            <div className="bookmark-manager-tools">
              <select
                value={bookmarkFolderFilter}
                onChange={(e) => setBookmarkFolderFilter(e.target.value)}
              >
                <option value="">全部文件夹</option>
                {bookmarkFolders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newBookmark.folder}
                onChange={(e) =>
                  setNewBookmark((current) => ({ ...current, folder: e.target.value }))
                }
                placeholder="新建/选择文件夹"
              />
            </div>
            <div className="bookmark-add-form">
              <input
                type="text"
                value={newBookmark.title}
                onChange={(e) =>
                  setNewBookmark((current) => ({ ...current, title: e.target.value }))
                }
                placeholder="标题"
              />
              <input
                type="text"
                value={newBookmark.url}
                onChange={(e) => setNewBookmark((current) => ({ ...current, url: e.target.value }))}
                placeholder="https://example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddManagedBookmark().catch(console.error)
                }}
              />
              <button onClick={() => handleAddManagedBookmark().catch(console.error)}>新增</button>
            </div>
            <div className="panel-list">
              {folderFilteredBookmarks.length === 0 && (
                <div className="panel-empty">
                  {getPanelEmptyText(
                    bookmarks.length,
                    folderFilteredBookmarks.length,
                    '书签夹空空如也。喜欢就收藏，别装清高。',
                    '没找到，换个关键词试试。'
                  )}
                </div>
              )}
              {folderFilteredBookmarks.map((b) => (
                <div
                  key={b.id || b.url}
                  className="panel-item"
                  onMouseMove={handlePanelSpotlightMove}
                  onClick={() => handleOpenBookmark(b.url)}
                >
                  {b.favicon ? (
                    <img
                      className="panel-item-icon"
                      src={b.favicon}
                      alt=""
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="panel-item-icon panel-item-icon-fallback" />
                  )}
                  <div className="panel-item-main">
                    <span className="panel-item-title">{b.title || b.url}</span>
                    <span className="panel-item-url">{b.url}</span>
                    <span className="panel-item-time">{b.folder || '未分类'}</span>
                  </div>
                  <div className="panel-item-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenBookmark(b.url)
                      }}
                    >
                      打开
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenBookmark(b.url, true)
                      }}
                    >
                      新标签打开
                    </button>
                    <button onClick={(e) => handleEditBookmark(b, e)}>编辑</button>
                    <button onClick={(e) => handleCopyUrl(b.url, e)}>复制</button>
                    <button onClick={(e) => handleDeleteBookmark(b.url, e)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
            {bookmarks.length > 0 && (
              <div className="panel-footer">
                <button className="panel-action-btn" onClick={handleClearBookmarks}>
                  清空全部
                </button>
              </div>
            )}
          </>
        )}

        {panelType === 'history' && (
          <>
            <div className="panel-header">
              <h3>历史</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-search-wrap">
              <input
                className="panel-search"
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="搜索历史记录"
              />
            </div>
            <div className="history-manager-tools">
              <span>
                {selectedHistoryIds.size > 0 ? `已选 ${selectedHistoryIds.size} 条` : '按日期分组'}
              </span>
              <button
                disabled={selectedHistoryIds.size === 0}
                onClick={() => handleDeleteSelectedHistory().catch(console.error)}
              >
                删除选中
              </button>
            </div>
            <div className="panel-list">
              {filteredHistory.length === 0 && (
                <div className="panel-empty">
                  {getPanelEmptyText(
                    historyItems.length,
                    filteredHistory.length,
                    '还没有浏览记录。上网了才有历史，道理大家都懂。',
                    '没找到相关记录。'
                  )}
                </div>
              )}
              {groupedHistory.map((group) => (
                <div className="history-date-group" key={group.label}>
                  <div className="history-date-title">{group.label}</div>
                  {group.items.map((h, i) => {
                    const id = h.id || h.url
                    return (
                      <div
                        key={h.id || `${h.url}-${i}`}
                        className="panel-item history-managed-item"
                        onMouseMove={handlePanelSpotlightMove}
                        onClick={() => handleOpenHistory(h.url)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedHistoryIds.has(id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleHistorySelection(id)}
                        />
                        {h.favicon ? (
                          <img className="panel-item-icon" src={h.favicon} alt="" />
                        ) : (
                          <span className="panel-item-icon panel-item-icon-fallback" />
                        )}
                        <div className="panel-item-main">
                          <span className="panel-item-title">{h.title || h.url}</span>
                          <span className="panel-item-url">{h.url}</span>
                          <span className="panel-item-time">
                            {new Date(h.visitedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="panel-item-actions">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenHistory(h.url)
                            }}
                          >
                            打开
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenHistory(h.url, true)
                            }}
                          >
                            新标签打开
                          </button>
                          <button onClick={(e) => handleCopyUrl(h.url, e)}>复制</button>
                          <button onClick={(e) => handleRemoveHistoryEntry(h, e)}>删除</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            {historyItems.length > 0 && (
              <div className="panel-footer">
                <button className="panel-action-btn" onClick={() => handleClearHistory()}>
                  清空全部
                </button>
              </div>
            )}
          </>
        )}

        {panelType === 'downloads' && (
          <>
            <div className="panel-header">
              <h3>下载</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-search-wrap">
              <input
                className="panel-search"
                type="text"
                value={downloadQuery}
                onChange={(e) => setDownloadQuery(e.target.value)}
                placeholder="搜索下载记录"
              />
            </div>
            <div className="panel-list">
              {filteredDownloads.length === 0 && (
                <div className="panel-empty">
                  {getPanelEmptyText(
                    browserState.downloads.length,
                    filteredDownloads.length,
                    '还没下载过东西。',
                    '没找到匹配项。'
                  )}
                </div>
              )}
              {filteredDownloads.map((d) => (
                <div
                  key={d.id}
                  className="panel-item download-item"
                  onMouseMove={handlePanelSpotlightMove}
                >
                  <div className="download-head">
                    <span className="download-filename">{d.filename || '未命名文件'}</span>
                    <span className={`download-status status-${d.state}`}>
                      {getDownloadProgress(d)}
                    </span>
                  </div>
                  {d.state === 'progressing' && d.totalBytes > 0 && (
                    <div className="download-progress">
                      <div
                        className="download-progress-bar"
                        style={{ width: `${(d.receivedBytes / d.totalBytes) * 100}%` }}
                      />
                    </div>
                  )}
                  <span className="download-meta">
                    {formatBytes(d.receivedBytes || d.totalBytes)}
                    {d.totalBytes > 0 ? ` / ${formatBytes(d.totalBytes)}` : ''} ·{' '}
                    {new Date(d.startedAt).toLocaleString()}
                  </span>
                  <span className="download-path">{d.savePath || '还没有保存路径'}</span>
                  <span className="download-url">{d.url}</span>
                  <div className="download-actions">
                    <button disabled={!d.savePath} onClick={(e) => handleOpenDownloadFile(d.id, e)}>
                      打开
                    </button>
                    <button
                      disabled={!d.savePath}
                      onClick={(e) => handleShowDownloadInFolder(d.id, e)}
                    >
                      打开目录
                    </button>
                    <button onClick={(e) => handleCopyUrl(d.url, e)}>复制链接</button>
                    <button onClick={(e) => handleRemoveDownload(d.id, e)}>移除</button>
                  </div>
                </div>
              ))}
            </div>
            {browserState.downloads.length > 0 && (
              <div className="panel-footer">
                <button className="panel-action-btn" onClick={handleClearDownloads}>
                  清空全部
                </button>
              </div>
            )}
          </>
        )}

        {panelType === 'scripts' && (
          <>
            <div className="panel-header">
              <h3>用户脚本</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="script-install-bar">
              <input
                type="text"
                className="script-install-input"
                placeholder="输入 .user.js 链接安装..."
                value={scriptInstallUrl}
                onChange={(e) => setScriptInstallUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInstallFromUrl().catch(console.error)
                }}
              />
              <button
                className="script-install-btn"
                onClick={() => handleInstallFromUrl().catch(console.error)}
              >
                安装
              </button>
            </div>
            <div className="script-tip">
              <span>访问 Greasy Fork 点击脚本安装按钮，或粘贴 .user.js 链接。</span>
            </div>
            <div className="panel-list">
              {userScripts.length === 0 ? (
                <div className="panel-empty-state">
                  <p>暂无已安装的脚本</p>
                  <p>从 Greasy Fork 安装脚本或粘贴链接</p>
                </div>
              ) : (
                <div className="script-list">
                  {userScripts.map((script) => (
                    <div
                      key={script.id}
                      className={`script-item ${script.enabled ? '' : 'disabled'}`}
                    >
                      <div className="script-item-header">
                        <label className="script-toggle">
                          <input
                            type="checkbox"
                            checked={script.enabled}
                            onChange={(e) =>
                              handleToggleUserScript(script.id, e.target.checked).catch(
                                console.error
                              )
                            }
                          />
                          <span className="script-toggle-slider"></span>
                        </label>
                        <span className="script-name">{script.meta.name}</span>
                        <span className="script-version">v{script.meta.version}</span>
                      </div>
                      <div className="script-item-desc">{script.meta.description}</div>
                      <div className="script-item-meta">
                        <span className="script-author">{script.meta.author}</span>
                        <span className="script-match">
                          {script.meta.match.slice(0, 2).join(', ')}
                          {script.meta.match.length > 2 ? '...' : ''}
                        </span>
                      </div>
                      <div className="script-item-actions">
                        <button
                          className="script-action-btn"
                          onClick={() => handleUpdateUserScript(script.id).catch(console.error)}
                        >
                          更新
                        </button>
                        <button
                          className="script-action-btn danger"
                          onClick={() => handleRemoveUserScript(script.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {panelType === 'sniffer' && (
          <>
            <div className="panel-header">
              <h3>资源嗅探</h3>
              <button
                className="panel-header-btn"
                onClick={() => loadSniffedResources().catch(console.error)}
              >
                刷新
              </button>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list sniffer-list">
              {sniffedResources.length === 0 ? (
                <div className="panel-empty-state">
                  <p>当前标签页暂无可下载资源</p>
                  <p>播放视频、音频或打开文件链接后会显示在这里</p>
                </div>
              ) : (
                sniffedResources.map((resource) => (
                  <div className="sniffer-item" key={resource.id}>
                    <div className="sniffer-resource-icon">
                      {getResourceIcon(resource.resourceType)}
                    </div>
                    <div className="sniffer-resource-main">
                      <div className="sniffer-resource-name">{resource.filename}</div>
                      <div className="sniffer-resource-meta">
                        {resource.resourceType} · {formatSniffedSize(resource.size)}
                      </div>
                      <div className="sniffer-resource-url">{resource.url}</div>
                    </div>
                    <div className="sniffer-resource-actions">
                      <button onClick={() => handleCopyResource(resource).catch(console.error)}>
                        复制
                      </button>
                      <button onClick={() => handleDownloadResource(resource).catch(console.error)}>
                        下载
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {panelType === 'webpanel' && (
          <>
            <div className="panel-header">
              <h3>网页面板</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list">
              <div className="webpanel-input-bar">
                <input
                  type="text"
                  className="webpanel-input"
                  placeholder="输入网址添加面板..."
                  value={webPanelInput}
                  onChange={(e) => setWebPanelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddWebPanel().catch(console.error)
                  }}
                />
                <button
                  className="webpanel-add-btn"
                  onClick={() => handleAddWebPanel().catch(console.error)}
                >
                  添加
                </button>
              </div>

              <div className="webpanel-presets">
                <div className="webpanel-preset-title">常用面板</div>
                <div className="webpanel-preset-grid">
                  <button
                    className="webpanel-preset-item"
                    onClick={() =>
                      handleOpenWebPanel('https://chat.openai.com').catch(console.error)
                    }
                  >
                    <span className="webpanel-preset-icon">AI</span>
                    <span className="webpanel-preset-label">ChatGPT</span>
                  </button>
                  <button
                    className="webpanel-preset-item"
                    onClick={() =>
                      handleOpenWebPanel('https://translate.google.com').catch(console.error)
                    }
                  >
                    <span className="webpanel-preset-icon">译</span>
                    <span className="webpanel-preset-label">翻译</span>
                  </button>
                  <button
                    className="webpanel-preset-item"
                    onClick={() => handleOpenWebPanel('https://wx.qq.com').catch(console.error)}
                  >
                    <span className="webpanel-preset-icon">微</span>
                    <span className="webpanel-preset-label">微信</span>
                  </button>
                  <button
                    className="webpanel-preset-item"
                    onClick={() => handleOpenWebPanel('https://music.163.com').catch(console.error)}
                  >
                    <span className="webpanel-preset-icon">乐</span>
                    <span className="webpanel-preset-label">网易云</span>
                  </button>
                </div>
              </div>

              {savedWebPanels.length > 0 && (
                <div className="webpanel-saved">
                  <div className="webpanel-saved-title">已保存</div>
                  {savedWebPanels.map((panel) => (
                    <div key={panel.url} className="webpanel-saved-item">
                      <button
                        className="webpanel-saved-open"
                        onClick={() => handleOpenWebPanel(panel.url).catch(console.error)}
                      >
                        {panel.title || panel.url}
                      </button>
                      <button
                        className="webpanel-saved-remove"
                        onClick={() => handleRemoveWebPanel(panel.url).catch(console.error)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {webPanelVisible && (
                <div className="webpanel-status">
                  <span className="webpanel-status-dot"></span>
                  <span className="webpanel-status-text">面板运行中</span>
                  <button
                    className="webpanel-status-close"
                    onClick={() => handleCloseWebPanel().catch(console.error)}
                  >
                    关闭
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {panelType === 'proxy' && (
          <>
            <div className="panel-header">
              <h3>代理</h3>
              <button
                className="panel-header-btn"
                onClick={() => loadProxyState().catch(console.error)}
              >
                刷新
              </button>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list settings-list proxy-panel-list">
              {!settings && <SkeletonRows rows={4} />}
              {settings && (
                <>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>启用代理</span>
                      <p>
                        {proxyStatus?.running ? 'mihomo 内核运行中。' : '启用前需要先更新订阅。'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.proxy.enabled}
                      onChange={(e) => handleProxyToggle(e.target.checked).catch(console.error)}
                    />
                  </label>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>浏览器启动时自动连接</span>
                      <p>启动后自动拉起已生成的 mihomo 配置。</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.proxy.autoStart}
                      onChange={(e) =>
                        handleUpdateSettings({ proxy: { autoStart: e.target.checked } })
                      }
                    />
                  </label>
                  <div className="settings-row proxy-subscription-row">
                    <div className="settings-copy">
                      <label>订阅链接</label>
                      <p>
                        {settings.proxy.lastUpdated
                          ? `上次更新 ${new Date(settings.proxy.lastUpdated).toLocaleString()}`
                          : '尚未更新订阅'}
                      </p>
                    </div>
                    <div className="settings-path-row">
                      <input
                        type="text"
                        value={proxySubscriptionInput}
                        onChange={(e) => setProxySubscriptionInput(e.target.value)}
                        placeholder="https://..."
                      />
                      <button
                        disabled={proxyUpdating}
                        onClick={() => handleUpdateProxySubscription().catch(console.error)}
                      >
                        {proxyUpdating ? '更新中' : '更新订阅'}
                      </button>
                    </div>
                  </div>
                  <div className="settings-row proxy-ports-row">
                    <div className="settings-copy">
                      <label>端口与密钥</label>
                      <p>Mixed 端口供浏览器代理使用，API 端口供节点切换使用。</p>
                    </div>
                    <div className="proxy-port-grid">
                      <input
                        type="number"
                        value={settings.proxy.mixedPort}
                        onChange={(e) =>
                          handleUpdateSettings({
                            proxy: { mixedPort: Number.parseInt(e.target.value, 10) || 17890 }
                          })
                        }
                      />
                      <input
                        type="number"
                        value={settings.proxy.apiPort}
                        onChange={(e) =>
                          handleUpdateSettings({
                            proxy: { apiPort: Number.parseInt(e.target.value, 10) || 19090 }
                          })
                        }
                      />
                      <input
                        type="password"
                        value={settings.proxy.secret}
                        onChange={(e) =>
                          handleUpdateSettings({ proxy: { secret: e.target.value } })
                        }
                      />
                    </div>
                  </div>
                  <div className="settings-row proxy-node-row">
                    <div className="settings-copy">
                      <label>节点选择</label>
                      <p>
                        {proxyStatus?.currentNode
                          ? `当前节点：${proxyStatus.currentNode}`
                          : '暂无可用分组'}
                      </p>
                    </div>
                    <div className="proxy-node-tools">
                      <select
                        value={selectedProxyGroup}
                        onChange={(e) => loadProxyNodes(e.target.value).catch(console.error)}
                      >
                        <option value="">选择分组</option>
                        {proxyGroups.map((group) => (
                          <option key={group.name} value={group.name}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => handleProxyTestAll().catch(console.error)}>
                        全部测速
                      </button>
                      <button onClick={() => refreshProxyLogs().catch(console.error)}>
                        查看日志
                      </button>
                    </div>
                  </div>
                  {selectedProxyGroup && (
                    <div className="proxy-node-list">
                      {proxyNodes.length === 0 ? (
                        <div className="panel-empty-state">
                          <p>当前分组暂无节点</p>
                        </div>
                      ) : (
                        proxyNodes.map((node) => {
                          const delay = proxyDelayMap[node.name] ?? node.delay
                          const active =
                            proxyGroups.find((group) => group.name === selectedProxyGroup)?.now ===
                            node.name
                          return (
                            <button
                              key={node.name}
                              className={`proxy-node-item ${active ? 'active' : ''}`}
                              onClick={() => handleProxySwitch(node.name).catch(console.error)}
                            >
                              <span>{node.name}</span>
                              <span className={`proxy-delay ${getDelayClass(delay)}`}>
                                {delay === null || delay === undefined || delay < 0
                                  ? '超时'
                                  : `${delay}ms`}
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                  {proxyLogsVisible && (
                    <div className="proxy-log-box">
                      {proxyLogs.length === 0 ? (
                        <span>暂无日志</span>
                      ) : (
                        proxyLogs.map((line, index) => <code key={`${line}-${index}`}>{line}</code>)
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {panelType === 'settings' && (
          <>
            <div className="panel-header">
              <h3>设置</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list settings-list">
              {!settings && <SkeletonRows rows={4} />}
              {settings && (
                <>
                  <div className="settings-group-title">启动与主页</div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>启动时打开</label>
                      <p>决定浏览器启动后的第一个页面组合。</p>
                    </div>
                    <select
                      value={settings.startup.behavior}
                      onChange={(e) =>
                        handleUpdateSettings({
                          startup: {
                            behavior: e.target.value as BrowserSettings['startup']['behavior']
                          }
                        })
                      }
                    >
                      <option value="newtab">新标签页</option>
                      <option value="homepage">主页</option>
                      <option value="restoreSession">恢复上次会话</option>
                      <option value="specificPages">指定页面</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>主页 URL</label>
                      <p>主页按钮和启动主页模式使用这个地址。</p>
                    </div>
                    <input
                      key={`homepage-${settings.startup.homepageUrl}`}
                      type="text"
                      defaultValue={settings.startup.homepageUrl}
                      onBlur={(e) =>
                        handleUpdateSettings({ startup: { homepageUrl: e.target.value } })
                      }
                    />
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>新标签页 URL</label>
                      <p>留空时显示内置新标签页。</p>
                    </div>
                    <input
                      key={`newtab-${settings.startup.newTabUrl}`}
                      type="text"
                      defaultValue={settings.startup.newTabUrl}
                      onBlur={(e) =>
                        handleUpdateSettings({ startup: { newTabUrl: e.target.value } })
                      }
                    />
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>指定页面</label>
                      <p>每行一个 URL，用于指定页面启动模式。</p>
                    </div>
                    <textarea
                      className="settings-textarea"
                      key={`specific-${settings.startup.specificPages.join('\n')}`}
                      defaultValue={settings.startup.specificPages.join('\n')}
                      onBlur={(e) =>
                        handleUpdateSettings({
                          startup: {
                            specificPages: e.target.value
                              .split(/\r?\n/)
                              .map((line) => line.trim())
                              .filter(Boolean)
                          }
                        })
                      }
                    />
                  </div>

                  <div className="settings-group-title">搜索引擎</div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>默认搜索引擎</label>
                      <p>地址栏输入非网址内容时用哪个搜索。</p>
                    </div>
                    <select
                      value={settings.search.defaultEngine}
                      onChange={(e) =>
                        handleUpdateSettings({
                          search: {
                            defaultEngine: e.target
                              .value as BrowserSettings['search']['defaultEngine']
                          }
                        })
                      }
                    >
                      <option value="google">Google</option>
                      <option value="bing">Bing</option>
                      <option value="baidu">百度</option>
                      <option value="duckduckgo">DuckDuckGo</option>
                      <option value="custom">自定义</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>自定义搜索名称</label>
                      <p>仅在选择自定义搜索引擎时使用。</p>
                    </div>
                    <input
                      key={`custom-name-${settings.search.customEngine?.name || ''}`}
                      type="text"
                      defaultValue={settings.search.customEngine?.name || ''}
                      onBlur={(e) =>
                        handleUpdateSettings({
                          search: {
                            customEngine: {
                              name: e.target.value,
                              urlTemplate: settings.search.customEngine?.urlTemplate || ''
                            }
                          }
                        })
                      }
                    />
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>自定义搜索 URL 模板</label>
                      <p>必须包含 %s，模板无效时会回退到 Google。</p>
                    </div>
                    <input
                      key={`custom-url-${settings.search.customEngine?.urlTemplate || ''}`}
                      type="text"
                      defaultValue={settings.search.customEngine?.urlTemplate || ''}
                      onBlur={(e) =>
                        handleUpdateSettings({
                          search: {
                            customEngine: {
                              name: settings.search.customEngine?.name || '自定义',
                              urlTemplate: e.target.value
                            }
                          }
                        })
                      }
                    />
                  </div>

                  <div className="settings-group-title">外观</div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>主题</label>
                      <p>可固定深色、浅色，或跟随系统。</p>
                    </div>
                    <select
                      value={settings.appearance.themeMode}
                      onChange={(e) =>
                        handleUpdateSettings({
                          appearance: {
                            themeMode: e.target.value as BrowserSettings['appearance']['themeMode']
                          }
                        })
                      }
                    >
                      <option value="dark">深色</option>
                      <option value="light">浅色</option>
                      <option value="system">跟随系统</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>主题色</label>
                      <p>影响强调色、发光边线和界面氛围。</p>
                    </div>
                    <div className="theme-color-picker" role="radiogroup" aria-label="主题色">
                      {THEME_COLORS.map((theme) => (
                        <button
                          key={theme.id}
                          className={`theme-color-dot ${
                            settings.themeColor === theme.id ? 'active' : ''
                          }`}
                          onClick={() => handleUpdateSettings({ themeColor: theme.id })}
                          title={theme.label}
                          aria-label={theme.label}
                          aria-pressed={settings.themeColor === theme.id}
                          style={{ '--dot-hue': theme.hue } as React.CSSProperties}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="settings-row settings-row-font-picker">
                    <div className="settings-copy">
                      <label>界面字体</label>
                      <p>仅影响浏览器界面，不影响网页内容。</p>
                    </div>
                    <div className="font-picker">
                      {UI_FONTS.map((font) => (
                        <button
                          key={font.id}
                          className={`font-picker-option ${
                            settings.uiFont === font.id ? 'active' : ''
                          }`}
                          data-font={font.id}
                          onClick={() => handleUpdateSettings({ uiFont: font.id })}
                          type="button"
                        >
                          <span className="font-picker-radio" />
                          <span className="font-picker-info">
                            <span className="font-picker-name">{font.label}</span>
                            <span className="font-picker-preview">{font.preview}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>强调色</label>
                      <p>兼容旧设置；Beautiful 主题优先使用上方主题色。</p>
                    </div>
                    <input
                      className="settings-color-input"
                      type="color"
                      value={settings.appearance.accentColor}
                      onChange={(e) =>
                        handleUpdateSettings({ appearance: { accentColor: e.target.value } })
                      }
                    />
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>界面密度</label>
                      <p>调整顶部 chrome 和控件高度。</p>
                    </div>
                    <select
                      value={settings.appearance.density}
                      onChange={(e) =>
                        handleUpdateSettings({
                          appearance: {
                            density: e.target.value as BrowserSettings['appearance']['density']
                          }
                        })
                      }
                    >
                      <option value="compact">紧凑</option>
                      <option value="normal">标准</option>
                      <option value="spacious">宽松</option>
                    </select>
                  </div>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>网页暗色模式</span>
                      <p>对网页内容强制暗色，不影响浏览器界面主题。</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={webDarkMode}
                      onChange={() => handleToggleDarkMode().catch(console.error)}
                    />
                  </label>

                  <div className="settings-group-title">工具栏</div>
                  {[
                    ['backButton', '后退按钮'],
                    ['forwardButton', '前进按钮'],
                    ['reloadStopButton', '刷新/停止按钮'],
                    ['proxyButton', '代理按钮'],
                    ['homeButton', '主页按钮'],
                    ['adBlockButton', 'AdBlock 按钮'],
                    ['darkModeButton', '网页暗色按钮'],
                    ['translateButton', '翻译按钮'],
                    ['readerButton', '阅读模式按钮'],
                    ['bookmarkButton', '收藏当前页按钮'],
                    ['bookmarksButton', '书签面板按钮'],
                    ['historyButton', '历史面板按钮'],
                    ['downloadsButton', '下载按钮'],
                    ['snifferButton', '资源嗅探按钮'],
                    ['scriptsButton', '用户脚本按钮'],
                    ['webPanelButton', '网页面板按钮'],
                    ['splitViewButton', '分屏浏览按钮'],
                    ['aiButton', 'AI 助手按钮'],
                    ['settingsButton', '设置按钮']
                  ].map(([key, label]) => (
                    <label className="settings-row settings-check" key={key}>
                      <div className="settings-copy">
                        <span>{label}</span>
                        <p>控制这个按钮是否显示在顶部工具栏。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.toolbar[key as keyof BrowserSettings['toolbar']]}
                        onChange={(e) =>
                          handleUpdateSettings({
                            toolbar: {
                              [key]: e.target.checked
                            } as DeepPartial<BrowserSettings['toolbar']>
                          })
                        }
                      />
                    </label>
                  ))}

                  <div className="settings-group-title">标签页</div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>新标签插入位置</label>
                      <p>新标签页放在当前标签后，或追加到末尾。</p>
                    </div>
                    <select
                      value={settings.tabs.newTabPosition}
                      onChange={(e) =>
                        handleUpdateSettings({
                          tabs: {
                            newTabPosition: e.target
                              .value as BrowserSettings['tabs']['newTabPosition']
                          }
                        })
                      }
                    >
                      <option value="afterCurrent">当前标签后</option>
                      <option value="atEnd">末尾</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>新标签焦点</label>
                      <p>决定新标签默认在前台还是后台打开。</p>
                    </div>
                    <select
                      value={settings.tabs.newTabFocus}
                      onChange={(e) =>
                        handleUpdateSettings({
                          tabs: {
                            newTabFocus: e.target.value as BrowserSettings['tabs']['newTabFocus']
                          }
                        })
                      }
                    >
                      <option value="foreground">前台</option>
                      <option value="background">后台</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>关闭标签后激活</label>
                      <p>关闭当前标签页后切到哪个标签。</p>
                    </div>
                    <select
                      value={settings.tabs.closeTabActivate}
                      onChange={(e) =>
                        handleUpdateSettings({
                          tabs: {
                            closeTabActivate: e.target
                              .value as BrowserSettings['tabs']['closeTabActivate']
                          }
                        })
                      }
                    >
                      <option value="right">右侧标签</option>
                      <option value="left">左侧标签</option>
                      <option value="recent">最近访问</option>
                    </select>
                  </div>

                  <div className="settings-group-title">快捷键</div>
                  <div className="settings-row settings-shortcuts">
                    <div className="settings-copy">
                      <label>常用快捷键</label>
                      <p>
                        Ctrl+T 新建标签，Ctrl+W 关闭标签，Ctrl+L 聚焦地址栏，Ctrl+F 查找，Ctrl+,
                        打开设置。
                      </p>
                    </div>
                    <button onClick={() => window.api.shortcutsOpenSettings().catch(console.error)}>
                      设置快捷键
                    </button>
                  </div>

                  <div className="settings-group-title">标签页休眠</div>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>自动休眠后台标签页</span>
                      <p>开启后，超过设定时间未访问的后台标签页会释放页面并显示休眠标识。</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={hibernationPrefs.enabled}
                      onChange={(e) =>
                        handleHibernationPrefsUpdate({ enabled: e.target.checked }).catch(
                          console.error
                        )
                      }
                    />
                  </label>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>休眠等待时间</label>
                      <p>后台标签页闲置多少分钟后自动休眠。</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={hibernationPrefs.timeoutMinutes}
                      onChange={(e) =>
                        handleHibernationPrefsUpdate({
                          timeoutMinutes: Number.parseInt(e.target.value, 10) || 30
                        }).catch(console.error)
                      }
                    />
                  </div>

                  <div className="settings-group-title">下载</div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>下载路径</label>
                      <p>文件默认保存到这里。</p>
                    </div>
                    <div className="settings-path-row">
                      <input
                        key={`download-dir-${settings.downloads.defaultDirectory}`}
                        type="text"
                        defaultValue={settings.downloads.defaultDirectory}
                        onBlur={(e) =>
                          handleUpdateSettings({ downloads: { defaultDirectory: e.target.value } })
                        }
                      />
                      <button onClick={() => handleSelectDownloadPath().catch(console.error)}>
                        浏览
                      </button>
                    </div>
                  </div>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>下载前询问位置</span>
                      <p>每次下载都弹窗问保存到哪。关掉就直接存到上面的路径。</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.downloads.askBeforeDownload}
                      onChange={(e) =>
                        handleUpdateSettings({
                          downloads: { askBeforeDownload: e.target.checked }
                        })
                      }
                    />
                  </label>

                  <div className="settings-group-title">下载管理</div>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>启用外部下载器</span>
                      <p>开启后浏览器下载会转发给已配置的 IDM/FDM/NDM。</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.downloader.enabled}
                      onChange={(e) =>
                        handleUpdateSettings({
                          downloader: { enabled: e.target.checked }
                        })
                      }
                    />
                  </label>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>默认下载器</label>
                      <p>未配置路径时仍使用内置下载。</p>
                    </div>
                    <select
                      value={settings.downloader.type}
                      onChange={(e) =>
                        handleUpdateSettings({
                          downloader: {
                            type: e.target.value as BrowserSettings['downloader']['type']
                          }
                        })
                      }
                    >
                      <option value="builtin">内置下载</option>
                      <option value="idm">IDM</option>
                      <option value="fdm">FDM</option>
                      <option value="ndm">NDM</option>
                      <option value="custom">自定义</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>下载器路径</label>
                      <p>外部下载器可执行文件路径。</p>
                    </div>
                    <input
                      key={`downloader-path-${settings.downloader.path}`}
                      type="text"
                      defaultValue={settings.downloader.path}
                      onBlur={(e) =>
                        handleUpdateSettings({
                          downloader: { path: e.target.value }
                        })
                      }
                    />
                  </div>
                  <div className="settings-row external-downloader-detect">
                    <div className="settings-copy">
                      <label>自动检测</label>
                      <p>检测本机常见安装路径。</p>
                    </div>
                    <div className="downloader-detect-list">
                      {(['idm', 'fdm', 'ndm'] as const).map((type) => (
                        <button
                          key={type}
                          disabled={!detectedDownloaders[type]}
                          onClick={() =>
                            handleUpdateSettings({
                              downloader: {
                                enabled: true,
                                type,
                                path: detectedDownloaders[type] || ''
                              }
                            })
                          }
                        >
                          {type.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-group-title">密码管理</div>
                  <div className="password-manager">
                    <div className="password-toolbar">
                      <input
                        type="text"
                        value={passwordQuery}
                        onChange={(e) => setPasswordQuery(e.target.value)}
                        placeholder="搜索网站、用户名"
                      />
                      <button onClick={() => loadPasswordItems().catch(console.error)}>刷新</button>
                    </div>
                    <div className="password-form-grid">
                      <input
                        type="text"
                        value={passwordForm.title}
                        onChange={(e) =>
                          setPasswordForm((current) => ({ ...current, title: e.target.value }))
                        }
                        placeholder="网站名称"
                      />
                      <input
                        type="text"
                        value={passwordForm.url}
                        onChange={(e) =>
                          setPasswordForm((current) => ({ ...current, url: e.target.value }))
                        }
                        placeholder="https://example.com"
                      />
                      <input
                        type="text"
                        value={passwordForm.username}
                        onChange={(e) =>
                          setPasswordForm((current) => ({ ...current, username: e.target.value }))
                        }
                        placeholder="用户名"
                      />
                      <input
                        type="password"
                        value={passwordForm.password}
                        onChange={(e) =>
                          setPasswordForm((current) => ({ ...current, password: e.target.value }))
                        }
                        placeholder={passwordForm.id ? '留空则不改密码' : '密码'}
                      />
                      <button onClick={() => handleSavePassword().catch(console.error)}>
                        {passwordForm.id ? '更新' : '新增'}
                      </button>
                      {passwordForm.id && <button onClick={resetPasswordForm}>取消</button>}
                    </div>
                    <div className="password-list">
                      {filteredPasswords.length === 0 ? (
                        <div className="panel-empty-state">
                          <p>暂无保存的密码</p>
                        </div>
                      ) : (
                        filteredPasswords.map((item) => (
                          <div className="password-item" key={item.id}>
                            <div className="password-item-main">
                              <strong>{item.title || item.url}</strong>
                              <span>{item.username}</span>
                              <small>{item.url}</small>
                              {visiblePassword?.id === item.id && (
                                <code>{visiblePassword.value}</code>
                              )}
                            </div>
                            <div className="password-item-actions">
                              <button
                                onClick={() => handleRevealPassword(item.id).catch(console.error)}
                              >
                                查看
                              </button>
                              <button onClick={() => handleEditPassword(item)}>编辑</button>
                              <button onClick={() => handleDeletePassword(item.id)}>删除</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="settings-group-title">导入、导出与重置</div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>偏好设置文件</label>
                      <p>导入或导出 JSON 偏好设置。</p>
                    </div>
                    <div className="settings-actions-inline">
                      <button onClick={() => handleExportSettings().catch(console.error)}>
                        导出
                      </button>
                      <button onClick={() => handleImportSettings().catch(console.error)}>
                        导入
                      </button>
                    </div>
                  </div>

                  <div className="settings-group-title">高级</div>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>保存浏览历史</span>
                      <p>关掉后不再记录历史。之前的记录不受影响。</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.advanced.saveHistory}
                      onChange={(e) =>
                        handleUpdateSettings({ advanced: { saveHistory: e.target.checked } })
                      }
                    />
                  </label>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>保存下载记录</span>
                      <p>关掉后不再记录新的下载。已有记录不会消失。</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.advanced.saveDownloadsHistory}
                      onChange={(e) =>
                        handleUpdateSettings({
                          advanced: { saveDownloadsHistory: e.target.checked }
                        })
                      }
                    />
                  </label>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>启用开发者工具</span>
                      <p>允许 F12 和右键检查元素。普通用户可以关掉。</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.advanced.devToolsEnabled}
                      onChange={(e) =>
                        handleUpdateSettings({ advanced: { devToolsEnabled: e.target.checked } })
                      }
                    />
                  </label>

                  <div className="settings-group-title">AdBlock Zhi</div>
                  <label className="settings-row settings-check">
                    <div className="settings-copy">
                      <span>启用 AdBlock Zhi</span>
                      <p>拦截常见广告与追踪请求</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={adBlockState?.enabled ?? settings.adblock.enabled}
                      onChange={(e) => handleAdBlockToggle(e.target.checked).catch(console.error)}
                    />
                  </label>
                  <div className="settings-row adblock-site-row">
                    <div className="settings-copy">
                      <label>当前网站白名单</label>
                      <p>
                        {currentAdBlockSite?.canWhitelist
                          ? currentAdBlockSite.hostname
                          : '内部页面不可加入白名单。'}
                      </p>
                    </div>
                    <button
                      disabled={!currentAdBlockSite?.canWhitelist}
                      onClick={() => handleAdBlockWhitelistToggle().catch(console.error)}
                    >
                      {currentAdBlockSite?.hostname &&
                      (adBlockState?.whitelist || settings.adblock.whitelist).includes(
                        currentAdBlockSite.hostname
                      )
                        ? '从白名单移除当前网站'
                        : '将当前网站加入白名单'}
                    </button>
                  </div>
                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>AdBlock Zhi 已拦截请求</label>
                      <p>{adBlockState?.blockedCount ?? settings.adblock.blockedCount}</p>
                    </div>
                    <button onClick={() => handleClearAdBlockCount().catch(console.error)}>
                      清空计数
                    </button>
                  </div>
                  <div className="settings-row adblock-whitelist-section">
                    <div className="settings-copy">
                      <label>AdBlock Zhi 白名单网站</label>
                      <p>白名单网站不会触发广告拦截。</p>
                    </div>
                    {(adBlockState?.whitelist || settings.adblock.whitelist).length === 0 ? (
                      <p className="adblock-empty-hint">暂无白名单网站</p>
                    ) : (
                      <ul className="adblock-whitelist">
                        {(adBlockState?.whitelist || settings.adblock.whitelist).map((host) => (
                          <li key={host} className="adblock-whitelist-item">
                            <span>{host}</span>
                            <button
                              onClick={() =>
                                handleRemoveAdBlockWhitelist(host).catch(console.error)
                              }
                              title="移除"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="settings-row">
                    <div className="settings-copy">
                      <label>数据目录</label>
                      <p>书签、历史、设置都存在这里。</p>
                    </div>
                    <button onClick={() => handleOpenUserDataFolder().catch(console.error)}>
                      打开目录
                    </button>
                  </div>
                </>
              )}
            </div>
            {settings && (
              <div className="panel-footer settings-danger-zone">
                <div className="settings-copy">
                  <span>危险区 · 恢复默认设置</span>
                  <p>把所有设置恢复成出厂状态。书签和历史不受影响。</p>
                </div>
                <button className="panel-action-btn" onClick={handleResetSettings}>
                  恢复默认
                </button>
              </div>
            )}
          </>
        )}

        {panelType === 'ai' && (
          <>
            <div className="panel-header">
              <div className="ai-panel-header-left">
                <h3>AI 助手</h3>
                <button
                  className={`ai-settings-icon ${aiShowSettings ? 'active' : ''}`}
                  onClick={() => setAiShowSettings((current) => !current)}
                  title={aiShowSettings ? '返回 AI 助手' : 'AI 设置'}
                  aria-pressed={aiShowSettings}
                >
                  ⚙
                </button>
              </div>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            {aiShowSettings ? (
              <div className="ai-settings-content">
                {!settings && <SkeletonRows rows={4} />}
                {settings && (
                  <div className="ai-settings-section">
                    <label className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-label">启用 AI 功能</span>
                        <span className="settings-desc">
                          控制 AI 请求和右键选中文字 AI 操作是否可用。
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.ai.enabled}
                        onChange={(e) => handleUpdateAISettings({ enabled: e.target.checked })}
                      />
                    </label>
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <label className="settings-label">Provider 名称</label>
                        <span className="settings-desc">用于标记当前 OpenAI-compatible 服务。</span>
                      </div>
                      <input
                        className="settings-input"
                        key={`ai-provider-${settings.ai.providerName}`}
                        type="text"
                        defaultValue={settings.ai.providerName}
                        placeholder="OpenAI Compatible"
                        onBlur={(e) => {
                          if (e.target.value !== settings.ai.providerName) {
                            handleUpdateAISettings({ providerName: e.target.value })
                          }
                        }}
                      />
                    </div>
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <label className="settings-label">Base URL</label>
                        <span className="settings-desc">例如 https://api.openai.com/v1。</span>
                      </div>
                      <input
                        className="settings-input"
                        key={`ai-base-url-${settings.ai.baseUrl}`}
                        type="text"
                        defaultValue={settings.ai.baseUrl}
                        placeholder="https://api.openai.com/v1"
                        onBlur={(e) => {
                          if (e.target.value !== settings.ai.baseUrl) {
                            handleUpdateAISettings({ baseUrl: e.target.value })
                          }
                        }}
                      />
                    </div>
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <label className="settings-label">API Key</label>
                        <span className="settings-desc">
                          本阶段保存在本机 preferences.json 中。
                        </span>
                      </div>
                      <input
                        className="settings-input"
                        key={`ai-api-key-${settings.ai.apiKey ? 'set' : 'empty'}`}
                        type="password"
                        defaultValue={settings.ai.apiKey}
                        placeholder="sk-..."
                        onBlur={(e) => {
                          if (e.target.value !== settings.ai.apiKey) {
                            handleUpdateAISettings({ apiKey: e.target.value })
                          }
                        }}
                      />
                    </div>
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <label className="settings-label">模型名称</label>
                        <span className="settings-desc">
                          填写服务支持的 chat completions 模型。
                        </span>
                      </div>
                      <input
                        className="settings-input"
                        key={`ai-model-${settings.ai.model}`}
                        type="text"
                        defaultValue={settings.ai.model}
                        placeholder="gpt-4o-mini"
                        onBlur={(e) => {
                          if (e.target.value !== settings.ai.model) {
                            handleUpdateAISettings({ model: e.target.value })
                          }
                        }}
                      />
                    </div>
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <label className="settings-label">Temperature</label>
                        <span className="settings-desc">数值越低越稳定，范围 0 到 2。</span>
                      </div>
                      <input
                        className="settings-input settings-input-narrow"
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={settings.ai.temperature}
                        onChange={(e) => {
                          const value = Number.parseFloat(e.target.value)
                          if (Number.isFinite(value) && value >= 0 && value <= 2) {
                            handleUpdateAISettings({ temperature: value })
                          }
                        }}
                      />
                    </div>
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <label className="settings-label">最大页面输入长度</label>
                        <span className="settings-desc">长网页会在这个字符数后截断。</span>
                      </div>
                      <input
                        className="settings-input settings-input-narrow"
                        type="number"
                        min={1000}
                        max={100000}
                        step={1000}
                        value={settings.ai.maxInputChars}
                        onChange={(e) => {
                          const value = Number.parseInt(e.target.value, 10)
                          if (Number.isFinite(value) && value >= 1000) {
                            handleUpdateAISettings({ maxInputChars: value })
                          }
                        }}
                      />
                    </div>
                    <label className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-label">流式输出</span>
                        <span className="settings-desc">已预留，后续版本启用。</span>
                      </div>
                      <input type="checkbox" checked={settings.ai.stream} disabled />
                    </label>
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <label className="settings-label">联网搜索模式</label>
                        <span className="settings-desc">
                          只有支持搜索工具的 Provider 才会生效；DeepSeek API 默认不带内置联网搜索。
                        </span>
                      </div>
                      <select
                        className="settings-input"
                        value={settings.ai.searchMode ?? 'none'}
                        onChange={(e) =>
                          handleUpdateAISettings({ searchMode: e.target.value as AISearchMode })
                        }
                      >
                        <option value="none">不使用联网搜索</option>
                        <option value="xiaomi_web_search">小米 MiMo Web Search</option>
                        <option value="gemini_google_search">Google Gemini Grounding</option>
                      </select>
                    </div>
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <label className="settings-label">连接测试</label>
                        <span className="settings-desc">使用当前配置发送一次非流式测试请求。</span>
                      </div>
                      <button onClick={() => handleTestAIConnection().catch(() => undefined)}>
                        测试连接
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : !aiStatus ? (
              <div className="panel-list ai-panel-body">
                <SkeletonRows rows={3} />
              </div>
            ) : (
              <>
                <div className="ai-page-context">
                  <div className="ai-page-context-main">
                    <div className="ai-page-title">
                      {aiContextLoading ? '正在刷新 AI 状态...' : aiPageInfo?.title || '无标题'}
                    </div>
                    <div className="ai-page-url">{aiPageInfo?.url || '当前页面'}</div>
                  </div>
                  <button
                    className="ai-refresh-context"
                    onClick={() => refreshAIContext().catch(() => undefined)}
                    disabled={aiContextLoading || aiLoading}
                    title="刷新 AI 状态"
                  >
                    ↻
                  </button>
                </div>
                <div className="ai-actions">
                  <button
                    className="ai-action-btn"
                    onClick={() => handleAISummarizePage().catch(() => setAiError('请求异常'))}
                    disabled={aiLoading || !canUseAI}
                  >
                    省流版本
                  </button>
                  <button
                    className="ai-action-btn"
                    onClick={() => handleAIVerifyPage().catch(() => setAiError('请求异常'))}
                    disabled={aiLoading || !canUseAI}
                  >
                    丁真一下
                  </button>
                  <button
                    className="ai-action-btn"
                    onClick={() => handleAISearchPage().catch(() => setAiError('请求异常'))}
                    disabled={aiLoading || !canUseAI}
                  >
                    全网通缉
                  </button>
                  <button
                    className="ai-action-btn"
                    onClick={() => handleAIDebatePage().catch(() => setAiError('请求异常'))}
                    disabled={aiLoading || !canUseAI}
                  >
                    大司马模式
                  </button>
                  <button
                    className="ai-action-btn"
                    onClick={() => handleAIYouAskPage().catch(() => setAiError('请求异常'))}
                    disabled={aiLoading || !canUseAI}
                  >
                    你问我答
                  </button>
                  <button
                    className={`ai-action-btn ${aiSearchMode ? 'active' : ''}`}
                    onClick={handleToggleAISearchMode}
                    disabled={aiLoading || !canUseAI}
                  >
                    🔍 AI 搜索
                  </button>
                </div>
                <div className="panel-list ai-message-list" ref={aiMessageListRef}>
                  {aiMessages.length === 0 && !aiLoading && !aiError && (
                    <div className="ai-empty-hint">
                      {aiUnavailableText || '选择一个网页动作，或直接聊天。'}
                    </div>
                  )}
                  {aiUnavailableText && aiMessages.length > 0 && (
                    <div className="ai-placeholder">{aiUnavailableText}</div>
                  )}
                  {aiMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`ai-message ai-message-${message.role}`}
                    >
                      <div className="ai-message-label">
                        {message.role === 'user' ? '你' : 'AI'}
                      </div>
                      <div className="ai-message-content">
                        {message.role === 'assistant'
                          ? renderMarkdownMessage(message.content)
                          : message.content}
                        {message.role === 'assistant' && (
                          <button
                            className="ai-message-copy"
                            onClick={() =>
                              handleCopyAIMessage(message.content).catch(() =>
                                showToast('复制失败', 'error')
                              )
                            }
                            title="复制这条回答"
                          >
                            复制
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="ai-message ai-message-assistant">
                      <div className="ai-message-label">AI</div>
                      <div className="ai-message-content ai-loading">思考中...</div>
                    </div>
                  )}
                </div>
                {aiError && <div className="ai-error">{aiError}</div>}
                <div className="ai-input-area">
                  <textarea
                    ref={aiInputRef}
                    className="ai-input"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder={aiSearchMode ? '描述你想找的网页...' : '问我任何问题...'}
                    disabled={!canUseAI}
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAIChat().catch(() => setAiError('请求异常'))
                      }
                    }}
                  />
                  <div className="ai-input-buttons">
                    <button
                      className={`ai-send-button ${aiLoading ? 'loading' : ''}`}
                      onClick={() => handleAIChat().catch(() => setAiError('请求异常'))}
                      disabled={aiLoading || !aiInput.trim() || !canUseAI}
                    >
                      发送
                    </button>
                    <button
                      className="ai-clear-button"
                      onClick={handleClearAIMessages}
                      disabled={aiMessages.length === 0 && !aiError}
                    >
                      清空
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {panelType === 'about' && (
          <>
            <div className="panel-header">
              <h3>关于</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list about-list">
              {!aboutInfo && <SkeletonRows rows={3} />}
              {aboutInfo && (
                <div className="about-card">
                  <div className="about-app-name">{aboutInfo.appName}</div>
                  <p className="about-description">
                    一个人写给自己用的浏览器。没什么宏大愿景，能用、好用、顺手就行。
                  </p>
                  <div className="about-row">
                    <span>版本</span>
                    <strong>{aboutInfo.appVersion}</strong>
                  </div>
                  <div className="about-row">
                    <span>Electron</span>
                    <strong>{aboutInfo.electronVersion}</strong>
                  </div>
                  <div className="about-row">
                    <span>Chromium</span>
                    <strong>{aboutInfo.chromiumVersion}</strong>
                  </div>
                  <div className="about-row">
                    <span>Node.js</span>
                    <strong>{aboutInfo.nodeVersion}</strong>
                  </div>
                  <div className="about-row about-row-path">
                    <span>数据目录</span>
                    <strong title={aboutInfo.userDataPath}>{aboutInfo.userDataPath}</strong>
                  </div>
                  <div className="settings-actions">
                    <button onClick={() => handleCopyAboutInfo(aboutInfo).catch(console.error)}>
                      复制信息
                    </button>
                    <button onClick={() => handleOpenUserDataFolder().catch(console.error)}>
                      打开目录
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {editingBookmark && (
        <div
          className="panel-modal-overlay"
          onClick={() => {
            setEditingBookmark(null)
            setBookmarkEditError('')
          }}
        >
          <div className="panel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-modal-header">
              <span>编辑书签</span>
              <button
                onClick={() => {
                  setEditingBookmark(null)
                  setBookmarkEditError('')
                }}
              >
                ✕
              </button>
            </div>
            <label>
              名称
              <input
                value={editingBookmark.title}
                onChange={(e) => {
                  setEditingBookmark({ ...editingBookmark, title: e.target.value })
                  setBookmarkEditError('')
                }}
              />
            </label>
            <label>
              地址
              <input
                value={editingBookmark.url}
                onChange={(e) => {
                  setEditingBookmark({ ...editingBookmark, url: e.target.value })
                  setBookmarkEditError('')
                }}
              />
            </label>
            <label>
              文件夹
              <input
                value={editingBookmark.folder}
                onChange={(e) => {
                  setEditingBookmark({ ...editingBookmark, folder: e.target.value })
                  setBookmarkEditError('')
                }}
              />
            </label>
            {bookmarkEditError && <div className="panel-modal-error">{bookmarkEditError}</div>}
            <div className="panel-modal-actions">
              <button onClick={() => handleSaveBookmark().catch(console.error)}>保存</button>
              <button
                className="secondary"
                onClick={() => {
                  setEditingBookmark(null)
                  setBookmarkEditError('')
                }}
              >
                算了
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <div className="panel-modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="panel-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-modal-header">
              <span>{confirmDialog.title}</span>
              <button onClick={() => setConfirmDialog(null)}>✕</button>
            </div>
            <p>{confirmDialog.message}</p>
            <div className="panel-modal-actions">
              <button
                className={confirmDialog.danger ? 'danger' : ''}
                onClick={() => handleConfirmDialog().catch(console.error)}
              >
                {confirmDialog.confirmLabel}
              </button>
              <button className="secondary" onClick={() => setConfirmDialog(null)}>
                {confirmDialog.cancelLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast toast-${toast.tone || 'info'}`}>{toast.text}</div>}
    </div>
  )
}

export default App
