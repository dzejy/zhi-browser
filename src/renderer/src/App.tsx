import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface ErrorInfo {
  url: string
  errorCode: number
  errorDescription: string
}

interface TabInfo {
  id: string
  title: string
  url: string
  inputUrl: string
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  errorInfo: ErrorInfo | null
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

function createTabId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createNewTab(): TabInfo {
  return {
    id: createTabId(),
    title: 'New Tab',
    url: '',
    inputUrl: '',
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
    errorInfo: null
  }
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
  const initialTab = useMemo(() => createNewTab(), [])
  const [tabs, setTabs] = useState<TabInfo[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState(initialTab.id)
  const webviewRefs = useRef<Map<string, BrowserWebviewElement>>(new Map())
  const boundTabIds = useRef<Set<string>>(new Set())
  const addressInputRef = useRef<HTMLInputElement | null>(null)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0]

  const focusAddressInput = useCallback((): void => {
    addressInputRef.current?.focus()
    addressInputRef.current?.select()
  }, [])

  const updateTab = useCallback((tabId: string, updates: Partial<TabInfo>): void => {
    setTabs((currentTabs) =>
      currentTabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab))
    )
  }, [])

  const handleNewTab = useCallback((): void => {
    const newTab = createNewTab()

    setTabs((currentTabs) => [...currentTabs, newTab])
    setActiveTabId(newTab.id)
    window.setTimeout(focusAddressInput, 50)
  }, [focusAddressInput])

  const handleCloseTab = useCallback(
    (tabId: string, event?: React.MouseEvent<HTMLElement>): void => {
      event?.stopPropagation()

      webviewRefs.current.delete(tabId)
      boundTabIds.current.delete(tabId)

      setTabs((currentTabs) => {
        const remainingTabs = currentTabs.filter((tab) => tab.id !== tabId)

        if (remainingTabs.length === 0) {
          const newTab = createNewTab()
          setActiveTabId(newTab.id)
          return [newTab]
        }

        if (tabId === activeTabId) {
          const closedIndex = currentTabs.findIndex((tab) => tab.id === tabId)
          const nextActiveIndex = Math.min(closedIndex, remainingTabs.length - 1)
          setActiveTabId(remainingTabs[nextActiveIndex].id)
        }

        return remainingTabs
      })
    },
    [activeTabId]
  )

  const handleNavigate = (): void => {
    if (!activeTab) {
      return
    }

    const nextUrl = normalizeUrl(activeTab.inputUrl)

    if (!nextUrl) {
      return
    }

    updateTab(activeTab.id, {
      url: nextUrl,
      inputUrl: nextUrl,
      title: getHostname(nextUrl),
      errorInfo: null
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      handleNavigate()
    }
  }

  const handleBack = (): void => {
    const webview = webviewRefs.current.get(activeTabId)

    if (webview?.canGoBack()) {
      updateTab(activeTabId, { errorInfo: null })
      webview.goBack()
    }
  }

  const handleForward = (): void => {
    const webview = webviewRefs.current.get(activeTabId)

    if (webview?.canGoForward()) {
      updateTab(activeTabId, { errorInfo: null })
      webview.goForward()
    }
  }

  const handleRefresh = (): void => {
    if (!activeTab?.url) {
      return
    }

    const webview = webviewRefs.current.get(activeTabId)

    if (activeTab.isLoading && webview) {
      webview.stop()
      return
    }

    updateTab(activeTabId, { errorInfo: null })

    if (webview) {
      webview.reload()
    }
  }

  const handleRetry = (tabId: string): void => {
    const tab = tabs.find((item) => item.id === tabId)

    if (!tab?.errorInfo) {
      return
    }

    const retryUrl = tab.errorInfo.url || tab.url

    updateTab(tabId, {
      url: '',
      inputUrl: retryUrl,
      title: getHostname(retryUrl),
      canGoBack: false,
      canGoForward: false,
      isLoading: false,
      errorInfo: null
    })

    window.setTimeout(() => {
      updateTab(tabId, { url: retryUrl })
    }, 0)
  }

  const bindWebviewEvents = useCallback(
    (tabId: string, webview: BrowserWebviewElement) => {
      if (boundTabIds.current.has(tabId)) {
        return
      }

      boundTabIds.current.add(tabId)

      const updateNavState = (): void => {
        try {
          updateTab(tabId, {
            canGoBack: webview.canGoBack(),
            canGoForward: webview.canGoForward()
          })
        } catch {
          updateTab(tabId, {
            canGoBack: false,
            canGoForward: false
          })
        }
      }

      const handleDidNavigate: EventListener = (event) => {
        const navigationEvent = event as WebviewNavigationEvent

        updateTab(tabId, {
          inputUrl: navigationEvent.url,
          title: getHostname(navigationEvent.url),
          errorInfo: null
        })
        updateNavState()
      }

      const handleDidNavigateInPage: EventListener = (event) => {
        const navigationEvent = event as WebviewNavigationEvent

        if (navigationEvent.isMainFrame) {
          updateTab(tabId, {
            inputUrl: navigationEvent.url,
            title: getHostname(navigationEvent.url),
            errorInfo: null
          })
        }

        updateNavState()
      }

      const handleDidStartLoading = (): void => {
        updateTab(tabId, { isLoading: true })
      }

      const handleDidStopLoading = (): void => {
        updateTab(tabId, { isLoading: false })
        updateNavState()
      }

      const handleDidFinishLoad = (): void => {
        updateNavState()
      }

      const handlePageTitleUpdated: EventListener = (event) => {
        const titleEvent = event as WebviewTitleEvent

        if (titleEvent.title) {
          updateTab(tabId, { title: titleEvent.title })
        }
      }

      const handleDidFailLoad: EventListener = (event) => {
        const failEvent = event as WebviewFailLoadEvent

        if (!failEvent.isMainFrame || failEvent.errorCode === -3) {
          return
        }

        const failedUrl = failEvent.validatedURL || webview.getAttribute('src') || ''

        updateTab(tabId, {
          title: getHostname(failedUrl),
          isLoading: false,
          errorInfo: {
            url: failedUrl,
            errorCode: failEvent.errorCode,
            errorDescription: failEvent.errorDescription || 'Unknown error'
          }
        })
        updateNavState()
      }

      webview.addEventListener('did-navigate', handleDidNavigate)
      webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.addEventListener('did-start-loading', handleDidStartLoading)
      webview.addEventListener('did-stop-loading', handleDidStopLoading)
      webview.addEventListener('did-finish-load', handleDidFinishLoad)
      webview.addEventListener('page-title-updated', handlePageTitleUpdated)
      webview.addEventListener('did-fail-load', handleDidFailLoad)
    },
    [updateTab]
  )

  const setWebviewRef = useCallback(
    (tabId: string, element: BrowserWebviewElement | null): void => {
      if (!element) {
        webviewRefs.current.delete(tabId)
        boundTabIds.current.delete(tabId)
        return
      }

      webviewRefs.current.set(tabId, element)

      if (!boundTabIds.current.has(tabId)) {
        bindWebviewEvents(tabId, element)
      }
    },
    [bindWebviewEvents]
  )

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'l') {
        event.preventDefault()
        focusAddressInput()
      }

      if (key === 't') {
        event.preventDefault()
        handleNewTab()
      }

      if (key === 'w') {
        event.preventDefault()
        handleCloseTab(activeTabId)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [activeTabId, focusAddressInput, handleCloseTab, handleNewTab])

  useEffect(() => {
    return window.electron.ipcRenderer.on('browser:focus-address-bar', () => {
      focusAddressInput()
    })
  }, [focusAddressInput])

  return (
    <div className="browser-shell">
      <header className="browser-header">
        <div className="tab-bar" aria-label="Tab bar">
          <div className="tabs-container">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={tab.id === activeTabId ? 'tab is-active' : 'tab'}
                title={tab.title}
                role="button"
                tabIndex={0}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className="tab-title">{tab.title}</span>
                <button
                  className="tab-close"
                  type="button"
                  title="Close tab"
                  onClick={(event) => handleCloseTab(tab.id, event)}
                >
                  x
                </button>
              </div>
            ))}
          </div>
          <button className="new-tab-button" type="button" title="New tab" onClick={handleNewTab}>
            +
          </button>
        </div>

        <div className="toolbar">
          <div className="nav-buttons" aria-label="Navigation">
            <button
              className="nav-button"
              type="button"
              title="Back"
              disabled={!activeTab?.canGoBack}
              onClick={handleBack}
            >
              Back
            </button>
            <button
              className="nav-button"
              type="button"
              title="Forward"
              disabled={!activeTab?.canGoForward}
              onClick={handleForward}
            >
              Forward
            </button>
            <button
              className="nav-button"
              type="button"
              title={activeTab?.isLoading ? 'Stop' : 'Refresh'}
              disabled={!activeTab?.url}
              onClick={handleRefresh}
            >
              {activeTab?.isLoading ? 'Stop' : 'Refresh'}
            </button>
          </div>

          <input
            ref={addressInputRef}
            className="address-input"
            type="text"
            value={activeTab?.inputUrl || ''}
            placeholder="Search or enter address"
            aria-label="Address bar"
            spellCheck={false}
            onChange={(event) => updateTab(activeTab.id, { inputUrl: event.target.value })}
            onKeyDown={handleKeyDown}
          />
        </div>
      </header>

      <main className="content-area">
        {tabs.map((tab) => (
          <section
            key={tab.id}
            className={tab.id === activeTabId ? 'tab-content is-active' : 'tab-content'}
          >
            {tab.url ? (
              <webview
                ref={(element) => setWebviewRef(tab.id, element as BrowserWebviewElement | null)}
                className={tab.errorInfo ? 'webview is-hidden' : 'webview'}
                src={tab.url}
              />
            ) : (
              <div className="welcome-page">
                <h1>Zhi Browser</h1>
                <p>Enter a URL above to start browsing.</p>
              </div>
            )}

            {tab.errorInfo ? (
              <div className="error-page">
                <div className="error-mark" aria-hidden="true">
                  !
                </div>
                <h1>This site can&apos;t be reached</h1>
                <p className="error-url">{tab.errorInfo.url}</p>
                <p className="error-detail">
                  {tab.errorInfo.errorDescription} ({tab.errorInfo.errorCode})
                </p>
                <button className="retry-button" type="button" onClick={() => handleRetry(tab.id)}>
                  Retry
                </button>
              </div>
            ) : null}
          </section>
        ))}
      </main>
    </div>
  )
}

export default App
