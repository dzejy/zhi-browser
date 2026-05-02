import { WebContentsView, BaseWindow, Menu, MenuItemConstructorOptions, clipboard } from 'electron'
import type { Input, Event } from 'electron'
import {
  TabState,
  BrowserState,
  LoadError,
  FindState,
  RecentlyClosedTab,
  BrowserLayout,
  SidePanelType
} from '../shared/types'
import type { AISelectionAction } from '../shared/aiTypes'
import { classifyInput, getWwwFallbackUrl } from './navigation'
import { addHistory } from './history'
import { getDownloads } from './downloads'
import { getPreferences, getSettings } from './settings'

const UI_SCALE = 1.5
const DEFAULT_UI_VIEW_HEIGHT = Math.round(92 * UI_SCALE)

interface ManagedTab {
  id: string
  view: WebContentsView
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
  wwwFallbackAttempted: boolean
}

interface CreateTabOptions {
  background?: boolean
  insertMode?: 'afterCurrent' | 'atEnd'
  pinned?: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export class TabManager {
  private tabs: Map<string, ManagedTab> = new Map()
  private tabOrder: string[] = []
  private activeTabId: string = ''
  private win: BaseWindow
  private uiView: WebContentsView
  private uiViewHeight: number = DEFAULT_UI_VIEW_HEIGHT
  private pageTop: number = DEFAULT_UI_VIEW_HEIGHT
  private findState: FindState | null = null
  private recentlyClosed: RecentlyClosedTab[] = []
  private lastAccessedTabId: string = ''
  private onStateChange: () => void
  private onOpenPanel?: (type: Extract<SidePanelType, 'history' | 'downloads'>) => void
  private onAIAction?: (action: AISelectionAction) => void
  private onToggleBookmarkBar?: () => void

  constructor(
    win: BaseWindow,
    uiView: WebContentsView,
    onStateChange: () => void,
    onOpenPanel?: (type: Extract<SidePanelType, 'history' | 'downloads'>) => void,
    onAIAction?: (action: AISelectionAction) => void,
    onToggleBookmarkBar?: () => void
  ) {
    this.win = win
    this.uiView = uiView
    this.onStateChange = onStateChange
    this.onOpenPanel = onOpenPanel
    this.onAIAction = onAIAction
    this.onToggleBookmarkBar = onToggleBookmarkBar
  }

  // ===== State aggregation =====

  getBrowserState(): BrowserState {
    const tabs: TabState[] = this.tabOrder.map((id) => {
      const tab = this.tabs.get(id)!
      return {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        isLoading: tab.isLoading,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward,
        error: tab.error,
        isPinned: tab.isPinned,
        zoomFactor: tab.zoomFactor,
        isNewTab: tab.isNewTab,
        isAudible: tab.isAudible,
        isMuted: tab.isMuted
      }
    })
    return {
      tabs,
      activeTabId: this.activeTabId,
      findState: this.findState,
      downloads: getDownloads(),
      recentlyClosed: this.recentlyClosed.slice(0, 10)
    }
  }

  getActiveTabId(): string {
    return this.activeTabId
  }

  getActiveTab(): ManagedTab | undefined {
    return this.tabs.get(this.activeTabId)
  }

  getTabOrder(): string[] {
    return [...this.tabOrder]
  }

  getTab(tabId: string): ManagedTab | undefined {
    return this.tabs.get(tabId)
  }

  getActiveTabUrl(): string {
    return this.tabs.get(this.activeTabId)?.url || ''
  }

  getActiveWebContents(): Electron.WebContents | null {
    const tab = this.tabs.get(this.activeTabId)
    if (!tab) return null
    try {
      if (tab.view.webContents.isDestroyed()) return null
      return tab.view.webContents
    } catch {
      return null
    }
  }

  // ===== Tab creation =====

  createTab(url?: string, options?: CreateTabOptions): string {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    let targetUrl = url
    const prefs = getPreferences()

    if (!targetUrl && prefs.startup.newTabUrl.trim()) {
      targetUrl = classifyInput(prefs.startup.newTabUrl).value
    }

    const isNewTab = !targetUrl || targetUrl === 'about:blank'

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    const tab: ManagedTab = {
      id,
      view,
      url: targetUrl || 'about:blank',
      title: isNewTab ? '新标签页' : '',
      favicon: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      error: null,
      isPinned: Boolean(options?.pinned),
      zoomFactor: 1.0,
      isNewTab,
      isAudible: false,
      isMuted: false,
      wwwFallbackAttempted: false
    }

    this.tabs.set(id, tab)

    this.insertTabId(id, tab.isPinned, options?.insertMode || prefs.tabs.newTabPosition)

    this.bindWebContentsEvents(tab)
    this.setupWindowOpenHandler(tab)
    this.setupContextMenu(tab)

    const openInBackground = options?.background ?? prefs.tabs.newTabFocus === 'background'
    if (!openInBackground || !this.activeTabId) {
      this.switchTab(id)
    } else {
      this.updateLayout()
      this.pushState()
    }

    if (!isNewTab && targetUrl) {
      view.webContents.loadURL(targetUrl).catch(() => {
        /* did-fail-load renders the error page */
      })
    }
    return id
  }

  // ===== Tab closing =====

  closeTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    const closedIndex = this.tabOrder.indexOf(tabId)
    const wasActive = tabId === this.activeTabId

    // Record to recently closed
    if (tab.url && tab.url !== 'about:blank' && !tab.url.startsWith('data:')) {
      this.recentlyClosed.unshift({
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        closedAt: Date.now()
      })
      if (this.recentlyClosed.length > 20) {
        this.recentlyClosed.length = 20
      }
    }

    try {
      this.win.contentView.removeChildView(tab.view)
    } catch {
      // may not be attached
    }

    try {
      tab.view.webContents.close()
    } catch {
      // already closed
    }

    this.tabs.delete(tabId)
    this.tabOrder = this.tabOrder.filter((id) => id !== tabId)

    if (this.tabOrder.length === 0) {
      this.createTab()
      return
    }

    if (wasActive) {
      const prefs = getPreferences()
      let nextId = ''
      if (
        prefs.tabs.closeTabActivate === 'recent' &&
        this.lastAccessedTabId &&
        this.tabOrder.includes(this.lastAccessedTabId)
      ) {
        nextId = this.lastAccessedTabId
      } else if (prefs.tabs.closeTabActivate === 'left') {
        nextId = this.tabOrder[Math.max(0, closedIndex - 1)]
      } else {
        nextId = this.tabOrder[Math.min(closedIndex, this.tabOrder.length - 1)]
      }
      this.switchTab(nextId)
    } else {
      this.updateLayout()
      this.pushState()
    }
  }

  duplicateTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    this.createTab(tab.url && tab.url !== 'about:blank' ? tab.url : undefined)
  }

  closeOtherTabs(tabId: string): void {
    if (!this.tabs.has(tabId)) return
    const tabsToClose = this.tabOrder.filter((id) => {
      const tab = this.tabs.get(id)
      return id !== tabId && tab && !tab.isPinned
    })
    for (const id of tabsToClose) {
      this.closeTab(id)
    }
    this.switchTab(tabId)
  }

  closeTabsToRight(tabId: string): void {
    const index = this.tabOrder.indexOf(tabId)
    if (index === -1) return
    const tabsToClose = this.tabOrder.slice(index + 1).filter((id) => !this.tabs.get(id)?.isPinned)
    for (const id of tabsToClose) {
      this.closeTab(id)
    }
  }

  showTabContextMenu(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    const menu = Menu.buildFromTemplate([
      { label: '刷新', click: () => this.reload(tabId) },
      {
        label: '复制网址',
        enabled: Boolean(tab.url && tab.url !== 'about:blank'),
        click: () => clipboard.writeText(tab.url)
      },
      {
        label: '复制标题和网址',
        enabled: Boolean(tab.url && tab.url !== 'about:blank'),
        click: () => clipboard.writeText(`${tab.title || tab.url}\n${tab.url}`)
      },
      { type: 'separator' },
      { label: '复制标签页', click: () => this.duplicateTab(tabId) },
      {
        label: tab.isPinned ? '取消固定' : '固定标签页',
        click: () => this.togglePin(tabId)
      },
      {
        label: tab.isMuted ? '取消静音' : '静音标签页',
        enabled: tab.isAudible || tab.isMuted,
        click: () => this.toggleMuteTab(tabId)
      },
      { type: 'separator' },
      { label: '关闭标签页', click: () => this.closeTab(tabId) },
      {
        label: '关闭其他标签页',
        enabled: this.tabOrder.length > 1,
        click: () => this.closeOtherTabs(tabId)
      },
      {
        label: '关闭右侧标签页',
        enabled: this.tabOrder.indexOf(tabId) < this.tabOrder.length - 1,
        click: () => this.closeTabsToRight(tabId)
      },
      { type: 'separator' },
      {
        label: '恢复关闭的标签页',
        enabled: this.recentlyClosed.length > 0,
        click: () => this.restoreClosed()
      }
    ])

    menu.popup()
  }

  toggleDevTools(tabId: string): void {
    if (!getSettings().devToolsEnabled) return
    const tab = this.tabs.get(tabId)
    if (!tab) return

    const wc = tab.view.webContents
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools()
    } else {
      wc.openDevTools()
    }
  }

  // ===== Tab switching =====

  switchTab(tabId: string): void {
    if (!this.tabs.has(tabId)) return
    if (this.activeTabId && this.activeTabId !== tabId) {
      this.lastAccessedTabId = this.activeTabId
    }

    const oldTab = this.tabs.get(this.activeTabId)
    if (oldTab) {
      try {
        this.win.contentView.removeChildView(oldTab.view)
      } catch {
        // not attached
      }
    }

    this.activeTabId = tabId
    const newTab = this.tabs.get(tabId)!

    this.win.contentView.addChildView(newTab.view)
    this.updateLayout()

    if (this.findState && this.findState.tabId !== tabId) {
      this.findState = null
    }

    this.pushState()
  }

  // ===== Navigation =====

  loadUrl(tabId: string, input: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    const classified = classifyInput(input)

    if (classified.type === 'newtab') {
      tab.isNewTab = true
      tab.url = 'about:blank'
      tab.title = '新标签页'
      tab.error = null
      this.pushState()
      return
    }

    tab.isNewTab = false
    tab.error = null
    tab.wwwFallbackAttempted = false
    tab.url = classified.value
    tab.view.webContents.loadURL(classified.value)
    this.pushState()
  }

  goBack(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (tab && tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack()
    }
  }

  goForward(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (tab && tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward()
    }
  }

  reload(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (tab) {
      tab.error = null
      tab.wwwFallbackAttempted = false
      tab.view.webContents.reload()
      this.pushState()
    }
  }

  stop(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (tab) {
      tab.view.webContents.stop()
    }
  }

  retryLoad(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab || !tab.error) return
    const url = tab.error.url || tab.url
    tab.error = null
    tab.wwwFallbackAttempted = false
    tab.view.webContents.loadURL(url)
    this.pushState()
  }

  // ===== Zoom =====

  zoomIn(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.zoomFactor = Math.min(tab.zoomFactor + 0.1, 3.0)
    tab.view.webContents.setZoomFactor(tab.zoomFactor)
    this.pushState()
  }

  zoomOut(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.zoomFactor = Math.max(tab.zoomFactor - 0.1, 0.3)
    tab.view.webContents.setZoomFactor(tab.zoomFactor)
    this.pushState()
  }

  zoomReset(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.zoomFactor = 1.0
    tab.view.webContents.setZoomFactor(1.0)
    this.pushState()
  }

  // ===== Pin =====

  togglePin(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    if (tab.isPinned) {
      this.unpinTab(tabId)
    } else {
      this.pinTab(tabId)
    }
  }

  pinTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab || tab.isPinned) return
    tab.isPinned = true

    this.tabOrder = this.tabOrder.filter((id) => id !== tabId)
    const firstUnpinnedIdx = this.tabOrder.findIndex((id) => !this.tabs.get(id)?.isPinned)
    this.tabOrder.splice(
      firstUnpinnedIdx === -1 ? this.tabOrder.length : firstUnpinnedIdx,
      0,
      tabId
    )
    this.pushState()
  }

  unpinTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab || !tab.isPinned) return
    tab.isPinned = false
    this.tabOrder = this.tabOrder.filter((id) => id !== tabId)
    const firstUnpinnedIdx = this.tabOrder.findIndex((id) => !this.tabs.get(id)?.isPinned)
    this.tabOrder.splice(
      firstUnpinnedIdx === -1 ? this.tabOrder.length : firstUnpinnedIdx,
      0,
      tabId
    )
    this.pushState()
  }

  toggleMuteTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    const wc = tab.view.webContents
    const muted = !wc.isAudioMuted()
    wc.setAudioMuted(muted)
    tab.isMuted = muted
    tab.isAudible = wc.isCurrentlyAudible()
    this.pushState()
  }

  // ===== Move (drag reorder) =====

  moveTab(tabId: string, toIndex: number): void {
    const fromIndex = this.tabOrder.indexOf(tabId)
    if (fromIndex === -1) return
    this.tabOrder.splice(fromIndex, 1)
    this.tabOrder.splice(toIndex, 0, tabId)
    this.pushState()
  }

  // ===== Restore closed =====

  restoreClosed(): void {
    if (this.recentlyClosed.length === 0) return
    const item = this.recentlyClosed.shift()!
    this.createTab(item.url)
  }

  // ===== Find in page =====

  findStart(
    tabId: string,
    text: string,
    options?: { forward?: boolean; matchCase?: boolean }
  ): void {
    const tab = this.tabs.get(tabId)
    if (!tab || !text) return

    this.findState = {
      tabId,
      text,
      activeMatchOrdinal: 0,
      matches: 0
    }

    tab.view.webContents.findInPage(text, {
      forward: options?.forward !== false,
      matchCase: options?.matchCase || false
    })
  }

  findNext(tabId: string, forward: boolean): void {
    const tab = this.tabs.get(tabId)
    if (!tab || !this.findState) return

    tab.view.webContents.findInPage(this.findState.text, {
      forward,
      findNext: true
    })
  }

  findStop(tabId: string, action: 'clearSelection' | 'keepSelection'): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    tab.view.webContents.stopFindInPage(action)
    this.findState = null
    this.pushState()
  }

  // ===== Layout =====

  setUiHeight(height: number): void {
    this.setLayout({ uiViewHeight: height, pageTop: height })
  }

  setLayout(layout: BrowserLayout): void {
    if (this.uiViewHeight === layout.uiViewHeight && this.pageTop === layout.pageTop) return
    this.uiViewHeight = layout.uiViewHeight
    this.pageTop = layout.pageTop
    this.updateLayout()
  }

  updateLayout(): void {
    const { width, height } = this.win.getContentBounds()
    const uiHeight = Math.max(0, Math.min(this.uiViewHeight, height))
    this.uiView.setBounds({ x: 0, y: 0, width, height: uiHeight })

    const activeTab = this.tabs.get(this.activeTabId)
    if (activeTab) {
      activeTab.view.setBounds({
        x: 0,
        y: this.pageTop,
        width,
        height: Math.max(0, height - this.pageTop)
      })
    }
  }

  // ===== Cleanup =====

  destroyAll(): void {
    for (const [, tab] of this.tabs) {
      try {
        this.win.contentView.removeChildView(tab.view)
      } catch {
        /* ignore */
      }
      try {
        tab.view.webContents.close()
      } catch {
        /* ignore */
      }
    }
    this.tabs.clear()
    this.tabOrder = []
  }

  // ===== Session data for persistence =====

  getSessionData(): {
    tabs: { url: string; title: string; isPinned: boolean }[]
    activeIndex: number
  } {
    const entries = this.tabOrder
      .map((id) => {
        const tab = this.tabs.get(id)
        if (!tab || tab.isNewTab || tab.url === 'about:blank' || tab.url.startsWith('data:')) {
          return null
        }
        return { id, url: tab.url, title: tab.title, isPinned: tab.isPinned }
      })
      .filter(
        (entry): entry is { id: string; url: string; title: string; isPinned: boolean } =>
          entry !== null
      )

    const activeIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.id === this.activeTabId)
    )
    const tabs = entries.map(({ url, title, isPinned }) => ({ url, title, isPinned }))

    return { tabs, activeIndex }
  }

  private insertTabId(id: string, isPinned: boolean, insertMode: 'afterCurrent' | 'atEnd'): void {
    if (isPinned) {
      const firstUnpinnedIdx = this.tabOrder.findIndex((tabId) => !this.tabs.get(tabId)?.isPinned)
      this.tabOrder.splice(firstUnpinnedIdx === -1 ? this.tabOrder.length : firstUnpinnedIdx, 0, id)
      return
    }

    const firstUnpinnedIdx = this.tabOrder.findIndex((tabId) => !this.tabs.get(tabId)?.isPinned)
    const unpinnedStart = firstUnpinnedIdx === -1 ? this.tabOrder.length : firstUnpinnedIdx
    if (insertMode === 'afterCurrent' && this.activeTabId) {
      const activeIndex = this.tabOrder.indexOf(this.activeTabId)
      if (activeIndex >= unpinnedStart) {
        this.tabOrder.splice(activeIndex + 1, 0, id)
        return
      }
    }
    this.tabOrder.push(id)
  }

  private renderErrorPage(url: string, errorCode: number, errorDescription: string): string {
    const safeUrl = JSON.stringify(url)
    const escapedUrl = escapeHtml(url)
    const escapedDescription = escapeHtml(errorDescription)
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>无法访问此页面</title><style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#191b20;color:#d8dae0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.error-page{max-width:460px;padding:40px}
h1{font-size:18px;font-weight:500;margin:0 0 8px;color:#d8dae0}
p{font-size:13px;color:#9498a3;line-height:1.6;margin:8px 0}
.error-details{margin-top:16px;padding:12px 14px;background:#282b33;border:1px solid rgba(255,255,255,.06);border-radius:6px;color:#9498a3;font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}
.actions{display:flex;gap:10px;margin-top:24px}
button{height:28px;padding:0 14px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#d8dae0;cursor:pointer}
button.primary{border-color:#5a7fbf;background:#5a7fbf;color:#fff}
button:hover{background:#2a2d36}
button.primary:hover{background:#4d6faa}
</style></head><body><main class="error-page">
<h1>无法访问此页面</h1>
<p>请检查网址是否正确，或稍后重试。</p>
<div class="error-details">${escapedUrl}<br>错误代码：${errorCode}<br>${escapedDescription}</div>
<div class="actions"><button class="primary" onclick="location.href=${safeUrl}">重新加载</button><button onclick="history.back()">返回上一页</button></div>
</main></body></html>`
  }

  // ===== Private: event binding =====

  private bindWebContentsEvents(tab: ManagedTab): void {
    const wc = tab.view.webContents
    let lastErrorKey = ''
    let lastErrorAt = 0

    wc.on('did-start-loading', () => {
      tab.isLoading = true
      tab.isNewTab = false
      this.uiView.webContents.send('browser:hover-url', '')
      this.updatePageHoverUrl(tab, '')
      this.pushState()
    })

    wc.on('did-stop-loading', () => {
      tab.isLoading = false
      tab.canGoBack = wc.navigationHistory.canGoBack()
      tab.canGoForward = wc.navigationHistory.canGoForward()
      this.pushState()
    })

    wc.on('did-navigate', (_event, url) => {
      if (url.startsWith('data:text/html') && tab.error) {
        tab.isLoading = false
        this.pushState()
        return
      }
      tab.url = url
      tab.error = null
      tab.canGoBack = wc.navigationHistory.canGoBack()
      tab.canGoForward = wc.navigationHistory.canGoForward()
      tab.isNewTab = url === 'about:blank'
      this.pushState()

      if (url !== 'about:blank') {
        addHistory(url, tab.title)
      }
    })

    wc.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) {
        tab.url = url
        tab.canGoBack = wc.navigationHistory.canGoBack()
        tab.canGoForward = wc.navigationHistory.canGoForward()
        this.pushState()
      }
    })

    wc.on('page-title-updated', (_event, title) => {
      tab.title = title || tab.title
      this.pushState()

      if (tab.url && tab.url !== 'about:blank') {
        addHistory(tab.url, tab.title)
      }
    })

    wc.on('page-favicon-updated', (_event, favicons) => {
      if (favicons && favicons.length > 0) {
        tab.favicon = favicons[0]
        this.pushState()
      }
    })

    const handleLoadError = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      validatedURL: string,
      isMainFrame: boolean
    ): void => {
      if (!isMainFrame || errorCode === -3) return
      if (!validatedURL || validatedURL === 'about:blank' || validatedURL.startsWith('data:')) {
        return
      }

      const errorKey = `${validatedURL}:${errorCode}`
      const now = Date.now()
      if (lastErrorKey === errorKey && now - lastErrorAt < 500) return
      lastErrorKey = errorKey
      lastErrorAt = now

      if (!tab.wwwFallbackAttempted) {
        const fallbackUrl = getWwwFallbackUrl(validatedURL)
        if (fallbackUrl) {
          tab.wwwFallbackAttempted = true
          wc.loadURL(fallbackUrl)
          return
        }
      }

      tab.error = {
        url: validatedURL,
        errorCode,
        errorDescription
      }
      tab.isLoading = false
      tab.url = validatedURL
      tab.isNewTab = false
      this.pushState()
      wc.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(this.renderErrorPage(validatedURL, errorCode, errorDescription))
      ).catch(() => {
        /* ignore secondary failure */
      })
    }

    wc.on('did-fail-load', handleLoadError)
    wc.on(
      'did-fail-provisional-load',
      (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        handleLoadError(event, errorCode, errorDescription, validatedURL, isMainFrame)
      }
    )

    wc.on('found-in-page', (_event, result) => {
      if (this.findState && this.findState.tabId === tab.id) {
        this.findState.activeMatchOrdinal = result.activeMatchOrdinal
        this.findState.matches = result.matches
        this.uiView.webContents.send('browser:find-result', {
          activeMatchOrdinal: result.activeMatchOrdinal,
          matches: result.matches
        })
        this.pushState()
      }
    })

    wc.on('zoom-changed', (_event, zoomDirection) => {
      if (zoomDirection === 'in') {
        this.zoomIn(tab.id)
      } else {
        this.zoomOut(tab.id)
      }
      this.uiView.webContents.send('browser:toast', {
        id: 'zoom',
        text: `缩放：${Math.round(tab.zoomFactor * 100)}%`,
        duration: 2000
      })
    })

    wc.on('before-input-event', () => {
      tab.isAudible = wc.isCurrentlyAudible()
      tab.isMuted = wc.isAudioMuted()
      this.pushState()
    })

    wc.on('update-target-url', (_event, url) => {
      this.uiView.webContents.send('browser:hover-url', url)
      this.updatePageHoverUrl(tab, url)
    })

    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      if (
        input.alt &&
        !input.control &&
        !input.meta &&
        !input.shift &&
        input.key.toLowerCase() === 'i'
      ) {
        event.preventDefault()
        this.uiView.webContents.send('browser:toggle-ai-panel')
        return
      }
      if (this.handlePageKeyboard(event, input)) {
        event.preventDefault()
      }
    })
  }

  private setupWindowOpenHandler(tab: ManagedTab): void {
    tab.view.webContents.setWindowOpenHandler(({ url }) => {
      if (url && url !== 'about:blank') {
        this.createTab(url)
      }
      return { action: 'deny' }
    })
  }

  private updatePageHoverUrl(tab: ManagedTab, url: string): void {
    const script = `
      (() => {
        const id = 'zhi-hover-url-overlay'
        const value = ${JSON.stringify(url)}
        let overlay = document.getElementById(id)

        if (!value) {
          overlay?.remove()
          return
        }

        const parent = document.body || document.documentElement
        if (!parent) return

        if (!overlay) {
          overlay = document.createElement('div')
          overlay.id = id
          overlay.className = 'hover-url-overlay'
          parent.appendChild(overlay)
        }

        overlay.textContent = value
        const style = overlay.style
        style.position = 'fixed'
        style.left = '0'
        style.bottom = '0'
        style.zIndex = '2147483647'
        style.maxWidth = '60vw'
        style.padding = '4px 10px'
        style.overflow = 'hidden'
        style.color = '#d8dae0'
        style.background = 'rgba(32, 34, 40, 0.96)'
        style.border = '1px solid rgba(255, 255, 255, 0.14)'
        style.borderRadius = '0 6px 0 0'
        style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.35)'
        style.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        style.textOverflow = 'ellipsis'
        style.whiteSpace = 'nowrap'
        style.pointerEvents = 'none'
      })()
    `

    tab.view.webContents.executeJavaScript(script, true).catch(() => {
      /* page may be navigating or unavailable */
    })
  }

  private setupContextMenu(tab: ManagedTab): void {
    tab.view.webContents.on('context-menu', (_event, params) => {
      const menuItems: MenuItemConstructorOptions[] = []

      menuItems.push(
        {
          label: '后退',
          enabled: tab.view.webContents.navigationHistory.canGoBack(),
          click: () => this.goBack(tab.id)
        },
        {
          label: '前进',
          enabled: tab.view.webContents.navigationHistory.canGoForward(),
          click: () => this.goForward(tab.id)
        },
        { label: '刷新', click: () => this.reload(tab.id) },
        { type: 'separator' }
      )

      if (params.linkURL) {
        menuItems.push(
          { label: '在新标签页打开', click: () => this.createTab(params.linkURL) },
          {
            label: '复制链接',
            click: () => {
              clipboard.writeText(params.linkURL)
            }
          },
          { type: 'separator' }
        )
      }

      if (params.hasImageContents && params.srcURL) {
        menuItems.push(
          {
            label: '保存图片',
            click: () => tab.view.webContents.downloadURL(params.srcURL)
          },
          { type: 'separator' }
        )
      }

      if (params.isEditable) {
        menuItems.push(
          { label: '剪切', role: 'cut' },
          { label: '复制', role: 'copy' },
          { label: '粘贴', role: 'paste' },
          { label: '全选', role: 'selectAll' }
        )
      } else {
        menuItems.push(
          { label: '复制', role: 'copy', enabled: Boolean(params.selectionText) },
          { label: '粘贴', role: 'paste', enabled: false },
          { label: '全选', role: 'selectAll' }
        )
      }

      if (params.selectionText && getPreferences().ai.enabled) {
        menuItems.push(
          { type: 'separator' },
          {
            label: '用 AI 解释',
            click: () => {
              this.onAIAction?.('explain-selection')
            }
          },
          {
            label: '用 AI 翻译',
            click: () => {
              this.onAIAction?.('translate-selection')
            }
          },
          {
            label: '用 AI 总结',
            click: () => {
              this.onAIAction?.('summarize-selection')
            }
          }
        )
      }

      if (getSettings().devToolsEnabled) {
        menuItems.push({
          type: 'separator'
        })
        menuItems.push({
          label: '检查元素',
          click: () => {
            tab.view.webContents.inspectElement(params.x, params.y)
          }
        })
      }

      const menu = Menu.buildFromTemplate(menuItems)
      menu.popup()
    })
  }

  private handlePageKeyboard(_event: Event, input: Input): boolean {
    const ctrl = input.control || input.meta
    const shift = input.shift
    const alt = input.alt
    const key = input.key.toLowerCase()

    if (ctrl && key === 'l') {
      this.uiView.webContents.send('browser:focus-address-bar')
      return true
    }

    if (ctrl && !shift && key === 't') {
      this.createTab()
      this.uiView.webContents.send('browser:focus-address-bar')
      return true
    }

    if (ctrl && key === 'w') {
      this.closeTab(this.activeTabId)
      return true
    }

    if ((ctrl && key === 'r') || key === 'f5') {
      this.reload(this.activeTabId)
      return true
    }

    if (key === 'escape') {
      if (this.findState) {
        this.findStop(this.activeTabId, 'clearSelection')
      } else {
        this.stop(this.activeTabId)
      }
      return true
    }

    if (alt && key === 'arrowleft') {
      this.goBack(this.activeTabId)
      return true
    }

    if (alt && key === 'arrowright') {
      this.goForward(this.activeTabId)
      return true
    }

    if (ctrl && key === 'tab') {
      const currentIdx = this.tabOrder.indexOf(this.activeTabId)
      if (shift) {
        const prevIdx = currentIdx <= 0 ? this.tabOrder.length - 1 : currentIdx - 1
        this.switchTab(this.tabOrder[prevIdx])
      } else {
        const nextIdx = currentIdx >= this.tabOrder.length - 1 ? 0 : currentIdx + 1
        this.switchTab(this.tabOrder[nextIdx])
      }
      return true
    }

    if (ctrl && /^[1-9]$/.test(input.key)) {
      const idx = parseInt(input.key) - 1
      if (input.key === '9') {
        this.switchTab(this.tabOrder[this.tabOrder.length - 1])
      } else if (idx < this.tabOrder.length) {
        this.switchTab(this.tabOrder[idx])
      }
      return true
    }

    if (ctrl && key === 'f') {
      this.uiView.webContents.send('browser:focus-find')
      return true
    }

    if (ctrl && key === 'd') {
      this.uiView.webContents.send('browser:toggle-bookmark')
      return true
    }

    if (ctrl && shift && !alt && key === 'b') {
      this.onToggleBookmarkBar?.()
      return true
    }

    if (ctrl && key === 'h') {
      if (this.onOpenPanel) {
        this.onOpenPanel('history')
      } else {
        this.uiView.webContents.send('browser:open-panel', 'history')
      }
      return true
    }

    if (ctrl && key === 'j') {
      if (this.onOpenPanel) {
        this.onOpenPanel('downloads')
      } else {
        this.uiView.webContents.send('browser:open-panel', 'downloads')
      }
      return true
    }

    if (ctrl && key === ',') {
      this.uiView.webContents.send('browser:open-panel', 'settings')
      return true
    }

    if (ctrl && (key === '+' || key === '=' || key === 'add')) {
      this.zoomIn(this.activeTabId)
      const tab = this.getActiveTab()
      if (tab) {
        this.uiView.webContents.send('browser:toast', {
          id: 'zoom',
          text: `缩放：${Math.round(tab.zoomFactor * 100)}%`,
          duration: 2000
        })
      }
      return true
    }

    if (ctrl && (key === '-' || key === 'subtract')) {
      this.zoomOut(this.activeTabId)
      const tab = this.getActiveTab()
      if (tab) {
        this.uiView.webContents.send('browser:toast', {
          id: 'zoom',
          text: `缩放：${Math.round(tab.zoomFactor * 100)}%`,
          duration: 2000
        })
      }
      return true
    }

    if (ctrl && key === '0') {
      this.zoomReset(this.activeTabId)
      this.uiView.webContents.send('browser:toast', {
        id: 'zoom',
        text: '缩放：100%',
        duration: 2000
      })
      return true
    }

    if (key === 'f12') {
      this.toggleDevTools(this.activeTabId)
      return true
    }

    if (ctrl && shift && key === 't') {
      this.restoreClosed()
      return true
    }

    return false
  }

  private pushState(): void {
    this.onStateChange()
  }
}
