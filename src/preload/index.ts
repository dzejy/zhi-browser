import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  BookmarkItem,
  BrowserState,
  DownloadItem,
  HistoryItem,
  ZoomAction
} from '../shared/types'

type Unsubscribe = () => void

const api = {
  createTab: (url?: string): void => {
    ipcRenderer.send('tab:create', { url })
  },
  closeTab: (tabId: string): void => {
    ipcRenderer.send('tab:close', { tabId })
  },
  switchTab: (tabId: string): void => {
    ipcRenderer.send('tab:switch', { tabId })
  },
  loadUrl: (tabId: string, url: string): void => {
    ipcRenderer.send('tab:load-url', { tabId, url })
  },
  goBack: (tabId: string): void => {
    ipcRenderer.send('tab:back', { tabId })
  },
  goForward: (tabId: string): void => {
    ipcRenderer.send('tab:forward', { tabId })
  },
  reload: (tabId: string): void => {
    ipcRenderer.send('tab:reload', { tabId })
  },
  stop: (tabId: string): void => {
    ipcRenderer.send('tab:stop', { tabId })
  },
  zoom: (tabId: string, action: ZoomAction): void => {
    ipcRenderer.send('tab:zoom', { tabId, action })
  },
  requestState: (): void => {
    ipcRenderer.send('browser:request-state')
  },
  addBookmark: (bookmark: Omit<BookmarkItem, 'createdAt'>): Promise<BookmarkItem | null> => {
    return ipcRenderer.invoke('bookmark:add', bookmark)
  },
  removeBookmark: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke('bookmark:remove', { url })
  },
  listBookmarks: (): Promise<BookmarkItem[]> => {
    return ipcRenderer.invoke('bookmark:list')
  },
  listHistory: (limit?: number): Promise<HistoryItem[]> => {
    return ipcRenderer.invoke('history:list', { limit })
  },
  clearHistory: (): Promise<boolean> => {
    return ipcRenderer.invoke('history:clear')
  },
  onBrowserState: (callback: (state: BrowserState) => void): Unsubscribe => {
    return subscribe('browser:state', callback)
  },
  onFocusAddressBar: (callback: () => void): Unsubscribe => {
    const listener = (): void => {
      callback()
    }

    ipcRenderer.on('browser:focus-address-bar', listener)

    return () => {
      ipcRenderer.removeListener('browser:focus-address-bar', listener)
    }
  },
  onDownloadUpdate: (callback: (download: DownloadItem) => void): Unsubscribe => {
    return subscribe('browser:download-update', callback)
  }
}

function subscribe<T>(channel: string, callback: (value: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, value: T): void => {
    callback(value)
  }

  ipcRenderer.on(channel, listener)

  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
