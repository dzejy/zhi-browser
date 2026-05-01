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
  favicon: string
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

interface ScriptableWebviewElement extends BrowserWebviewElement {
  executeJavaScript<T = unknown>(code: string): Promise<T>
  getURL?(): string
}

interface WebviewFaviconEvent extends Event {
  favicons: string[]
}

type TabDropPosition = 'before' | 'after'

const FAVICON_DISCOVERY_SCRIPT = `
(async () => {
  const getAbsoluteUrl = (href) => {
    try {
      return new URL(href, document.baseURI).href
    } catch {
      return ''
    }
  }

  const links = Array.from(document.querySelectorAll('link[rel*="icon"]'))
    .map(link => ({
      rel: (link.getAttribute('rel') || '').toLowerCase(),
      href: getAbsoluteUrl(link.getAttribute('href') || '')
    }))
    .filter(link => link.href)

  // Prioritize apple-touch-icon, then shortcut icon, then icon
  links.sort((a, b) => {
    const score = (rel) => {
      if (rel.includes('apple-touch-icon')) return 3
      if (rel.includes('shortcut')) return 2
      if (rel.includes('icon')) return 1
      return 0
    }
    return score(b.rel) - score(a.rel)
  })

  let targetUrl = links.length > 0 ? links[0].href : '';
  if (!targetUrl && location.origin && location.origin !== 'null') {
    targetUrl = new URL('/favicon.ico', location.origin).href;
  }

  if (!targetUrl) return '';

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) return '';
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
})()
`

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
    errorInfo: null,
    favicon: ''
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

function getTabDropPosition(event: React.DragEvent<HTMLElement>): TabDropPosition {
  const rect = event.currentTarget.getBoundingClientRect()
  const midpoint = rect.left + rect.width / 2

  return event.clientX > midpoint ? 'after' : 'before'
}

