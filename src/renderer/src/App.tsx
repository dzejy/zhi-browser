import { useCallback, useEffect, useRef, useState } from 'react'

interface PageLoadError {
  url: string
  errorCode: number
  errorDescription: string
}

interface PageState {
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

const APP_TITLE = 'Zhi Browser'
const EMPTY_TAB_TITLE = 'New Tab'

function normalizeUrl(value: string): string {
  const trimmed = value.trim()

  if (!trimmed || /\s/.test(trimmed)) {
    return ''
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(trimmed)
      ? `http://${trimmed}`
      : `https://${trimmed}`

  try {
    const parsedUrl = new URL(candidate)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return ''
    }

    return parsedUrl.href
  } catch {
    return ''
  }
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return ''
  }
}

function getTabTitle(title: string, url: string, errorInfo: PageLoadError | null): string {
  if (title && title !== APP_TITLE) {
    return title
  }

  if (errorInfo) {
    return getHostname(errorInfo.url) || 'Load failed'
  }

  return getHostname(url) || EMPTY_TAB_TITLE
}

function App(): React.JSX.Element {
  const [inputUrl, setInputUrl] = useState('')
  const [displayUrl, setDisplayUrl] = useState('')
  const [title, setTitle] = useState(EMPTY_TAB_TITLE)
  const [favicon, setFavicon] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [errorInfo, setErrorInfo] = useState<PageLoadError | null>(null)
  const addressInputRef = useRef<HTMLInputElement | null>(null)

  const tabTitle = getTabTitle(title, displayUrl, errorInfo)

  const focusAddressInput = useCallback((): void => {
    addressInputRef.current?.focus()
    addressInputRef.current?.select()
  }, [])

  const applyPageState = useCallback((state: PageState): void => {
    setDisplayUrl(state.url)
    setInputUrl(state.url)
    setTitle(state.title || getHostname(state.url) || EMPTY_TAB_TITLE)
    setFavicon(state.favicon)
    setIsLoading(state.isLoading)
    setCanGoBack(state.canGoBack)
    setCanGoForward(state.canGoForward)

    if (state.isLoading) {
      setErrorInfo(null)
    }
  }, [])

  const applyPageError = useCallback((nextError: PageLoadError): void => {
    setErrorInfo(nextError)
    setDisplayUrl(nextError.url)
    setInputUrl(nextError.url)
    setTitle(getHostname(nextError.url) || 'Load failed')
    setFavicon('')
    setIsLoading(false)
  }, [])

  useEffect(() => {
    window.api.onPageStateUpdate(applyPageState)
    window.api.onPageLoadError(applyPageError)
    window.api.onFocusAddressBar(focusAddressInput)

    return () => {
      window.api.removeAllListeners()
    }
  }, [applyPageError, applyPageState, focusAddressInput])

  useEffect(() => {
    document.title = tabTitle === EMPTY_TAB_TITLE ? APP_TITLE : `${tabTitle} - ${APP_TITLE}`
  }, [tabTitle])

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

  const handleNavigate = useCallback((): void => {
    const nextUrl = normalizeUrl(inputUrl)

    if (!nextUrl) {
      setErrorInfo({
        url: inputUrl,
        errorCode: 0,
        errorDescription: 'Invalid URL'
      })
      return
    }

    setDisplayUrl(nextUrl)
    setInputUrl(nextUrl)
    setTitle(getHostname(nextUrl) || nextUrl)
    setFavicon('')
    setErrorInfo(null)
    window.api.navigateTo(nextUrl)
  }, [inputUrl])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    handleNavigate()
  }

  const handleReloadOrStop = (): void => {
    if (isLoading) {
      window.api.stop()
      return
    }

    window.api.reload()
  }

  const errorTitle = errorInfo
    ? `${errorInfo.errorDescription} (${errorInfo.errorCode})`
    : undefined

  return (
    <div className="browser-shell">
      <header className="browser-header">
        <div className="tab-bar" aria-label="Tab bar">
          <div
            className={['tab', 'is-active', errorInfo ? 'has-error' : ''].filter(Boolean).join(' ')}
          >
            <span className="tab-status" aria-hidden="true">
              {isLoading ? (
                <span className="tab-spinner" />
              ) : errorInfo ? (
                <span className="tab-error-mark">!</span>
              ) : favicon ? (
                <img
                  className="tab-favicon"
                  src={favicon}
                  alt=""
                  draggable={false}
                  onError={() => setFavicon('')}
                />
              ) : (
                <span className="tab-dot" />
              )}
            </span>
            <span className="tab-title" title={tabTitle}>
              {tabTitle}
            </span>
          </div>
        </div>

        <form className="toolbar" onSubmit={handleSubmit}>
          <div className="nav-buttons" aria-label="Navigation">
            <button
              className="nav-button"
              type="button"
              title="Back"
              disabled={!canGoBack}
              onClick={() => window.api.goBack()}
            >
              Back
            </button>
            <button
              className="nav-button"
              type="button"
              title="Forward"
              disabled={!canGoForward}
              onClick={() => window.api.goForward()}
            >
              Forward
            </button>
            <button
              className="nav-button"
              type="button"
              title={isLoading ? 'Stop' : 'Refresh'}
              disabled={!displayUrl}
              onClick={handleReloadOrStop}
            >
              {isLoading ? 'Stop' : 'Refresh'}
            </button>
          </div>

          <div className="address-box">
            <input
              ref={addressInputRef}
              className={['address-input', errorInfo ? 'has-error' : ''].filter(Boolean).join(' ')}
              type="text"
              value={inputUrl}
              placeholder="Enter URL"
              aria-label="Address bar"
              aria-invalid={Boolean(errorInfo)}
              title={errorTitle}
              spellCheck={false}
              onChange={(event) => setInputUrl(event.target.value)}
            />
            {errorInfo ? (
              <span className="address-error" title={errorTitle} aria-hidden="true">
                !
              </span>
            ) : null}
          </div>
        </form>
      </header>
    </div>
  )
}

export default App
