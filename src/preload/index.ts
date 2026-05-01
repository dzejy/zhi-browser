import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

interface PageState {
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface PageLoadError {
  url: string
  errorCode: number
  errorDescription: string
}

type PageStateCallback = (state: PageState) => void
type PageLoadErrorCallback = (errorInfo: PageLoadError) => void
type FocusAddressBarCallback = () => void

const pageStateListeners = new Map<
  PageStateCallback,
  (event: IpcRendererEvent, state: PageState) => void
>()
const pageErrorListeners = new Map<
  PageLoadErrorCallback,
  (event: IpcRendererEvent, errorInfo: PageLoadError) => void
>()
const focusAddressBarListeners = new Map<
  FocusAddressBarCallback,
  (event: IpcRendererEvent) => void
>()

const api = {
  navigateTo: (url: string): void => {
    ipcRenderer.send('nav:go', url)
  },
  goBack: (): void => {
    ipcRenderer.send('nav:back')
  },
  goForward: (): void => {
    ipcRenderer.send('nav:forward')
  },
  reload: (): void => {
    ipcRenderer.send('nav:reload')
  },
  stop: (): void => {
    ipcRenderer.send('nav:stop')
  },
  onPageStateUpdate: (callback: PageStateCallback): void => {
    const listener = (_event: IpcRendererEvent, state: PageState): void => {
      callback(state)
    }

    pageStateListeners.set(callback, listener)
    ipcRenderer.on('page:state-update', listener)
    ipcRenderer.send('page:request-state')
  },
  onPageLoadError: (callback: PageLoadErrorCallback): void => {
    const listener = (_event: IpcRendererEvent, errorInfo: PageLoadError): void => {
      callback(errorInfo)
    }

    pageErrorListeners.set(callback, listener)
    ipcRenderer.on('page:load-error', listener)
  },
  onFocusAddressBar: (callback: FocusAddressBarCallback): void => {
    const listener = (): void => {
      callback()
    }

    focusAddressBarListeners.set(callback, listener)
    ipcRenderer.on('browser:focus-address-bar', listener)
  },
  removeAllListeners: (): void => {
    pageStateListeners.forEach((listener) => {
      ipcRenderer.removeListener('page:state-update', listener)
    })
    pageErrorListeners.forEach((listener) => {
      ipcRenderer.removeListener('page:load-error', listener)
    })
    focusAddressBarListeners.forEach((listener) => {
      ipcRenderer.removeListener('browser:focus-address-bar', listener)
    })

    pageStateListeners.clear()
    pageErrorListeners.clear()
    focusAddressBarListeners.clear()
  }
}

const electronApi = {
  process: {
    versions: process.versions
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronApi)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronApi
  // @ts-ignore (define in dts)
  window.api = api
}
