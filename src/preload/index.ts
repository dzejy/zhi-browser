/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserLayout, SidePanelType } from '../shared/types'
import type { AISelectionAction } from '../shared/aiTypes'

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
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose API:', error)
  }
} else {
  // @ts-ignore: Expose API to window for fallback usage
  window.api = api
}
