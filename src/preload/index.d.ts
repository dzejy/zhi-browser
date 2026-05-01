export interface PageState {
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface PageLoadError {
  url: string
  errorCode: number
  errorDescription: string
}

export interface ZhiBrowserAPI {
  navigateTo: (url: string) => void
  goBack: () => void
  goForward: () => void
  reload: () => void
  stop: () => void
  onPageStateUpdate: (callback: (state: PageState) => void) => void
  onPageLoadError: (callback: (errorInfo: PageLoadError) => void) => void
  onFocusAddressBar: (callback: () => void) => void
  removeAllListeners: () => void
}

export interface ZhiElectronAPI {
  process: {
    versions: Record<string, string>
  }
}

declare global {
  interface Window {
    electron: ZhiElectronAPI
    api: ZhiBrowserAPI
  }
}
