import { WebContentsView, BaseWindow, Menu, MenuItemConstructorOptions, clipboard } from 'electron'
import type { Input, Event } from 'electron'
import {
  TabState,
  BrowserState,
  LoadError,
  FindState,
  RecentlyClosedTab,
  BrowserLayout
} from '../shared/types'
import { classifyInput, getWwwFallbackUrl } from './navigation'
import { addHistory } from './history'
import { getDownloads } from './downloads'

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
  wwwFallbackAttempted: boolean
}

export class TabManager {
  private tabs: Map<string, ManagedTab> = new Map()
  private tabOrder: string[] = []
  private activeTabId: string = ''
  private win: BaseWindow
  private uiView: WebContentsView
  private uiViewHeight: number = 74
  private pageTop: number = 74
  private findState: FindState | null = null
  private recentlyClosed: RecentlyClosedTab[] = []
  private onStateChange: () => void

  constructor(win: BaseWindow, uiView: WebContentsView, onStateChange: () => void) {
    this.win = win
    this.uiView = uiView
    this.onStateChange = onStateChange
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
        isNewTab: tab.isNewTab
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

  // ===== Tab creation =====

  createTab(url?: string): string {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const isNewTab = !url || url === 'about:blank'

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
      url: url || 'about:blank',
      title: isNewTab ? 'New Tab' : '',
      favicon: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      error: null,
      isPinned: false,
      zoomFactor: 1.0,
      isNewTab,
      wwwFallbackAttempted: false
    }

    this.tabs.set(id, tab)

    const activeIndex = this.tabOrder.indexOf(this.activeTabId)
    const insertIndex = activeIndex === -1 ? this.tabOrder.length : activeIndex + 1
    this.tabOrder.splice(insertIndex, 0, id)

    this.bindWebContentsEvents(tab)
    this.setupWindowOpenHandler(tab)
    this.setupContextMenu(tab)

    if (!isNewTab && url) {
      view.webContents.loadURL(url)
    }

    this.switchTab(id)
    return id
  }

  // ===== Tab closing =====

  closeTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    // Record to recently closed
    if (tab.url && tab.url !== 'about:blank') {
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

    // If this is the last tab, create a new one first
    if (this.tabOrder.length <= 1) {
      this.createTab()
      // createTab already switched active, now close the old one
    } else if (tabId === this.activeTabId) {
      // Switch to adjacent tab
      const idx = this.tabOrder.indexOf(tabId)
      const nextIdx = idx === this.tabOrder.length - 1 ? idx - 1 : idx + 1
      this.switchTab(this.tabOrder[nextIdx])
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

    this.pushState()
  }

  // ===== Tab switching =====

  switchTab(tabId: string): void {
    if (!this.tabs.has(tabId)) return

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
      tab.title = 'New Tab'
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
    tab.isPinned = !tab.isPinned

    this.tabOrder = this.tabOrder.filter((id) => id !== tabId)
    if (tab.isPinned) {
      const lastPinnedIdx = this.tabOrder.findIndex((id) => {
        const t = this.tabs.get(id)
        return t && !t.isPinned
      })
      this.tabOrder.splice(lastPinnedIdx === -1 ? this.tabOrder.length : lastPinnedIdx, 0, tabId)
    } else {
      const lastPinnedIdx = this.tabOrder.findIndex((id) => {
        const t = this.tabs.get(id)
        return t && !t.isPinned
      })
      this.tabOrder.splice(lastPinnedIdx === -1 ? this.tabOrder.length : lastPinnedIdx, 0, tabId)
    }

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
    this.uiView.setBounds({
      x: 0,
      y: 0,
      width,
      height: Math.max(0, Math.min(height, this.uiViewHeight))
    })

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
    const tabs = this.tabOrder
      .map((id) => this.tabs.get(id)!)
      .filter((t) => !t.isNewTab && t.url !== 'about:blank')
      .map((t) => ({ url: t.url, title: t.title, isPinned: t.isPinned }))

    const activeIndex = Math.max(
      0,
      tabs.findIndex((t) => {
        const activeTab = this.tabs.get(this.activeTabId)
        return activeTab && t.url === activeTab.url
      })
    )

    return { tabs, activeIndex }
  }

  // ===== Private: event binding =====

  private bindWebContentsEvents(tab: ManagedTab): void {
    const wc = tab.view.webContents

    wc.on('did-start-loading', () => {
      tab.isLoading = true
      tab.isNewTab = false
      this.pushState()
    })

    wc.on('did-stop-loading', () => {
      tab.isLoading = false
      tab.canGoBack = wc.navigationHistory.canGoBack()
      tab.canGoForward = wc.navigationHistory.canGoForward()
      this.pushState()
    })

    wc.on('did-navigate', (_event, url) => {
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

    wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return

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
      this.pushState()
    })

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

    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
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

  private setupContextMenu(tab: ManagedTab): void {
    tab.view.webContents.on('context-menu', (_event, params) => {
      const menuItems: MenuItemConstructorOptions[] = []

      menuItems.push(
        {
          label: 'Back',
          enabled: tab.view.webContents.navigationHistory.canGoBack(),
          click: () => this.goBack(tab.id)
        },
        {
          label: 'Forward',
          enabled: tab.view.webContents.navigationHistory.canGoForward(),
          click: () => this.goForward(tab.id)
        },
        { label: 'Reload', click: () => this.reload(tab.id) },
        { type: 'separator' }
      )

      if (params.linkURL) {
        menuItems.push(
          { label: 'Open link in new tab', click: () => this.createTab(params.linkURL) },
          {
            label: 'Copy link address',
            click: () => {
              clipboard.writeText(params.linkURL)
            }
          },
          { type: 'separator' }
        )
      }

      if (params.selectionText) {
        menuItems.push({ label: 'Copy', role: 'copy' }, { type: 'separator' })
      }

      if (params.isEditable) {
        menuItems.push(
          { label: 'Cut', role: 'cut' },
          { label: 'Copy', role: 'copy' },
          { label: 'Paste', role: 'paste' },
          { type: 'separator' }
        )
      }

      menuItems.push({
        label: 'Inspect Element',
        click: () => {
          tab.view.webContents.inspectElement(params.x, params.y)
        }
      })

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

    if (ctrl && key === 'h') {
      this.uiView.webContents.send('browser:open-history-panel')
      return true
    }

    if (ctrl && key === 'j') {
      this.uiView.webContents.send('browser:open-downloads-panel')
      return true
    }

    if (ctrl && (key === '+' || key === '=' || key === 'add')) {
      this.zoomIn(this.activeTabId)
      const tab = this.getActiveTab()
      if (tab) {
        this.uiView.webContents.send('browser:toast', {
          id: 'zoom',
          text: `Zoom: ${Math.round(tab.zoomFactor * 100)}%`,
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
          text: `Zoom: ${Math.round(tab.zoomFactor * 100)}%`,
          duration: 2000
        })
      }
      return true
    }

    if (ctrl && key === '0') {
      this.zoomReset(this.activeTabId)
      this.uiView.webContents.send('browser:toast', {
        id: 'zoom',
        text: 'Zoom: 100%',
        duration: 2000
      })
      return true
    }

    if (key === 'f12') {
      const activeTab = this.getActiveTab()
      if (activeTab) {
        activeTab.view.webContents.openDevTools()
      }
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
