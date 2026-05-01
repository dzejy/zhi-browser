import { useCallback, useEffect, useRef, useState } from 'react'

interface ErrorInfo {
  url: string
  errorCode: number
  errorDescription: string
}

interface WebviewTitleEvent extends Event {
  title?: string
}

interface WebviewFailLoadEvent extends Event {
  isMainFrame?: boolean
  errorCode: number
  errorDescription?: string
  validatedURL?: string
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (/^(localhost|127\.0\.0\.1|192\.168\.)/i.test(trimmed)) {
    return `http://${trimmed}`
  }

  return `https://${trimmed}`
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

function App(): React.JSX.Element {
  const [addressValue, setAddressValue] = useState('')
  const [loadedUrl, setLoadedUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pageTitle, setPageTitle] = useState('New Tab')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const webviewRef = useRef<BrowserWebviewElement | null>(null)
  const addressInputRef = useRef<HTMLInputElement | null>(null)

  const focusAddressInput = useCallback((): void => {
    addressInputRef.current?.focus()
    addressInputRef.current?.select()
  }, [])

  const updateNavState = useCallback((): void => {
    const webview = webviewRef.current

    if (!webview) {
      setCanGoBack(false)
      setCanGoForward(false)
      return
    }

    try {
      setCanGoBack(webview.canGoBack())
      setCanGoForward(webview.canGoForward())
    } catch {
      setCanGoBack(false)
      setCanGoForward(false)
    }
  }, [])

  const handleNavigate = (): void => {
    const nextUrl = normalizeUrl(addressValue)

    if (!nextUrl) {
      return
    }

    setErrorInfo(null)
    setAddressValue(nextUrl)
    setPageTitle(getHostname(nextUrl))
    setLoadedUrl(nextUrl)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      handleNavigate()
    }
  }

  const handleBack = (): void => {
    const webview = webviewRef.current

    if (webview?.canGoBack()) {
      setErrorInfo(null)
      webview.goBack()
    }
  }

  const handleForward = (): void => {
    const webview = webviewRef.current

    if (webview?.canGoForward()) {
      setErrorInfo(null)
      webview.goForward()
    }
  }

  const handleRefresh = (): void => {
    const webview = webviewRef.current

    if (!webview) {
      return
    }

    if (isLoading) {
      webview.stop()
      return
    }

    setErrorInfo(null)
    webview.reload()
  }

  const handleRetry = (): void => {
    const webview = webviewRef.current

    setErrorInfo(null)

    if (webview) {
      webview.reload()
      return
    }

    setLoadedUrl(errorInfo?.url || loadedUrl)
  }

  useEffect(() => {
    const webview = webviewRef.current

    if (!webview) {
      return
    }

    const handleDidNavigate: EventListener = (event) => {
      const navigationEvent = event as WebviewNavigationEvent

      setAddressValue(navigationEvent.url)
      setPageTitle(getHostname(navigationEvent.url))
      setErrorInfo(null)
      updateNavState()
    }

    const handleDidNavigateInPage: EventListener = (event) => {
      const navigationEvent = event as WebviewNavigationEvent

      if (navigationEvent.isMainFrame) {
        setAddressValue(navigationEvent.url)
        setPageTitle(getHostname(navigationEvent.url))
        setErrorInfo(null)
      }

      updateNavState()
    }

    const handleDidStartLoading = (): void => {
      setIsLoading(true)
    }

    const handleDidStopLoading = (): void => {
      setIsLoading(false)
      updateNavState()
    }

    const handlePageTitleUpdated: EventListener = (event) => {
      const titleEvent = event as WebviewTitleEvent

      if (titleEvent.title) {
        setPageTitle(titleEvent.title)
      }
    }

    const handleDidFailLoad: EventListener = (event) => {
      const failEvent = event as WebviewFailLoadEvent

      if (!failEvent.isMainFrame || failEvent.errorCode === -3) {
        return
      }

      setIsLoading(false)
      setPageTitle(getHostname(failEvent.validatedURL || loadedUrl))
      setErrorInfo({
        url: failEvent.validatedURL || loadedUrl,
        errorCode: failEvent.errorCode,
        errorDescription: failEvent.errorDescription || 'Unknown error'
      })
      updateNavState()
    }

    const handleDidFinishLoad = (): void => {
      updateNavState()
    }

    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)
    webview.addEventListener('did-finish-load', handleDidFinishLoad)
    webview.addEventListener('page-title-updated', handlePageTitleUpdated)
    webview.addEventListener('did-fail-load', handleDidFailLoad)

    return () => {
      webview.removeEventListener('did-navigate', handleDidNavigate)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.removeEventListener('did-start-loading', handleDidStartLoading)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading)
      webview.removeEventListener('did-finish-load', handleDidFinishLoad)
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated)
      webview.removeEventListener('did-fail-load', handleDidFailLoad)
    }
  }, [loadedUrl, updateNavState])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        focusAddressInput()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [focusAddressInput])

  useEffect(() => {
    return window.electron.ipcRenderer.on('browser:focus-address-bar', () => {
      focusAddressInput()
    })
  }, [focusAddressInput])

  return (
    <div className="browser-shell">
      <header className="browser-header">
        <div className="tab-bar" aria-label="Tab bar placeholder">
          <div className="tab is-active">
            <span className="tab-title">{pageTitle}</span>
          </div>
          <button className="new-tab-button" type="button" title="New tab placeholder">
            +
          </button>
        </div>

        <div className="toolbar">
          <button
            className="nav-button"
            type="button"
            title="Back"
            disabled={!canGoBack}
            onClick={handleBack}
          >
            Back
          </button>
          <button
            className="nav-button"
            type="button"
            title="Forward"
            disabled={!canGoForward}
            onClick={handleForward}
          >
            Forward
          </button>
          <button
            className="nav-button"
            type="button"
            title={isLoading ? 'Stop' : 'Refresh'}
            disabled={!loadedUrl}
            onClick={handleRefresh}
          >
            {isLoading ? 'Stop' : 'Refresh'}
          </button>
          <input
            ref={addressInputRef}
            className="address-input"
            type="text"
            value={addressValue}
            placeholder="Search or enter address"
            aria-label="Address bar"
            spellCheck={false}
            onChange={(event) => setAddressValue(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </header>

      <main className="content-area">
        {loadedUrl ? (
          <webview
            ref={webviewRef}
            className={errorInfo ? 'webview is-hidden' : 'webview'}
            src={loadedUrl}
          />
        ) : (
          <section className="welcome-page">
            <h1>Zhi Browser</h1>
          </section>
        )}

        {errorInfo ? (
          <section className="error-page">
            <div className="error-mark" aria-hidden="true">
              !
            </div>
            <h1>This site can&apos;t be reached</h1>
            <p className="error-url">{errorInfo.url}</p>
            <p className="error-detail">
              {errorInfo.errorDescription} ({errorInfo.errorCode})
            </p>
            <button className="retry-button" type="button" onClick={handleRetry}>
              Retry
            </button>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
