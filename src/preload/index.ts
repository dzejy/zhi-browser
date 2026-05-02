/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserLayout, SidePanelType } from '../shared/types'
import type { AISelectionAction } from '../shared/aiTypes'

const rendererUrl = process.env['ELECTRON_RENDERER_URL']
const normalizedPath = window.location.pathname.replace(/\\/g, '/')
const isRendererApp = rendererUrl
  ? window.location.href.startsWith(rendererUrl)
  : window.location.protocol === 'file:' && normalizedPath.endsWith('/renderer/index.html')

interface UserScriptSummary {
  id: string
  meta: {
    name: string
    version: string
    description: string
    author: string
    match: string[]
    [key: string]: unknown
  }
  enabled: boolean
  installTime: number
  updateTime: number
}

interface UserScriptInstallResult {
  id?: string
  meta?: Record<string, unknown>
  enabled?: boolean
  success?: boolean
  error?: string
}

const api = {
  // ===== Tab commands =====
  createTab: (url?: string) => ipcRenderer.send('tab:create', { url }),
  closeTab: (tabId: string) => ipcRenderer.send('tab:close', { tabId }),
  switchTab: (tabId: string) => ipcRenderer.send('tab:switch', { tabId }),
  loadUrl: (tabId: string, url: string) => ipcRenderer.send('tab:load-url', { tabId, url }),
  goBack: (tabId: string) => ipcRenderer.send('tab:back', { tabId }),
  goForward: (tabId: string) => ipcRenderer.send('tab:forward', { tabId }),
  reload: (tabId: string) => ipcRenderer.send('tab:reload', { tabId }),
  stop: (tabId: string) => ipcRenderer.send('tab:stop', { tabId }),
  retryLoad: (tabId: string) => ipcRenderer.send('tab:retry', { tabId }),
  zoomIn: (tabId: string) => ipcRenderer.send('tab:zoom', { tabId, action: 'in' }),
  zoomOut: (tabId: string) => ipcRenderer.send('tab:zoom', { tabId, action: 'out' }),
  zoomReset: (tabId: string) => ipcRenderer.send('tab:zoom', { tabId, action: 'reset' }),
  togglePin: (tabId: string) => ipcRenderer.send('tab:toggle-pin', { tabId }),
  restoreClosed: () => ipcRenderer.send('tab:restore-closed'),
  moveTab: (tabId: string, toIndex: number) => ipcRenderer.send('tab:move', { tabId, toIndex }),
  openUrl: (url: string, newTab?: boolean) => ipcRenderer.send('tab:open-url', { url, newTab }),
  tabContextMenu: (tabId: string) => ipcRenderer.invoke('tab:context-menu', tabId),
  duplicateTab: (tabId: string) => ipcRenderer.invoke('tab:duplicate', tabId),
  closeOtherTabs: (tabId: string) => ipcRenderer.invoke('tab:close-others', tabId),
  closeTabsToRight: (tabId: string) => ipcRenderer.invoke('tab:close-right', tabId),
  toggleMuteTab: (tabId: string) => ipcRenderer.invoke('tab:toggle-mute', tabId),

  // ===== Layout =====
  setUiHeight: (height: number) => ipcRenderer.send('ui:set-height', height),
  setLayout: (layout: BrowserLayout) => ipcRenderer.send('ui:set-layout', layout),
  showPanel: (type: SidePanelType) => ipcRenderer.send('panel:show', { type }),
  hidePanel: () => ipcRenderer.send('panel:hide'),
  popupMenu: () => ipcRenderer.invoke('menu:popup'),

  // ===== Find =====
  findStart: (tabId: string, text: string, options?: { forward?: boolean; matchCase?: boolean }) =>
    ipcRenderer.send('find:start', { tabId, text, options }),
  findNext: (tabId: string, forward: boolean) => ipcRenderer.send('find:next', { tabId, forward }),
  findStop: (tabId: string, action: 'clearSelection' | 'keepSelection') =>
    ipcRenderer.send('find:stop', { tabId, action }),

  // ===== Bookmarks =====
  addBookmark: (url: string, title: string, favicon: string) =>
    ipcRenderer.invoke('bookmark:add-current', { url, title, favicon }),
  removeBookmark: (url: string) => ipcRenderer.invoke('bookmark:remove', { url }),
  getBookmarks: () => ipcRenderer.invoke('bookmark:list'),
  updateBookmark: (id: string, title: string, url: string) =>
    ipcRenderer.invoke('bookmarks:update', id, title, url),
  clearBookmarks: () => ipcRenderer.invoke('bookmarks:clear'),
  toggleBookmarkBar: () => ipcRenderer.invoke('bookmarkBar:toggle'),
  getBookmarkBarVisible: () => ipcRenderer.invoke('bookmarkBar:get-visible'),

  // ===== History =====
  getHistory: (limit?: number, query?: string) =>
    ipcRenderer.invoke('history:list', { limit, query }),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  removeHistoryEntry: (id: string) => ipcRenderer.invoke('history:remove', id),

  // ===== Downloads =====
  getDownloads: () => ipcRenderer.invoke('downloads:list'),
  openDownloadFile: (downloadId: string) => ipcRenderer.invoke('downloads:open-file', downloadId),
  showInFolder: (downloadId: string) => ipcRenderer.invoke('downloads:show-in-folder', downloadId),
  showDownloadInFolder: (downloadId: string) =>
    ipcRenderer.invoke('downloads:show-in-folder', downloadId),
  removeDownload: (downloadId: string) => ipcRenderer.invoke('downloads:remove', downloadId),
  clearDownloads: () => ipcRenderer.invoke('downloads:clear'),

  // ===== Settings =====
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:update', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  resetPreferenceGroup: (group: string) => ipcRenderer.invoke('settings:reset-group', group),
  exportSettings: () => ipcRenderer.invoke('settings:export'),
  importSettings: () => ipcRenderer.invoke('settings:import'),
  selectDownloadPath: () => ipcRenderer.invoke('settings:select-download-path'),
  openUserDataFolder: () => ipcRenderer.invoke('settings:open-user-data'),
  setDefaultBrowser: (): Promise<void> => ipcRenderer.invoke('default-browser:set'),
  isDefaultBrowser: (): Promise<boolean> => ipcRenderer.invoke('default-browser:is-default'),
  toggleDarkMode: (): Promise<boolean> => ipcRenderer.invoke('darkMode:toggle'),
  getDarkMode: (): Promise<boolean> => ipcRenderer.invoke('darkMode:get'),

  // ===== AdBlock Zhi =====
  getAdBlockState: () => ipcRenderer.invoke('adblock:get-state'),
  setAdBlockEnabled: (enabled: boolean) => ipcRenderer.invoke('adblock:set-enabled', enabled),
  addAdBlockWhitelist: (hostname: string) => ipcRenderer.invoke('adblock:add-whitelist', hostname),
  removeAdBlockWhitelist: (hostname: string) =>
    ipcRenderer.invoke('adblock:remove-whitelist', hostname),
  clearAdBlockCount: () => ipcRenderer.invoke('adblock:clear-count'),
  getCurrentSiteForAdBlock: () => ipcRenderer.invoke('adblock:get-current-site'),
  toggleCurrentSiteAdBlockWhitelist: () =>
    ipcRenderer.invoke('adblock:toggle-current-site-whitelist'),

  // ===== AI =====
  getAIStatus: () => ipcRenderer.invoke('ai:get-status'),
  testAIConnection: () => ipcRenderer.invoke('ai:test-connection'),
  extractCurrentPage: () => ipcRenderer.invoke('ai:extract-current-page'),
  extractSelection: () => ipcRenderer.invoke('ai:extract-selection'),
  summarizeCurrentPage: () => ipcRenderer.invoke('ai:summarize-page'),
  verifyCurrentPage: () => ipcRenderer.invoke('ai:verify-page'),
  searchCurrentPage: () => ipcRenderer.invoke('ai:search-page'),
  debateCurrentPage: () => ipcRenderer.invoke('ai:debate-page'),
  youAskCurrentPage: () => ipcRenderer.invoke('ai:you-ask-page'),
  explainCurrentPage: () => ipcRenderer.invoke('ai:explain-page'),
  askCurrentPage: (question: string) => ipcRenderer.invoke('ai:ask-page', question),
  chatWithAI: (message: string) => ipcRenderer.invoke('ai:chat', message),
  translateSelection: () => ipcRenderer.invoke('ai:translate-selection'),
  explainSelection: () => ipcRenderer.invoke('ai:explain-selection'),
  summarizeSelection: () => ipcRenderer.invoke('ai:summarize-selection'),
  translatePage: (enable: boolean): Promise<void> => ipcRenderer.invoke('translate:page', enable),

  // ===== User scripts =====
  userscriptGetAll: (): Promise<UserScriptSummary[]> => ipcRenderer.invoke('userscript:get-all'),
  userscriptGetCode: (id: string): Promise<string> => ipcRenderer.invoke('userscript:get-code', id),
  userscriptInstall: (code: string): Promise<UserScriptInstallResult> =>
    ipcRenderer.invoke('userscript:install', code),
  userscriptInstallFromUrl: (url: string): Promise<UserScriptInstallResult> =>
    ipcRenderer.invoke('userscript:install-from-url', url),
  userscriptRemove: (id: string): Promise<boolean> => ipcRenderer.invoke('userscript:remove', id),
  userscriptToggle: (id: string, enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('userscript:toggle', id, enabled),
  userscriptUpdate: (id: string): Promise<{ success: boolean; newVersion?: string; error?: string }> =>
    ipcRenderer.invoke('userscript:update', id),

  // ===== Reader mode =====
  readerEnter: () => ipcRenderer.invoke('reader:enter'),
  readerExit: () => ipcRenderer.invoke('reader:exit'),
  readerCanExtract: () => ipcRenderer.invoke('reader:canExtract'),

  // ===== Resource sniffer =====
  snifferGetResources: () => ipcRenderer.invoke('sniffer:getResources'),
  snifferGetResourcesForTab: (tabId: number) =>
    ipcRenderer.invoke('sniffer:getResourcesForTab', tabId),
  snifferClearTab: (tabId: number) => ipcRenderer.invoke('sniffer:clearTab', tabId),

  // ===== External downloader =====
  downloaderSend: (task: { url: string; filename?: string; referer?: string }) =>
    ipcRenderer.invoke('downloader:send', task),
  downloaderDetect: () => ipcRenderer.invoke('downloader:detect'),
  downloaderGetConfig: () => ipcRenderer.invoke('downloader:getConfig'),

  // ===== Tab preview =====
  tabPreviewCapture: (tabId: number): Promise<string | null> =>
    ipcRenderer.invoke('tabPreview:capture', tabId),
  tabPreviewClear: (tabId: number): Promise<void> => ipcRenderer.invoke('tabPreview:clear', tabId),

  // ===== Web panel =====
  webPanelOpen: (url: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('webPanel:open', url),
  webPanelClose: (): Promise<boolean> => ipcRenderer.invoke('webPanel:close'),
  webPanelToggle: (): Promise<boolean> => ipcRenderer.invoke('webPanel:toggle'),
  webPanelNavigate: (url: string): Promise<boolean> => ipcRenderer.invoke('webPanel:navigate', url),
  webPanelIsVisible: (): Promise<boolean> => ipcRenderer.invoke('webPanel:isVisible'),
  webPanelGetUrl: (): Promise<string | null> => ipcRenderer.invoke('webPanel:getUrl'),
  webPanelGetSaved: (): Promise<Array<{ url: string; title: string; pinned: boolean }>> =>
    ipcRenderer.invoke('webPanel:getSaved'),
  webPanelSave: (panels: Array<{ url: string; title: string; pinned: boolean }>): Promise<boolean> =>
    ipcRenderer.invoke('webPanel:save', panels),
  webPanelRemove: (url: string): Promise<boolean> => ipcRenderer.invoke('webPanel:remove', url),

  // ===== Mouse gestures =====
  gestureExecute: (action: string, webContentsId: number): Promise<boolean> =>
    ipcRenderer.invoke('gesture:execute', action, webContentsId),
  gestureGetConfig: (): Promise<Array<{ pattern: string; action: string; label: string }>> =>
    ipcRenderer.invoke('gesture:getConfig'),

  // ===== Split view =====
  splitViewOpen: (url: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('splitView:open', url),
  splitViewClose: (): Promise<boolean> => ipcRenderer.invoke('splitView:close'),
  splitViewGetState: (): Promise<{ active: boolean; rightUrl: string | null }> =>
    ipcRenderer.invoke('splitView:getState'),
  splitViewNavigate: (url: string): Promise<boolean> => ipcRenderer.invoke('splitView:navigate', url),
  splitViewGoBack: (): Promise<boolean> => ipcRenderer.invoke('splitView:goBack'),
  splitViewGoForward: (): Promise<boolean> => ipcRenderer.invoke('splitView:goForward'),
  splitViewReload: (): Promise<boolean> => ipcRenderer.invoke('splitView:reload'),
  splitViewSwap: (): Promise<string | false> => ipcRenderer.invoke('splitView:swap'),

  // ===== Browser state =====
  getBrowserState: () => ipcRenderer.invoke('browser:get-state'),
  getAboutInfo: () => ipcRenderer.invoke('browser:get-about-info'),
  copyToClipboard: (text: string) => ipcRenderer.invoke('util:copy-to-clipboard', text),

  // ===== Listeners (Main → Renderer) =====
  onBrowserState: (callback: (state: unknown) => void): (() => void) => {
    const handler = (_event: unknown, state: unknown) => callback(state)
    ipcRenderer.on('browser:state', handler)
    return () => ipcRenderer.removeListener('browser:state', handler)
  },
  onFocusAddressBar: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:focus-address-bar', handler)
    return () => ipcRenderer.removeListener('browser:focus-address-bar', handler)
  },
  onFocusFind: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:focus-find', handler)
    return () => ipcRenderer.removeListener('browser:focus-find', handler)
  },
  onToggleBookmark: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:toggle-bookmark', handler)
    return () => ipcRenderer.removeListener('browser:toggle-bookmark', handler)
  },
  onBookmarkBarChanged: (callback: (visible: boolean) => void): (() => void) => {
    const handler = (_event: unknown, visible: boolean): void => callback(visible)
    ipcRenderer.on('bookmarkBar:visibility-changed', handler)
    return () => ipcRenderer.removeListener('bookmarkBar:visibility-changed', handler)
  },
  onBookmarksChanged: (callback: (bookmarks: unknown) => void): (() => void) => {
    const handler = (_event: unknown, bookmarks: unknown): void => callback(bookmarks)
    ipcRenderer.on('bookmarks:changed', handler)
    return () => ipcRenderer.removeListener('bookmarks:changed', handler)
  },
  onFindResult: (
    callback: (result: { activeMatchOrdinal: number; matches: number }) => void
  ): (() => void) => {
    const handler = (_event: unknown, result: { activeMatchOrdinal: number; matches: number }) =>
      callback(result)
    ipcRenderer.on('browser:find-result', handler)
    return () => ipcRenderer.removeListener('browser:find-result', handler)
  },
  onDownloadUpdate: (callback: (item: unknown) => void): (() => void) => {
    const handler = (_event: unknown, item: unknown): void => callback(item)
    ipcRenderer.on('browser:download-update', handler)
    return () => ipcRenderer.removeListener('browser:download-update', handler)
  },
  onDownloadCompleted: (callback: (item: unknown) => void): (() => void) => {
    const handler = (_event: unknown, item: unknown): void => callback(item)
    ipcRenderer.on('browser:download-completed', handler)
    return () => ipcRenderer.removeListener('browser:download-completed', handler)
  },
  onHoverUrl: (callback: (url: string) => void): (() => void) => {
    const handler = (_event: unknown, url: string): void => callback(url)
    ipcRenderer.on('browser:hover-url', handler)
    return () => ipcRenderer.removeListener('browser:hover-url', handler)
  },
  onAdBlockStateChanged: (callback: (state: unknown) => void): (() => void) => {
    const handler = (_event: unknown, state: unknown): void => callback(state)
    ipcRenderer.on('adblock:state-changed', handler)
    return () => ipcRenderer.removeListener('adblock:state-changed', handler)
  },
  onToast: (callback: (msg: unknown) => void): (() => void) => {
    const handler = (_event: unknown, msg: unknown) => callback(msg)
    ipcRenderer.on('browser:toast', handler)
    return () => ipcRenderer.removeListener('browser:toast', handler)
  },
  onSettings: (callback: (settings: unknown) => void): (() => void) => {
    const handler = (_event: unknown, settings: unknown) => callback(settings)
    ipcRenderer.on('browser:settings', handler)
    return () => ipcRenderer.removeListener('browser:settings', handler)
  },
  onOpenHistoryPanel: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:open-history-panel', handler)
    return () => ipcRenderer.removeListener('browser:open-history-panel', handler)
  },
  onOpenBookmarksPanel: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:open-bookmarks-panel', handler)
    return () => ipcRenderer.removeListener('browser:open-bookmarks-panel', handler)
  },
  onOpenDownloadsPanel: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:open-downloads-panel', handler)
    return () => ipcRenderer.removeListener('browser:open-downloads-panel', handler)
  },
  onOpenSettingsPanel: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:open-settings-panel', handler)
    return () => ipcRenderer.removeListener('browser:open-settings-panel', handler)
  },
  onOpenAIPanel: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:open-ai-panel', handler)
    return () => ipcRenderer.removeListener('browser:open-ai-panel', handler)
  },
  onOpenPanel: (callback: (type: SidePanelType) => void): (() => void) => {
    const handler = (_event: unknown, type: SidePanelType): void => callback(type)
    ipcRenderer.on('browser:open-panel', handler)
    return () => ipcRenderer.removeListener('browser:open-panel', handler)
  },
  onToggleAIPanel: (callback: () => void): (() => void) => {
    const handler = (): void => {
      callback()
    }
    ipcRenderer.on('browser:toggle-ai-panel', handler)
    return () => {
      ipcRenderer.removeListener('browser:toggle-ai-panel', handler)
    }
  },
  onAITriggerAction: (callback: (action: AISelectionAction) => void): (() => void) => {
    const handler = (_event: unknown, action: AISelectionAction): void => callback(action)
    ipcRenderer.on('ai:trigger-action', handler)
    return () => ipcRenderer.removeListener('ai:trigger-action', handler)
  },
  onOpenAboutPanel: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:open-about-panel', handler)
    return () => ipcRenderer.removeListener('browser:open-about-panel', handler)
  },
  onAddBookmark: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:add-bookmark', handler)
    return () => ipcRenderer.removeListener('browser:add-bookmark', handler)
  },
  onClearDataConfirm: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:clear-data-confirm', handler)
    return () => ipcRenderer.removeListener('browser:clear-data-confirm', handler)
  },
  onPanelType: (callback: (type: SidePanelType) => void): (() => void) => {
    const handler = (_event: unknown, type: SidePanelType) => callback(type)
    ipcRenderer.on('browser:panel-type', handler)
    return () => ipcRenderer.removeListener('browser:panel-type', handler)
  },
  onPanelClosed: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('browser:panel-closed', handler)
    return () => ipcRenderer.removeListener('browser:panel-closed', handler)
  },
  onResourceFound: (callback: (data: { tabId: number; count: number }) => void): (() => void) => {
    const handler = (_event: unknown, data: { tabId: number; count: number }): void =>
      callback(data)
    ipcRenderer.on('sniffer:resource-found', handler)
    return () => ipcRenderer.removeListener('sniffer:resource-found', handler)
  },
  onUserScriptInstalled: (callback: (data: { name: string }) => void): (() => void) => {
    const handler = (_event: unknown, data: { name: string }): void => callback(data)
    ipcRenderer.on('userscript:installed', handler)
    return () => ipcRenderer.removeListener('userscript:installed', handler)
  }
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return
  if (event.data && event.data.type === 'zhi-userscript-gm-call') {
    const { scriptId, callId, method, args } = event.data
    try {
      const result = await ipcRenderer.invoke('userscript:gm-call', scriptId, method, args)
      window.postMessage(
        {
          type: 'zhi-userscript-gm-response',
          scriptId,
          callId,
          result,
          error: null
        },
        '*'
      )
    } catch (error) {
      window.postMessage(
        {
          type: 'zhi-userscript-gm-response',
          scriptId,
          callId,
          result: null,
          error: String(error)
        },
        '*'
      )
    }
  }
})

