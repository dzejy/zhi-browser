import { clipboard, Menu, WebContentsView, type BaseWindow } from 'electron'
import { randomUUID } from 'crypto'
import type {
  BrowserState,
  LoadError,
  PersistedSession,
  TabState,
  ZoomAction
} from '../shared/types'
import type { BrowserStorage } from './storage'
import {
  BLANK_PAGE_URL,
  classifyInput,
  getDisplayTitle,
  getWwwFallbackUrl,
  isBlankUrl,
  isNameNotResolvedError,
  NEW_TAB_URL,
  shouldRecordHistory,
  toVisibleUrl
} from './navigation'

const ERR_ABORTED = -3
const DEFAULT_ZOOM_FACTOR = 1
const MIN_ZOOM_FACTOR = 0.25
const MAX_ZOOM_FACTOR = 3
const ZOOM_STEP = 0.1

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
  zoomFactor: number
  attemptedWwwFallbacks: Set<string>
}

export interface TabManagerOptions {
  window: BaseWindow
  uiView: WebContentsView
  uiHeight: number
  storage: BrowserStorage
  focusAddressBar: () => void
  updateWindowTitle: (title: string) => void
}

export class TabManager {
  private readonly window: BaseWindow
  private readonly uiView: WebContentsView
  private readonly uiHeight: number
  private readonly storage: BrowserStorage
  private readonly focusAddressBar: () => void
  private readonly updateWindowTitle: (title: string) => void
  private readonly tabs = new Map<string, ManagedTab>()
  private readonly tabOrder: string[] = []
  private activeTabId = ''
  private saveSessionTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: TabManagerOptions) {
    this.window = options.window
    this.uiView = options.uiView
    this.uiHeight = options.uiHeight
    this.storage = options.storage
    this.focusAddressBar = options.focusAddressBar
    this.updateWindowTitle = options.updateWindowTitle
  }

  createTab(url = NEW_TAB_URL, activate = true, openerTabId?: string): string {
    const id = randomUUID()
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    view.setBackgroundColor('#ffffff')

    const tab: ManagedTab = {
      id,
      view,
      url: '',
      title: 'New Tab',
      favicon: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      error: null,
      zoomFactor: DEFAULT_ZOOM_FACTOR,
      attemptedWwwFallbacks: new Set<string>()
    }

    this.tabs.set(id, tab)
    this.insertTabId(id, openerTabId)
    this.bindTabEvents(tab)

    if (activate || !this.activeTabId) {
      this.switchTab(id)
    } else {
      this.pushState()
    }

    if (!isBlankUrl(url)) {
      this.loadUrl(id, url)
    } else {
      this.loadBlank(tab)
    }

    return id
  }

  closeTab(tabId: string): void {
    const tab = this.tabs.get(tabId)

    if (!tab) {
      return
    }

    const wasActive = tabId === this.activeTabId
    const closedIndex = this.tabOrder.indexOf(tabId)

    if (wasActive) {
      this.removeActiveView(tab)
      this.activeTabId = ''
    }

    if (!tab.view.webContents.isDestroyed()) {
      tab.view.webContents.close({ waitForBeforeUnload: false })
    }

    this.tabs.delete(tabId)
    this.removeTabId(tabId)

    if (this.tabOrder.length === 0) {
      this.createTab(NEW_TAB_URL, true)
      return
    }

    if (wasActive) {
      const nextIndex = Math.min(Math.max(closedIndex, 0), this.tabOrder.length - 1)
      this.switchTab(this.tabOrder[nextIndex])
      return
    }

    this.pushState()
  }

  switchTab(tabId: string): void {
    const nextTab = this.tabs.get(tabId)

    if (!nextTab) {
      return
    }

    const previousTab = this.getActiveTab()

    if (previousTab && previousTab.id !== nextTab.id) {
      this.removeActiveView(previousTab)
    }

    this.activeTabId = nextTab.id

    if (!previousTab || previousTab.id !== nextTab.id) {
      this.window.contentView.addChildView(nextTab.view)
    }

    this.updateTabNavigationState(nextTab)
    this.updateBounds()
    this.pushState()
  }

  loadUrl(tabId: string, rawInput: string): void {
    const tab = this.tabs.get(tabId)

    if (!tab) {
      return
    }

    const classifiedInput = classifyInput(rawInput)

    if (classifiedInput.kind === 'blank') {
      this.loadBlank(tab)
      return
    }

    tab.attemptedWwwFallbacks.clear()
    tab.url = classifiedInput.url
    tab.title = getDisplayTitle(classifiedInput.url)
    tab.favicon = ''
    tab.error = null
    tab.isLoading = true
    this.pushState()

    void tab.view.webContents.loadURL(classifiedInput.url).catch((error: Error) => {
      this.applyLoadError(tab, {
        url: classifiedInput.url,
        errorCode: 0,
        errorDescription: error.message || 'Failed to load URL'
      })
    })
  }

  goBack(tabId: string): void {
    const tab = this.tabs.get(tabId)

    if (tab?.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack()
    }
  }

  goForward(tabId: string): void {
    const tab = this.tabs.get(tabId)

    if (tab?.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward()
    }
  }

  reload(tabId: string): void {
    const tab = this.tabs.get(tabId)

    if (!tab) {
      return
    }

    if (tab.url) {
      tab.error = null
      tab.view.webContents.reload()
    } else {
      this.loadBlank(tab)
    }
  }

  stop(tabId: string): void {
    const tab = this.tabs.get(tabId)

    if (tab) {
      tab.view.webContents.stop()
      tab.isLoading = false
      this.pushState()
    }
  }

  moveTab(fromIndex: number, toIndex: number): void {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= this.tabOrder.length ||
      toIndex >= this.tabOrder.length
    ) {
      return
    }

    const [tabId] = this.tabOrder.splice(fromIndex, 1)
    this.tabOrder.splice(toIndex, 0, tabId)
    this.pushState()
  }

  zoom(tabId: string, action: ZoomAction): void {
    const tab = this.tabs.get(tabId)

    if (!tab) {
      return
    }

    const nextZoomFactor =
      action === 'reset'
        ? DEFAULT_ZOOM_FACTOR
        : clampZoomFactor(tab.zoomFactor + (action === 'in' ? ZOOM_STEP : -ZOOM_STEP))

    tab.zoomFactor = Number(nextZoomFactor.toFixed(2))
    tab.view.webContents.setZoomFactor(tab.zoomFactor)
    this.pushState()
  }

  handleKeyboardInput(event: Electron.Event, input: Electron.Input): void {
    if (input.type !== 'keyDown') {
      return
    }

    const activeTabId = this.getActiveTabId()
    const key = input.key.toLowerCase()
    const isCtrl = input.control === true || input.meta === true
    const isShift = input.shift === true
    const isAlt = input.alt === true

    if (isCtrl && key === 'l') {
      event.preventDefault()
      this.focusAddressBar()
      return
    }

    if (isCtrl && key === 't') {
      event.preventDefault()
      this.createTab(NEW_TAB_URL, true)
      this.focusAddressBar()
      return
    }

    if (isCtrl && key === 'w') {
      event.preventDefault()
      this.closeTab(activeTabId)
      return
    }

    if ((isCtrl && key === 'r') || key === 'f5') {
      event.preventDefault()
      this.reload(activeTabId)
      return
    }

    if (key === 'escape') {
      event.preventDefault()
      this.stop(activeTabId)
      return
    }

    if (isAlt && key === 'left') {
      event.preventDefault()
      this.goBack(activeTabId)
      return
    }

    if (isAlt && key === 'right') {
      event.preventDefault()
      this.goForward(activeTabId)
      return
    }

    if (isCtrl && key === 'tab') {
      event.preventDefault()
      this.switchRelativeTab(isShift ? -1 : 1)
      return
    }

    if (isCtrl && isShift && key === 'tab') {
      event.preventDefault()
      this.switchRelativeTab(-1)
      return
    }

    if (isCtrl && /^[1-9]$/.test(key)) {
      event.preventDefault()
      this.switchTabByNumber(Number(key))
      return
    }

    if (isCtrl && (key === '+' || key === '=')) {
      event.preventDefault()
      this.zoom(activeTabId, 'in')
      return
    }

    if (isCtrl && key === '-') {
      event.preventDefault()
      this.zoom(activeTabId, 'out')
      return
    }

    if (isCtrl && key === '0') {
      event.preventDefault()
      this.zoom(activeTabId, 'reset')
    }
  }

  getBrowserState(): BrowserState {
    return {
      tabs: this.tabOrder
        .map((tabId) => this.tabs.get(tabId))
        .filter((tab): tab is ManagedTab => Boolean(tab))
        .map((tab) => this.toTabState(tab)),
      activeTabId: this.activeTabId
    }
  }

  getActiveTabId(): string {
    return this.activeTabId
  }

  pushState(): void {
    const state = this.getBrowserState()

    this.updateWindowTitle(this.getActiveTabTitle())

    if (!this.uiView.webContents.isDestroyed()) {
      this.uiView.webContents.send('browser:state', state)
    }

    this.scheduleSessionSave()
  }

  updateBounds(): void {
    if (this.window.isDestroyed()) {
      return
    }

    const { width, height } = this.window.getContentBounds()
    const pageHeight = Math.max(0, height - this.uiHeight)

    this.uiView.setBounds({ x: 0, y: 0, width, height: this.uiHeight })

    const activeTab = this.getActiveTab()

    if (activeTab && !activeTab.view.webContents.isDestroyed()) {
      activeTab.view.setBounds({ x: 0, y: this.uiHeight, width, height: pageHeight })
    }
  }

  restoreSession(session: PersistedSession): void {
    const urls = session.tabs.map((tab) => tab.url).filter((url) => typeof url === 'string')

    if (urls.length === 0) {
      this.createTab(NEW_TAB_URL, true)
      return
    }

    const activeIndex = Math.min(Math.max(session.activeIndex, 0), urls.length - 1)

    urls.forEach((url, index) => {
      this.createTab(url || NEW_TAB_URL, index === activeIndex)
    })
  }

  saveSessionNow(): void {
    if (this.saveSessionTimer) {
      clearTimeout(this.saveSessionTimer)
      this.saveSessionTimer = null
    }

    this.storage.saveSession(this.getPersistedSession())
  }

  cleanup(): void {
    this.saveSessionNow()

    const activeTab = this.getActiveTab()

    if (activeTab) {
      this.removeActiveView(activeTab)
    }

    this.tabs.forEach((tab) => {
      if (!tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close({ waitForBeforeUnload: false })
      }
    })

    this.tabs.clear()
    this.tabOrder.splice(0)
    this.activeTabId = ''
  }

  private bindTabEvents(tab: ManagedTab): void {
    const { webContents } = tab.view

    webContents.setWindowOpenHandler((details) => {
      this.createTab(details.url || NEW_TAB_URL, true, tab.id)
      return { action: 'deny' }
    })

    webContents.on('before-input-event', (event, input) => {
      this.handleKeyboardInput(event, input)
    })

    webContents.on('context-menu', (_event, params) => {
      this.showContextMenu(tab, params)
    })

    webContents.on('did-start-loading', () => {
      tab.isLoading = true
      tab.error = null
      this.updateTabNavigationState(tab)
      this.pushState()
    })

    webContents.on('did-stop-loading', () => {
      tab.isLoading = false
      this.updateTabNavigationState(tab)
      this.pushState()
    })

    webContents.on('did-finish-load', () => {
      tab.isLoading = false
      tab.url = toVisibleUrl(webContents.getURL() || tab.url)
      tab.title = tab.url ? webContents.getTitle() || getDisplayTitle(tab.url) : 'New Tab'
      tab.error = null
      this.updateTabNavigationState(tab)
      this.recordHistory(tab)
      this.pushState()
    })

    webContents.on('did-navigate', (_event, url) => {
      tab.url = toVisibleUrl(url)
      tab.title = getDisplayTitle(tab.url)
      tab.favicon = ''
      tab.error = null
      this.updateTabNavigationState(tab)
      this.recordHistory(tab)
      this.pushState()
    })

    webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (!isMainFrame) {
        return
      }

      tab.url = toVisibleUrl(url)
      tab.error = null
      this.updateTabNavigationState(tab)
      this.recordHistory(tab)
      this.pushState()
    })

    webContents.on('page-title-updated', (_event, title) => {
      tab.title = tab.url ? title || getDisplayTitle(tab.url) : 'New Tab'
      this.recordHistory(tab)
      this.pushState()
    })

    webContents.on('page-favicon-updated', (_event, favicons) => {
      tab.favicon = favicons[0] || ''
      this.pushState()
    })

    webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === ERR_ABORTED) {
          return
        }

        const failedUrl = validatedURL || tab.url

        if (isNameNotResolvedError(errorCode) && this.loadWwwFallback(tab, failedUrl)) {
          return
        }

        this.applyLoadError(tab, {
          url: failedUrl,
          errorCode,
          errorDescription
        })
      }
    )
  }

  private loadBlank(tab: ManagedTab): void {
    tab.url = ''
    tab.title = 'New Tab'
    tab.favicon = ''
    tab.error = null
    tab.isLoading = false
    tab.attemptedWwwFallbacks.clear()
    this.updateTabNavigationState(tab)
    this.pushState()

    void tab.view.webContents.loadURL(BLANK_PAGE_URL).catch((error: Error) => {
      this.applyLoadError(tab, {
        url: BLANK_PAGE_URL,
        errorCode: 0,
        errorDescription: error.message || 'Failed to load blank tab'
      })
    })
  }

  private loadWwwFallback(tab: ManagedTab, failedUrl: string): boolean {
    const fallbackUrl = getWwwFallbackUrl(failedUrl)

    if (!fallbackUrl || tab.attemptedWwwFallbacks.has(failedUrl)) {
      return false
    }

    tab.attemptedWwwFallbacks.add(failedUrl)
    tab.url = fallbackUrl
    tab.title = getDisplayTitle(fallbackUrl)
    tab.favicon = ''
    tab.error = null
    tab.isLoading = true
    this.pushState()

    void tab.view.webContents.loadURL(fallbackUrl).catch((error: Error) => {
      this.applyLoadError(tab, {
        url: fallbackUrl,
        errorCode: 0,
        errorDescription: error.message || 'Failed to load URL'
      })
    })

    return true
  }

  private applyLoadError(tab: ManagedTab, error: LoadError): void {
    tab.url = toVisibleUrl(error.url)
    tab.title = getDisplayTitle(error.url)
    tab.favicon = ''
    tab.isLoading = false
    tab.error = error
    this.updateTabNavigationState(tab)
    this.pushState()
  }

  private updateTabNavigationState(tab: ManagedTab): void {
    if (tab.view.webContents.isDestroyed()) {
      tab.canGoBack = false
      tab.canGoForward = false
      return
    }

    tab.canGoBack = tab.view.webContents.navigationHistory.canGoBack()
    tab.canGoForward = tab.view.webContents.navigationHistory.canGoForward()
  }

  private recordHistory(tab: ManagedTab): void {
    if (!shouldRecordHistory(tab.url)) {
      return
    }

    this.storage.addHistory({
      url: tab.url,
      title: tab.title || getDisplayTitle(tab.url),
      visitedAt: Date.now()
    })
  }

  private showContextMenu(tab: ManagedTab, params: Electron.ContextMenuParams): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Back',
        enabled: tab.canGoBack,
        click: () => this.goBack(tab.id)
      },
      {
        label: 'Forward',
        enabled: tab.canGoForward,
        click: () => this.goForward(tab.id)
      },
      {
        label: 'Reload',
        enabled: Boolean(tab.url),
        click: () => this.reload(tab.id)
      },
      { type: 'separator' },
      {
        label: 'Copy Link',
        visible: Boolean(params.linkURL),
        click: () => clipboard.writeText(params.linkURL)
      },
      {
        label: 'Copy Page URL',
        enabled: Boolean(tab.url),
        click: () => clipboard.writeText(tab.url)
      }
    ]

    Menu.buildFromTemplate(template).popup()
  }

  private switchRelativeTab(direction: 1 | -1): void {
    if (this.tabOrder.length <= 1) {
      return
    }

    const currentIndex = this.tabOrder.indexOf(this.activeTabId)
    const nextIndex = (currentIndex + direction + this.tabOrder.length) % this.tabOrder.length
    this.switchTab(this.tabOrder[nextIndex])
  }

  private switchTabByNumber(number: number): void {
    if (this.tabOrder.length === 0) {
      return
    }

    const targetIndex = number === 9 ? this.tabOrder.length - 1 : number - 1
    const targetTabId = this.tabOrder[targetIndex]

    if (targetTabId) {
      this.switchTab(targetTabId)
    }
  }

  private getActiveTab(): ManagedTab | undefined {
    return this.tabs.get(this.activeTabId)
  }

  private getActiveTabTitle(): string {
    const activeTab = this.getActiveTab()
    return activeTab?.title || 'New Tab'
  }

  private insertTabId(tabId: string, openerTabId?: string): void {
    const openerIndex = openerTabId ? this.tabOrder.indexOf(openerTabId) : -1

    if (openerIndex >= 0) {
      this.tabOrder.splice(openerIndex + 1, 0, tabId)
      return
    }

    this.tabOrder.push(tabId)
  }

  private removeTabId(tabId: string): void {
    const index = this.tabOrder.indexOf(tabId)

    if (index >= 0) {
      this.tabOrder.splice(index, 1)
    }
  }

  private removeActiveView(tab: ManagedTab): void {
    try {
      this.window.contentView.removeChildView(tab.view)
    } catch {
      // The view may already be detached during window shutdown.
    }
  }

  private scheduleSessionSave(): void {
    if (this.saveSessionTimer) {
      clearTimeout(this.saveSessionTimer)
    }

    this.saveSessionTimer = setTimeout(() => {
      this.saveSessionTimer = null
      this.storage.saveSession(this.getPersistedSession())
    }, 250)
  }

  private getPersistedSession(): PersistedSession {
    return {
      tabs: this.tabOrder
        .map((tabId) => this.tabs.get(tabId))
        .filter((tab): tab is ManagedTab => Boolean(tab))
        .map((tab) => ({
          url: tab.url,
          title: tab.title
        })),
      activeIndex: Math.max(0, this.tabOrder.indexOf(this.activeTabId))
    }
  }

  private toTabState(tab: ManagedTab): TabState {
    this.updateTabNavigationState(tab)

    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon,
      isLoading: tab.isLoading,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      error: tab.error,
      zoomFactor: tab.zoomFactor
    }
  }
}

function clampZoomFactor(value: number): number {
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, value))
}
