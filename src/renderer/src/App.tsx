import { useEffect, useRef, useState } from 'react'

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

function App(): React.JSX.Element {
  const [addressValue, setAddressValue] = useState('')
  const [loadedUrl, setLoadedUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const webviewRef = useRef<BrowserWebviewElement | null>(null)

  const handleNavigate = (): void => {
    const nextUrl = normalizeUrl(addressValue)

    if (!nextUrl) {
      return
    }

    setAddressValue(nextUrl)
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
      webview.goBack()
    }
  }

  const handleForward = (): void => {
    const webview = webviewRef.current

    if (webview?.canGoForward()) {
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

    webview.reload()
  }

  useEffect(() => {
    const webview = webviewRef.current

    if (!webview) {
      return
    }

    const handleDidNavigate: EventListener = (event) => {
      setAddressValue((event as WebviewNavigationEvent).url)
    }

    const handleDidNavigateInPage: EventListener = (event) => {
      const navigationEvent = event as WebviewNavigationEvent

      if (navigationEvent.isMainFrame) {
        setAddressValue(navigationEvent.url)
      }
    }

    const handleDidStartLoading = (): void => {
      setIsLoading(true)
    }

    const handleDidStopLoading = (): void => {
      setIsLoading(false)
    }

    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)

    return () => {
      webview.removeEventListener('did-navigate', handleDidNavigate)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.removeEventListener('did-start-loading', handleDidStartLoading)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading)
    }
  }, [loadedUrl])

  return (
    <div className="browser-shell">
      <header className="browser-header">
        <div className="tab-bar" aria-label="Tab bar placeholder">
          <div className="tab is-active">New Tab</div>
          <button className="new-tab-button" type="button" title="New tab placeholder">
            +
          </button>
        </div>

        <div className="toolbar">
          <button
            className="nav-button"
            type="button"
            title="Back"
            disabled={!loadedUrl}
            onClick={handleBack}
          >
            Back
          </button>
          <button
            className="nav-button"
            type="button"
            title="Forward"
            disabled={!loadedUrl}
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
          <webview ref={webviewRef} className="webview" src={loadedUrl} />
        ) : (
          <section className="welcome-page">
            <h1>Zhi Browser</h1>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
