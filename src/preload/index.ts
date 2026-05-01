/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserLayout, SidePanelType } from '../shared/types'

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

  // ===== Layout =====
  setUiHeight: (height: number) => ipcRenderer.send('ui:set-height', height),
  setLayout: (layout: BrowserLayout) => ipcRenderer.send('ui:set-layout', layout),
  showPanel: (type: SidePanelType) => ipcRenderer.send('panel:show', { type }),
  hidePanel: () => ipcRenderer.send('panel:hide'),

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
  selectDownloadPath: () => ipcRenderer.invoke('settings:select-download-path'),
  openUserDataFolder: () => ipcRenderer.invoke('settings:open-user-data'),

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
