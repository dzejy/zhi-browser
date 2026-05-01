import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookmarkItem, BrowserState, DownloadItem, TabState } from '../../shared/types'

const APP_TITLE = 'Zhi Browser'
const NEW_TAB_TITLE = 'New Tab'
const NEW_TAB_URL = 'zhi://newtab'

const EMPTY_BROWSER_STATE: BrowserState = {
  tabs: [],
  activeTabId: ''
}

function getTabTitle(tab: TabState): string {
  if (tab.title) {
    return tab.title
  }

  if (tab.error) {
    return getHostname(tab.error.url) || 'Load failed'
  }

  return getHostname(tab.url) || NEW_TAB_TITLE
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function isBookmarkable(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function getDownloadText(download: DownloadItem): string {
  const totalBytes = download.totalBytes
  const receivedBytes = download.receivedBytes
  const progress = totalBytes > 0 ? ` ${Math.round((receivedBytes / totalBytes) * 100)}%` : ''

  return `${download.filename || 'Download'} - ${download.state}${progress}`
}

function App(): React.JSX.Element {
  const [browserState, setBrowserState] = useState<BrowserState>(EMPTY_BROWSER_STATE)
  const [addressDraft, setAddressDraft] = useState({
    tabId: '',
    value: '',
    isEditing: false
  })
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const addressInputRef = useRef<HTMLInputElement | null>(null)

  const activeTab = useMemo(
    () => browserState.tabs.find((tab) => tab.id === browserState.activeTabId) ?? null,
    [browserState]
  )

  const activeTabTitle = activeTab ? getTabTitle(activeTab) : NEW_TAB_TITLE
  const latestDownload = downloads[0] ?? null
  const activeUrl = activeTab?.url ?? ''
  const addressValue =
    activeTab && addressDraft.isEditing && addressDraft.tabId === activeTab.id
      ? addressDraft.value
      : activeUrl
  const canBookmark = isBookmarkable(activeUrl)
  const isBookmarked = bookmarks.some((bookmark) => bookmark.url === activeUrl)

  const refreshBookmarks = useCallback(async (): Promise<void> => {
    setBookmarks(await window.api.listBookmarks())
  }, [])

  const focusAddressInput = useCallback((): void => {
    window.setTimeout(() => {
      addressInputRef.current?.focus()
      addressInputRef.current?.select()
    }, 0)
  }, [])

  useEffect(() => {
    const unsubscribeState = window.api.onBrowserState(setBrowserState)
    const unsubscribeFocus = window.api.onFocusAddressBar(focusAddressInput)
    const unsubscribeDownload = window.api.onDownloadUpdate((download) => {
      setDownloads((currentDownloads) =>
        [download, ...currentDownloads.filter((item) => item.id !== download.id)].slice(0, 3)
      )
    })

    window.api.requestState()
    window.api
      .listBookmarks()
      .then(setBookmarks)
      .catch(() => setBookmarks([]))

    return () => {
      unsubscribeState()
      unsubscribeFocus()
      unsubscribeDownload()
    }
  }, [focusAddressInput])

  useEffect(() => {
    document.title =
      activeTabTitle === NEW_TAB_TITLE ? APP_TITLE : `${activeTabTitle} - ${APP_TITLE}`
  }, [activeTabTitle])

  const handleCreateTab = (): void => {
    window.api.createTab()
    focusAddressInput()
  }

  const handleCloseTab = (tabId: string): void => {
    window.api.closeTab(tabId)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    if (!activeTab) {
      window.api.createTab(addressValue.trim() || NEW_TAB_URL)
      return
    }

    window.api.loadUrl(activeTab.id, addressValue.trim() || NEW_TAB_URL)
    setShowBookmarks(false)
    setAddressDraft({
      tabId: activeTab.id,
      value: addressValue.trim(),
      isEditing: false
    })
  }

  const handleReloadOrStop = (): void => {
    if (!activeTab) {
      return
    }

    if (activeTab.isLoading) {
      window.api.stop(activeTab.id)
      return
    }

    window.api.reload(activeTab.id)
  }

  const handleRetry = (): void => {
    if (activeTab?.error) {
      window.api.loadUrl(activeTab.id, activeTab.error.url)
    }
  }

  const handleToggleBookmark = async (): Promise<void> => {
    if (!activeTab || !canBookmark) {
      return
    }

    if (isBookmarked) {
      await window.api.removeBookmark(activeTab.url)
    } else {
      await window.api.addBookmark({
        url: activeTab.url,
        title: activeTabTitle,
        favicon: activeTab.favicon
      })
    }

    await refreshBookmarks()
  }

  const handleOpenBookmark = (url: string): void => {
    if (activeTab) {
      window.api.loadUrl(activeTab.id, url)
    } else {
      window.api.createTab(url)
    }

    setShowBookmarks(false)
  }

  return (
    <div className="browser-shell">
      <header className="browser-header">
        <div className="tab-bar" aria-label="Tabs">
          <div className="tab-strip">
            {browserState.tabs.map((tab) => {
              const isActive = tab.id === browserState.activeTabId
              const title = getTabTitle(tab)

              return (
                <div
                  className={['tab', isActive ? 'is-active' : '', tab.error ? 'has-error' : '']
                    .filter(Boolean)
                    .join(' ')}
                  key={tab.id}
                >
                  <button
                    className="tab-main"
                    type="button"
                    title={title}
                    onClick={() => window.api.switchTab(tab.id)}
                  >
                    <span className="tab-status" aria-hidden="true">
                      {tab.isLoading ? (
                        <span className="tab-spinner" />
                      ) : tab.error ? (
                        <span className="tab-error-mark">!</span>
                      ) : tab.favicon ? (
                        <img
                          className="tab-favicon"
                          src={tab.favicon}
                          alt=""
                          draggable={false}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <span className="tab-dot" />
                      )}
                    </span>
                    <span className="tab-title">{title}</span>
                  </button>
                  <button
                    className="tab-close"
                    type="button"
                    title="Close tab"
                    aria-label="Close tab"
                    onClick={() => handleCloseTab(tab.id)}
                  >
                    x
                  </button>
                </div>
              )
            })}
          </div>
          <button
            className="new-tab-button"
            type="button"
            title="New tab"
            aria-label="New tab"
            onClick={handleCreateTab}
          >
            +
          </button>
        </div>

        <form className="toolbar" onSubmit={handleSubmit}>
          <div className="nav-buttons" aria-label="Navigation">
            <button
              className="nav-button"
              type="button"
              title="Back"
              disabled={!activeTab?.canGoBack}
              onClick={() => activeTab && window.api.goBack(activeTab.id)}
            >
              Back
            </button>
            <button
              className="nav-button"
              type="button"
              title="Forward"
              disabled={!activeTab?.canGoForward}
              onClick={() => activeTab && window.api.goForward(activeTab.id)}
            >
              Fwd
            </button>
            <button
              className="nav-button"
              type="button"
              title={activeTab?.isLoading ? 'Stop' : 'Reload'}
              disabled={!activeTab}
              onClick={handleReloadOrStop}
            >
              {activeTab?.isLoading ? 'Stop' : 'Reload'}
            </button>
          </div>

          <div className="address-box">
            <input
              ref={addressInputRef}
              className={['address-input', activeTab?.error ? 'has-error' : '']
                .filter(Boolean)
                .join(' ')}
              type="text"
              value={addressValue}
              placeholder="Search or enter address"
              aria-label="Address bar"
              aria-invalid={Boolean(activeTab?.error)}
              spellCheck={false}
              onBlur={() =>
                setAddressDraft({
                  tabId: activeTab?.id ?? '',
                  value: activeTab?.url ?? '',
                  isEditing: false
                })
              }
              onChange={(event) =>
                setAddressDraft({
                  tabId: activeTab?.id ?? '',
                  value: event.target.value,
                  isEditing: true
                })
              }
              onFocus={() =>
                setAddressDraft({
                  tabId: activeTab?.id ?? '',
                  value: activeTab?.url ?? '',
                  isEditing: true
                })
              }
            />
            {activeTab?.error ? (
              <span className="address-error" title={activeTab.error.errorDescription}>
                !
              </span>
            ) : null}
          </div>

          <button
            className={['bookmark-button', isBookmarked ? 'is-active' : '']
              .filter(Boolean)
              .join(' ')}
            type="button"
            title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            disabled={!canBookmark}
            onClick={() => void handleToggleBookmark()}
          >
            *
          </button>
          <button
            className="bookmark-menu-button"
            type="button"
            title="Bookmarks"
            onClick={() => setShowBookmarks((value) => !value)}
          >
            Bookmarks
          </button>
        </form>

        <div className="status-row">
          {activeTab?.error ? (
            <div className="status-error">
              <span className="status-text" title={activeTab.error.errorDescription}>
                {activeTab.error.errorDescription} ({activeTab.error.errorCode})
              </span>
              <button className="status-button" type="button" onClick={handleRetry}>
                Retry
              </button>
            </div>
          ) : showBookmarks ? (
            <div className="bookmark-list">
              {bookmarks.length === 0 ? (
                <span className="status-muted">No bookmarks</span>
              ) : (
                bookmarks.slice(0, 8).map((bookmark) => (
                  <button
                    className="bookmark-chip"
                    key={bookmark.url}
                    type="button"
                    title={bookmark.url}
                    onClick={() => handleOpenBookmark(bookmark.url)}
                  >
                    {bookmark.title || getHostname(bookmark.url) || bookmark.url}
                  </button>
                ))
              )}
            </div>
          ) : latestDownload ? (
            <div className="download-status" title={latestDownload.savePath || latestDownload.url}>
              {getDownloadText(latestDownload)}
            </div>
          ) : (
            <span className="status-muted">
              {activeTab?.zoomFactor && activeTab.zoomFactor !== 1
                ? `Zoom ${Math.round(activeTab.zoomFactor * 100)}%`
                : ''}
            </span>
          )}
        </div>
      </header>
    </div>
  )
}

export default App