function App(): React.JSX.Element {
  const initialTab = useMemo(() => createNewTab(), [])
  const [tabs, setTabs] = useState<TabInfo[]>([initialTab])
  const [tabOrder, setTabOrder] = useState<string[]>([initialTab.id])
  const [activeTabId, setActiveTabId] = useState(initialTab.id)
  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<TabDropPosition>('before')
  const webviewRefs = useRef<Map<string, BrowserWebviewElement>>(new Map())
  const boundTabIds = useRef<Set<string>>(new Set())
  const addressInputRef = useRef<HTMLInputElement | null>(null)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0]

  const orderedTabs = useMemo(() => {
    const tabMap = new Map(tabs.map((tab) => [tab.id, tab]))
    return tabOrder.map((id) => tabMap.get(id)).filter((tab): tab is TabInfo => Boolean(tab))
  }, [tabOrder, tabs])

  const focusAddressInput = useCallback((): void => {
    addressInputRef.current?.focus()
    addressInputRef.current?.select()
  }, [])

  const updateTab = useCallback(
    (tabId: string, updates: Partial<TabInfo> | ((tab: TabInfo) => Partial<TabInfo>)): void => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) => {
          if (tab.id === tabId) {
            const resolvedUpdates = typeof updates === 'function' ? updates(tab) : updates
            return { ...tab, ...resolvedUpdates }
          }
          return tab
        })
      )
    },
    []
  )

  const discoverFavicon = useCallback(
    (tabId: string, webview: BrowserWebviewElement): void => {
      const scriptableWebview = webview as ScriptableWebviewElement

      scriptableWebview
        .executeJavaScript<string>(FAVICON_DISCOVERY_SCRIPT)
        .then((favicon) => {
          if (favicon) {
            updateTab(tabId, (tab) => (tab.favicon ? {} : { favicon }))
          }
        })
        .catch(() => {})
    },
    [updateTab]
  )

  useEffect(() => {
    if (activeTab?.title && activeTab.title !== 'New Tab') {
      document.title = `${activeTab.title} - Zhi Browser`
      return
    }

    document.title = 'Zhi Browser'
  }, [activeTab?.title])

  const handleNewTab = useCallback(
    (urlOrEvent?: string | React.MouseEvent): void => {
      const initialUrl = typeof urlOrEvent === 'string' ? urlOrEvent : undefined
      const newTab = createNewTab()

      if (initialUrl) {
        newTab.url = initialUrl
        newTab.inputUrl = initialUrl
        newTab.title = getHostname(initialUrl)
      }

      setTabs((currentTabs) => [...currentTabs, newTab])
      setTabOrder((currentOrder) => [...currentOrder, newTab.id])
      setActiveTabId(newTab.id)

      if (!initialUrl) {
        window.setTimeout(focusAddressInput, 50)
      }
    },
    [focusAddressInput]
  )

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
          setTabOrder([newTab.id])
          return [newTab]
        }

        setTabOrder((currentOrder) => currentOrder.filter((id) => id !== tabId))

        if (tabId === activeTabId) {
          const currentOrder = tabOrder // Capture current order
          const closedIndex = currentOrder.indexOf(tabId)
          const nextOrder = currentOrder.filter((id) => id !== tabId)
          const nextActiveIndex = Math.min(closedIndex, nextOrder.length - 1)
          setActiveTabId(nextOrder[nextActiveIndex])
        }

        return remainingTabs
      })
    },
    [activeTabId, tabOrder]
  )

  const handleTabMouseDown = (tabId: string, event: React.MouseEvent<HTMLElement>): void => {
    if (event.button !== 1) {
      return
    }

    event.preventDefault()
    handleCloseTab(tabId)
  }

  const handleDragStart = (tabId: string, event: React.DragEvent<HTMLElement>): void => {
    setDragTabId(tabId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tabId)
  }

  const handleDragOver = (tabId: string, event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (!dragTabId || dragTabId === tabId) {
      setDragOverTabId(null)
      return
    }

    setDragOverTabId(tabId)
    setDragOverPosition(getTabDropPosition(event))
  }

  const handleDragLeave = (): void => {
    setDragOverTabId(null)
  }

  const handleDrop = (targetTabId: string, event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault()

    const dropPosition = getTabDropPosition(event)

    setDragOverTabId(null)

    if (!dragTabId || dragTabId === targetTabId) {
      setDragTabId(null)
      return
    }

    setTabOrder((currentOrder) => {
      const dragIndex = currentOrder.indexOf(dragTabId)
      const targetIndex = currentOrder.indexOf(targetTabId)

      if (dragIndex === -1 || targetIndex === -1) {
        return currentOrder
      }

      const reorderedOrder = [...currentOrder]
      const [draggedId] = reorderedOrder.splice(dragIndex, 1)

      let insertionIndex = dropPosition === 'after' ? targetIndex + 1 : targetIndex

      if (dragIndex < insertionIndex) {
        insertionIndex -= 1
      }

      insertionIndex = Math.max(0, Math.min(insertionIndex, reorderedOrder.length))
      reorderedOrder.splice(insertionIndex, 0, draggedId)

      return reorderedOrder
    })

    setDragTabId(null)
  }

  const handleDragEnd = (): void => {
    setDragTabId(null)
    setDragOverTabId(null)
  }

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
      errorInfo: null,
      favicon: ''
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
      errorInfo: null,
      favicon: ''
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
          errorInfo: null,
          favicon: ''
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
        discoverFavicon(tabId, webview)
      }

      const handleDidFinishLoad = (): void => {
        updateNavState()
        discoverFavicon(tabId, webview)
      }

      const handlePageTitleUpdated: EventListener = (event) => {
        const titleEvent = event as WebviewTitleEvent

        if (titleEvent.title) {
          updateTab(tabId, { title: titleEvent.title })
        }
      }

      const handlePageFaviconUpdated: EventListener = (event) => {
        const faviconEvent = event as WebviewFaviconEvent
        if (faviconEvent.favicons && faviconEvent.favicons.length > 0) {
          const targetUrl = faviconEvent.favicons[0]
          const scriptableWebview = webview as ScriptableWebviewElement
          scriptableWebview
            .executeJavaScript(
              `
            (async () => {
              try {
                const response = await fetch("${targetUrl}");
                const blob = await response.blob();
                return new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = () => resolve('');
                  reader.readAsDataURL(blob);
                });
              } catch { return ''; }
            })()
          `
            )
            .then((dataUrl) => {
              if (dataUrl && typeof dataUrl === 'string') {
                updateTab(tabId, { favicon: dataUrl })
              }
            })
            .catch(() => {})
        } else {
          discoverFavicon(tabId, webview)
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
          favicon: '',
          errorInfo: {
            url: failedUrl,
            errorCode: failEvent.errorCode,
            errorDescription: failEvent.errorDescription || 'Unknown error'
          }
        })
        updateNavState()
      }

      const handleDomReady = (): void => {
        const scriptableWebview = webview as ScriptableWebviewElement
        scriptableWebview
          .executeJavaScript(
            `
          (function() {
            document.addEventListener('click', (e) => {
              const a = e.target.closest('a');
              if (a && (a.getAttribute('target') === '_blank' || a.target === '_blank')) {
                e.preventDefault();
                console.log('__ZHI_BROWSER_NEW_WINDOW__:' + a.href);
              }
            }, true);
            window.open = function(url) {
              if (url) {
                const absoluteUrl = new URL(url, document.baseURI).href;
                console.log('__ZHI_BROWSER_NEW_WINDOW__:' + absoluteUrl);
              }
              return null;
            };
          })();
        `
          )
          .catch(() => {})
      }

      const handleConsoleMessage: EventListener = (event) => {
        const consoleEvent = event as unknown as { message: string }
        if (
          typeof consoleEvent.message === 'string' &&
          consoleEvent.message.startsWith('__ZHI_BROWSER_NEW_WINDOW__:')
        ) {
          const url = consoleEvent.message.slice('__ZHI_BROWSER_NEW_WINDOW__:'.length)
          handleNewTab(url)
        }
      }

      webview.addEventListener('did-navigate', handleDidNavigate)
      webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.addEventListener('did-start-loading', handleDidStartLoading)
      webview.addEventListener('did-stop-loading', handleDidStopLoading)
      webview.addEventListener('did-finish-load', handleDidFinishLoad)
      webview.addEventListener('page-title-updated', handlePageTitleUpdated)
      webview.addEventListener('page-favicon-updated', handlePageFaviconUpdated)
      webview.addEventListener('did-fail-load', handleDidFailLoad)
      webview.addEventListener('dom-ready', handleDomReady)
      webview.addEventListener('console-message', handleConsoleMessage)
    },
    [discoverFavicon, handleNewTab, updateTab]
  )

  const setWebviewRef = useCallback(
    (tabId: string, element: BrowserWebviewElement | null): void => {
      if (element) {
        webviewRefs.current.set(tabId, element)
        if (!boundTabIds.current.has(tabId)) {
          bindWebviewEvents(tabId, element)
        }
      } else {
        webviewRefs.current.delete(tabId)
        // Note: we don't remove from boundTabIds here to prevent re-binding
        // if the ref function is recreated.
        // It's only removed in handleCloseTab.
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
        return
      }

      if (key === 't') {
        event.preventDefault()
        handleNewTab()
        return
      }

      if (key === 'w') {
        event.preventDefault()
        handleCloseTab(activeTabId)
        return
      }

      if (key === 'tab') {
        event.preventDefault()

        if (tabOrder.length < 2) {
          return
        }

        const currentIndex = tabOrder.indexOf(activeTabId)

        if (currentIndex === -1) {
          return
        }

        const nextIndex = event.shiftKey
          ? (currentIndex - 1 + tabOrder.length) % tabOrder.length
          : (currentIndex + 1) % tabOrder.length

        setActiveTabId(tabOrder[nextIndex])
        return
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault()

        const nextIndex = event.key === '9' ? tabOrder.length - 1 : Number(event.key) - 1
        const nextId = tabOrder[nextIndex]
        if (nextId) {
          setActiveTabId(nextId)
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [activeTabId, focusAddressInput, handleCloseTab, handleNewTab, tabOrder])

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
            {orderedTabs.map((tab) => (
              <div
                key={tab.id}
                className={[
                  'tab',
                  tab.id === activeTabId ? 'is-active' : '',
                  dragTabId === tab.id ? 'is-dragging' : '',
                  dragOverTabId === tab.id ? `is-drag-over-${dragOverPosition}` : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={tab.title}
                role="button"
                tabIndex={0}
                onClick={() => setActiveTabId(tab.id)}
                onMouseDown={(event) => handleTabMouseDown(tab.id, event)}
                draggable
                onDragStart={(event) => handleDragStart(tab.id, event)}
                onDragOver={(event) => handleDragOver(tab.id, event)}
                onDragLeave={handleDragLeave}
                onDrop={(event) => handleDrop(tab.id, event)}
                onDragEnd={handleDragEnd}
              >
                <span className="tab-status" aria-hidden="true">
                  {tab.isLoading ? (
                    <span className="tab-spinner" />
                  ) : tab.favicon ? (
                    <img
                      className="tab-favicon"
                      src={tab.favicon}
                      alt=""
                      draggable={false}
                      onError={() => updateTab(tab.id, { favicon: '' })}
                    />
                  ) : (
                    <span className="tab-dot" />
                  )}
                </span>
                <span className="tab-title">{tab.title}</span>
                <button
                  className="tab-close"
                  type="button"
                  title="Close tab"
                  draggable={false}
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