ipcRenderer.on('splitView:openFromMenu', (_event, url: string) => {
  ipcRenderer.invoke('splitView:open', url).catch(() => {})
})

if (!isRendererApp) {
  void (function setupMouseGesture() {
    const threshold = 30
    const knownGestures = new Set(['L', 'R', 'D', 'U', 'DR', 'UD', 'DU', 'LR', 'RD'])
    let isGesturing = false
    let startX = 0
    let startY = 0
    let lastX = 0
    let lastY = 0
    let directions: string[] = []
    let suppressContextMenu = false
    let gestureTrail: HTMLCanvasElement | null = null
    let trailCtx: CanvasRenderingContext2D | null = null

    function createTrailCanvas(): void {
      gestureTrail = document.createElement('canvas')
      gestureTrail.id = 'zhi-gesture-trail'
      gestureTrail.style.cssText =
        'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;pointer-events:none;'
      gestureTrail.width = window.innerWidth
      gestureTrail.height = window.innerHeight
      const parent = document.body || document.documentElement
      parent.appendChild(gestureTrail)
      trailCtx = gestureTrail.getContext('2d')
      if (trailCtx) {
        trailCtx.strokeStyle = 'rgba(99, 102, 241, 0.6)'
        trailCtx.lineWidth = 3
        trailCtx.lineCap = 'round'
        trailCtx.lineJoin = 'round'
      }
    }

    function removeTrailCanvas(): void {
      if (gestureTrail) {
        gestureTrail.remove()
        gestureTrail = null
        trailCtx = null
      }
    }

    function getDirection(dx: number, dy: number): string | null {
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      if (absDx < threshold && absDy < threshold) return null
      if (absDx > absDy) return dx > 0 ? 'R' : 'L'
      return dy > 0 ? 'D' : 'U'
    }

    document.addEventListener('mousedown', (event) => {
      if (event.button !== 2) return
      isGesturing = true
      suppressContextMenu = false
      startX = event.clientX
      startY = event.clientY
      lastX = event.clientX
      lastY = event.clientY
      directions = []
    })

    document.addEventListener('mousemove', (event) => {
      if (!isGesturing) return

      const dx = event.clientX - lastX
      const dy = event.clientY - lastY

      if (
        !gestureTrail &&
        (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10)
      ) {
        createTrailCanvas()
        if (trailCtx) {
          trailCtx.beginPath()
          trailCtx.moveTo(startX, startY)
        }
      }
      if (trailCtx) {
        trailCtx.lineTo(event.clientX, event.clientY)
        trailCtx.stroke()
      }

      const dir = getDirection(dx, dy)
      if (dir && dir !== directions[directions.length - 1]) {
        directions.push(dir)
        lastX = event.clientX
        lastY = event.clientY
      }
    })

    document.addEventListener('mouseup', (event) => {
      if (event.button !== 2) return
      if (!isGesturing) return
      isGesturing = false

      removeTrailCanvas()

      if (directions.length > 0) {
        const pattern = directions.join('')
        suppressContextMenu = knownGestures.has(pattern)
        if (suppressContextMenu) {
          ipcRenderer.invoke('gesture:execute', pattern, 0).catch(() => {})
          event.preventDefault()
          event.stopPropagation()
        }
      }
    })

    document.addEventListener('contextmenu', (event) => {
      if (suppressContextMenu) {
        event.preventDefault()
        suppressContextMenu = false
      }
    })
  })()
}

if (isRendererApp && process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose API:', error)
  }
} else if (isRendererApp) {
  // @ts-ignore: Expose API to window for fallback usage
  window.api = api
}
