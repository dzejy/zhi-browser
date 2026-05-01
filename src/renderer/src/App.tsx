import { useState, useEffect, useRef, useCallback } from 'react'

// ===== Types (mirrored from shared/types for renderer use) =====
interface TabState {
  id: string
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: LoadError | null
  isPinned: boolean
  zoomFactor: number
  isNewTab: boolean
}
interface LoadError {
  url: string
  errorCode: number
  errorDescription: string
}
interface BrowserState {
  tabs: TabState[]
  activeTabId: string
  findState: FindState | null
  downloads: DownloadItem[]
  recentlyClosed: RecentlyClosedTab[]
}
interface FindState {
  tabId: string
  text: string
  activeMatchOrdinal: number
  matches: number
}
interface DownloadItem {
  id: string
  filename: string
  url: string
  totalBytes: number
  receivedBytes: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  savePath: string
  startedAt: number
}
interface RecentlyClosedTab {
  id?: string
  url: string
  title: string
  favicon: string
  closedAt: number
}
interface BookmarkItem {
  id?: string
  url: string
  title: string
  favicon: string
  createdAt: number
}
interface HistoryItem {
  id?: string
  url: string
  title: string
  visitedAt: number
}
interface ToastMessage {
  id: string
  text: string
  duration: number
}
interface BrowserSettings {
  searchEngine: 'google' | 'bing' | 'baidu' | 'duckduckgo'
  homepage: string
  newTabBehavior: 'homepage' | 'blank'
  restoreSession: boolean
  downloadPath: string
  askWhereToSaveBeforeDownloading: boolean
  saveHistory: boolean
  saveDownloadsHistory: boolean
  devToolsEnabled: boolean
}

interface AboutInfo {
  appName: string
  appVersion: string
  electronVersion: string
  chromiumVersion: string
  nodeVersion: string
  userDataPath: string
}

interface BookmarkEditState {
  id: string
  title: string
  url: string
}

interface ConfirmDialogState {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

type SidePanelType = 'bookmarks' | 'history' | 'downloads' | 'settings' | 'about'

const TOP_CHROME_HEIGHT = 74
const FIND_BAR_HEIGHT = 34
const ERROR_BAR_HEIGHT = 32

function getOpenPanelType(
  showBookmarks: boolean,
  showHistory: boolean,
  showDownloads: boolean,
  showSettings: boolean,
  showAbout: boolean
): SidePanelType | null {
  if (showBookmarks) return 'bookmarks'
  if (showHistory) return 'history'
  if (showDownloads) return 'downloads'
  if (showSettings) return 'settings'
  if (showAbout) return 'about'
  return null
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function App(): React.ReactElement {
  return window.location.search.includes('panel=true') ? <App_PanelOnly /> : <BrowserApp />
}

function BrowserApp(): React.ReactElement {
  const [browserState, setBrowserState] = useState<BrowserState>({
    tabs: [],
    activeTabId: '',
    findState: null,
    downloads: [],
    recentlyClosed: []
  })
  const [inputUrl, setInputUrl] = useState('')
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showDownloads, setShowDownloads] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [settings, setSettings] = useState<BrowserSettings | null>(null)

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [bookmarkQuery, setBookmarkQuery] = useState('')
  const [showFind, setShowFind] = useState(false)
  const [findText, setFindText] = useState('')
  const [findResult, setFindResult] = useState<{
    activeMatchOrdinal: number
    matches: number
  } | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)

  const urlInputRef = useRef<HTMLInputElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeTab = browserState.tabs.find((t) => t.id === browserState.activeTabId)

  // Keep async bookmark actions pointed at the latest active tab.
  const activeTabRef = useRef(activeTab)
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  const handleToggleBookmark = useCallback(async () => {
    const tab = activeTabRef.current
    if (!tab || tab.isNewTab) return
    const bms = await window.api.getBookmarks()
    const exists = bms.some((b: BookmarkItem) => b.url === tab.url)
    if (exists) {
      await window.api.removeBookmark(tab.url)
    } else {
      await window.api.addBookmark(tab.url, tab.title, tab.favicon)
    }
    const updated = await window.api.getBookmarks()
    setBookmarks(updated)
  }, [])

  // Initial load — get state synchronously on mount so tab bar appears immediately
  useEffect(() => {
    window.api.getBrowserState().then((state: BrowserState) => {
      setBrowserState(state)
    })
    window.api.getBookmarks().then(setBookmarks)
    window.api.getSettings().then(setSettings)
  }, [])

  // Listeners
  useEffect(() => {
    const unsub1 = window.api.onBrowserState((state: BrowserState) => setBrowserState(state))
    const unsub2 = window.api.onFocusAddressBar(() => {
      urlInputRef.current?.focus()
      urlInputRef.current?.select()
    })
    const unsub3 = window.api.onFocusFind(() => {
      setShowFind(true)
      setTimeout(() => {
        findInputRef.current?.focus()
        findInputRef.current?.select()
      }, 50)
    })
    const unsub4 = window.api.onToggleBookmark(() => {
      handleToggleBookmark()
    })
    const unsub5 = window.api.onFindResult((result) => setFindResult(result))
    const unsub6 = window.api.onDownloadUpdate(() => setShowDownloads(true))
    const unsub7 = window.api.onToast((msg: ToastMessage) => {
      setToast(msg)
      if (msg.duration > 0) {
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), msg.duration)
      }
    })

    const unsub8 = window.api.onOpenHistoryPanel(() => {
      setShowHistory(true)
      setShowBookmarks(false)
      setShowDownloads(false)
      setShowSettings(false)
      setShowAbout(false)
      window.api.getHistory(200).then(setHistoryItems)
    })
    const unsub9 = window.api.onOpenDownloadsPanel(() => {
      setShowDownloads(true)
      setShowBookmarks(false)
      setShowHistory(false)
      setShowSettings(false)
      setShowAbout(false)
    })
    const unsub10 = window.api.onPanelClosed(() => {
      setShowBookmarks(false)
      setShowHistory(false)
      setShowDownloads(false)
      setShowSettings(false)
      setShowAbout(false)
    })
    const unsub11 = window.api.onOpenBookmarksPanel(() => {
      setShowBookmarks(true)
      setShowHistory(false)
      setShowDownloads(false)
      setShowSettings(false)
      setShowAbout(false)
      window.api.getBookmarks().then(setBookmarks).catch(console.error)
    })
    const unsub12 = window.api.onOpenSettingsPanel(() => {
      setShowSettings(true)
      setShowBookmarks(false)
      setShowHistory(false)
      setShowDownloads(false)
      setShowAbout(false)
      window.api.getSettings().then(setSettings).catch(console.error)
    })
    const unsub13 = window.api.onOpenAboutPanel(() => {
      setShowAbout(true)
      setShowBookmarks(false)
      setShowHistory(false)
      setShowDownloads(false)
      setShowSettings(false)
    })
    const unsub14 = window.api.onAddBookmark(() => {
      handleToggleBookmark()
    })
    const unsub15 = window.api.onSettings((updated) => {
      setSettings(updated)
    })

    return () => {
      unsub1()
      unsub2()
      unsub3()
      unsub4()
      unsub5()
      unsub6()
      unsub7()
      unsub8()
      unsub9()
      unsub10()
      unsub11()
      unsub12()
      unsub13()
      unsub14()
      unsub15()
    }
  }, [handleToggleBookmark])

  // Dynamic layout: chrome/page positioning is independent from side-panel visibility.
  useEffect(() => {
    const uiViewHeight =
      TOP_CHROME_HEIGHT +
      (showFind ? FIND_BAR_HEIGHT : 0) +
      (activeTab?.error ? ERROR_BAR_HEIGHT : 0)

    window.api.setLayout({
      uiViewHeight,
      pageTop: uiViewHeight
    })

    const openPanelType = getOpenPanelType(
      showBookmarks,
      showHistory,
      showDownloads,
      showSettings,
      showAbout
    )
    if (openPanelType) {
      window.api.showPanel(openPanelType)
    } else {
      window.api.hidePanel()
    }
  }, [
    showFind,
    activeTab?.error,
    showBookmarks,
    showHistory,
    showDownloads,
    showSettings,
    showAbout
  ])

  // Sync address bar
  const [prevActiveTabId, setPrevActiveTabId] = useState<string | undefined>(undefined)
  const [prevActiveTabUrl, setPrevActiveTabUrl] = useState<string | undefined>(undefined)
  const [prevActiveTabIsNew, setPrevActiveTabIsNew] = useState<boolean | undefined>(undefined)
  if (
    activeTab &&
    (activeTab.id !== prevActiveTabId ||
      activeTab.url !== prevActiveTabUrl ||
      activeTab.isNewTab !== prevActiveTabIsNew)
  ) {
    setPrevActiveTabId(activeTab.id)
    setPrevActiveTabUrl(activeTab.url)
    setPrevActiveTabIsNew(activeTab.isNewTab)
    setInputUrl(activeTab.isNewTab ? '' : activeTab.url)
  }

  // Handlers
  function handleNavigate(): void {
    if (!activeTab) return
    const trimmed = inputUrl.trim()
    if (!trimmed) return
    window.api.loadUrl(activeTab.id, trimmed)
    urlInputRef.current?.blur()
  }

  function handleUrlKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') handleNavigate()
    else if (e.key === 'Escape') {
      if (activeTab) setInputUrl(activeTab.isNewTab ? '' : activeTab.url)
      urlInputRef.current?.blur()
    }
  }

  function handleNewTab(): void {
    window.api.createTab()
  }
  function handleCloseTab(tabId: string, e?: React.MouseEvent): void {
    if (e) e.stopPropagation()
    window.api.closeTab(tabId)
  }
  function handleSwitchTab(tabId: string): void {
    window.api.switchTab(tabId)
  }
  function handleTabMouseDown(tabId: string, e: React.MouseEvent): void {
    if (e.button === 1) {
      e.preventDefault()
      window.api.closeTab(tabId)
    }
  }
  function handleTabContextMenu(tabId: string, e: React.MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    window.api.tabContextMenu(tabId).catch(console.error)
  }

  function handleDragStart(tabId: string, e: React.DragEvent): void {
    setDragTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tabId)
  }
  function handleDragOver(tabId: string, e: React.DragEvent): void {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragTabId && tabId !== dragTabId) setDragOverTabId(tabId)
  }
  function handleDragLeave(): void {
    setDragOverTabId(null)
  }
  function handleDrop(targetTabId: string, e: React.DragEvent): void {
    e.preventDefault()
    setDragOverTabId(null)
    if (!dragTabId || dragTabId === targetTabId) {
      setDragTabId(null)
      return
    }
    const targetIndex = browserState.tabs.findIndex((t) => t.id === targetTabId)
    if (targetIndex !== -1) window.api.moveTab(dragTabId, targetIndex)
    setDragTabId(null)
  }
  function handleDragEnd(): void {
    setDragTabId(null)
    setDragOverTabId(null)
  }

  async function handleShowBookmarks(): Promise<void> {
    const bms = await window.api.getBookmarks()
    setBookmarks(bms)
    setShowBookmarks(!showBookmarks)
    setShowHistory(false)
    setShowDownloads(false)
    setShowSettings(false)
    setShowAbout(false)
  }

  async function handleShowHistory(): Promise<void> {
    const items = await window.api.getHistory(200)
    setHistoryItems(items)
    setShowHistory(!showHistory)
    setShowBookmarks(false)
    setShowDownloads(false)
    setShowSettings(false)
    setShowAbout(false)
  }

  function handleShowDownloads(): void {
    setShowDownloads(!showDownloads)
    setShowBookmarks(false)
    setShowHistory(false)
    setShowSettings(false)
    setShowAbout(false)
  }
  function handleShowSettings(): void {
    setShowSettings(!showSettings)
    setShowBookmarks(false)
    setShowHistory(false)
    setShowDownloads(false)
    setShowAbout(false)
  }

  function handleOpenBookmark(url: string): void {
    window.api.openUrl(url, false)
    setShowBookmarks(false)
  }
  function handleOpenHistory(url: string): void {
    window.api.openUrl(url, false)
    setShowHistory(false)
  }

  async function handleDeleteBookmark(url: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.removeBookmark(url)
    const updated = await window.api.getBookmarks()
    setBookmarks(updated)
  }

  async function handleClearHistory(): Promise<void> {
    await window.api.clearHistory()
    setHistoryItems([])
  }

  function handleFindKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      if (!activeTab) return
      if (e.shiftKey) window.api.findNext(activeTab.id, false)
      else if (findText) window.api.findStart(activeTab.id, findText)
    } else if (e.key === 'Escape') handleCloseFind()
  }

  function handleFindChange(text: string): void {
    setFindText(text)
    if (activeTab && text) window.api.findStart(activeTab.id, text)
  }

  function handleCloseFind(): void {
    if (activeTab) window.api.findStop(activeTab.id, 'clearSelection')
    setShowFind(false)
    setFindText('')
    setFindResult(null)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'l') {
        e.preventDefault()
        urlInputRef.current?.focus()
        urlInputRef.current?.select()
      } else if (ctrl && e.key === 'f') {
        e.preventDefault()
        setShowFind(true)
        setTimeout(() => {
          findInputRef.current?.focus()
          findInputRef.current?.select()
        }, 50)
      } else if (ctrl && e.key === 'd') {
        e.preventDefault()
        handleToggleBookmark()
      } else if (ctrl && e.key === 'h') {
        e.preventDefault()
        setShowHistory(true)
        setShowBookmarks(false)
        setShowDownloads(false)
        setShowSettings(false)
        setShowAbout(false)
        window.api.getHistory(200).then(setHistoryItems)
      } else if (ctrl && e.key === 'j') {
        e.preventDefault()
        setShowDownloads(true)
        setShowBookmarks(false)
        setShowHistory(false)
        setShowSettings(false)
        setShowAbout(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleToggleBookmark])

  const isCurrentBookmarked = bookmarks.some((b) => activeTab && b.url === activeTab.url)
  const filteredBookmarks = bookmarkQuery
    ? bookmarks.filter(
        (b) =>
          b.url.toLowerCase().includes(bookmarkQuery.toLowerCase()) ||
          b.title.toLowerCase().includes(bookmarkQuery.toLowerCase())
      )
    : bookmarks
  const filteredHistory = historyQuery
    ? historyItems.filter(
        (h) =>
          h.url.toLowerCase().includes(historyQuery.toLowerCase()) ||
          h.title.toLowerCase().includes(historyQuery.toLowerCase())
      )
    : historyItems

  return (
    <div className="browser-shell browser-ui-shell">
      <div className="tab-bar">
        <div className="tabs-container">
          {browserState.tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab ${tab.id === browserState.activeTabId ? 'active' : ''} ${tab.isPinned ? 'pinned' : ''} ${dragTabId === tab.id ? 'dragging' : ''} ${dragOverTabId === tab.id ? 'drag-over' : ''}`}
              onClick={() => handleSwitchTab(tab.id)}
              onMouseDown={(e) => handleTabMouseDown(tab.id, e)}
              onContextMenu={(e) => handleTabContextMenu(tab.id, e)}
              draggable
              onDragStart={(e) => handleDragStart(tab.id, e)}
              onDragOver={(e) => handleDragOver(tab.id, e)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(tab.id, e)}
              onDragEnd={handleDragEnd}
              title={tab.title || tab.url}
            >
              <span className="tab-icon">
                {tab.isLoading ? (
                  <span className="tab-spinner" />
                ) : tab.favicon ? (
                  <img
                    className="tab-favicon"
                    src={tab.favicon}
                    alt=""
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="tab-dot" />
                )}
              </span>
              {!tab.isPinned && <span className="tab-title">{tab.title || 'New Tab'}</span>}
              {!tab.isPinned && (
                <button
                  className="tab-close"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="Close tab"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="new-tab-btn" onClick={handleNewTab} title="New tab (Ctrl+T)">
          +
        </button>
      </div>

      <div className="toolbar">
        <div className="nav-buttons">
          <button
            className="nav-btn"
            onClick={() => activeTab && window.api.goBack(activeTab.id)}
            disabled={!activeTab?.canGoBack}
            title="Back (Alt+←)"
          >
            ←
          </button>
          <button
            className="nav-btn"
            onClick={() => activeTab && window.api.goForward(activeTab.id)}
            disabled={!activeTab?.canGoForward}
            title="Forward (Alt+→)"
          >
            →
          </button>
          <button
            className="nav-btn"
            onClick={() => {
              if (!activeTab) return
              activeTab.isLoading ? window.api.stop(activeTab.id) : window.api.reload(activeTab.id)
            }}
            title={activeTab?.isLoading ? 'Stop (Esc)' : 'Reload (Ctrl+R)'}
          >
            {activeTab?.isLoading ? '✕' : '↻'}
          </button>
        </div>

        <div className="address-bar">
          <input
            ref={urlInputRef}
            className="url-input"
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            onFocus={(e) => e.target.select()}
            placeholder="Search or enter URL..."
            spellCheck={false}
          />
        </div>

        <div className="toolbar-actions">
          <button
            className={`action-btn bookmark-btn ${isCurrentBookmarked ? 'bookmarked' : ''}`}
            onClick={() => handleToggleBookmark()}
            title="Bookmark (Ctrl+D)"
          >
            {isCurrentBookmarked ? '★' : '☆'}
          </button>
          <button className="action-btn" onClick={handleShowBookmarks} title="Bookmarks">
            📑
          </button>
          <button className="action-btn" onClick={handleShowHistory} title="History">
            🕐
          </button>
          <button className="action-btn" onClick={handleShowDownloads} title="Downloads">
            ⬇
          </button>
          <button className="action-btn" onClick={handleShowSettings} title="Settings">
            ⚙
          </button>
        </div>
      </div>

      {showFind && (
        <div className="find-bar">
          <input
            ref={findInputRef}
            className="find-input"
            type="text"
            value={findText}
            onChange={(e) => handleFindChange(e.target.value)}
            onKeyDown={handleFindKeyDown}
            placeholder="Find in page..."
            spellCheck={false}
          />
          {findResult && (
            <span className="find-count">
              {findResult.matches > 0
                ? `${findResult.activeMatchOrdinal}/${findResult.matches}`
                : 'No matches'}
            </span>
          )}
          <button
            className="find-btn"
            onClick={() => activeTab && window.api.findNext(activeTab.id, false)}
            title="Previous (Shift+Enter)"
          >
            ▲
          </button>
          <button
            className="find-btn"
            onClick={() => activeTab && window.api.findNext(activeTab.id, true)}
            title="Next (Enter)"
          >
            ▼
          </button>
          <button className="find-btn find-close" onClick={handleCloseFind} title="Close (Esc)">
            ✕
          </button>
        </div>
      )}

      {activeTab?.error && (
        <div className="error-bar">
          <span className="error-text">
            Failed to load: {activeTab.error.url} — {activeTab.error.errorDescription} (
            {activeTab.error.errorCode})
          </span>
          <button className="error-retry-btn" onClick={() => window.api.retryLoad(activeTab.id)}>
            Retry
          </button>
        </div>
      )}

      {showBookmarks && <div className="panel-overlay" onClick={() => setShowBookmarks(false)} />}
      {showBookmarks && (
        <div className="panel bookmarks-panel">
          <div className="panel-header">
            <h3>Bookmarks</h3>
            <input
              className="panel-search"
              type="text"
              value={bookmarkQuery}
              onChange={(e) => setBookmarkQuery(e.target.value)}
              placeholder="Search bookmarks..."
            />
            <button className="panel-close" onClick={() => setShowBookmarks(false)}>
              ✕
            </button>
          </div>
          <div className="panel-list">
            {filteredBookmarks.length === 0 && <div className="panel-empty">No bookmarks</div>}
            {filteredBookmarks.map((b) => (
              <div key={b.url} className="panel-item" onClick={() => handleOpenBookmark(b.url)}>
                {b.favicon && (
                  <img
                    className="panel-item-icon"
                    src={b.favicon}
                    alt=""
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
                <span className="panel-item-title">{b.title || b.url}</span>
                <span className="panel-item-url">{b.url}</span>
                <button
                  className="panel-item-delete"
                  onClick={(e) => handleDeleteBookmark(b.url, e)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showHistory && <div className="panel-overlay" onClick={() => setShowHistory(false)} />}
      {showHistory && (
        <div className="panel history-panel">
          <div className="panel-header">
            <h3>History</h3>
            <input
              className="panel-search"
              type="text"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="Search history..."
            />
            <button className="panel-clear" onClick={handleClearHistory}>
              Clear all
            </button>
            <button className="panel-close" onClick={() => setShowHistory(false)}>
              ✕
            </button>
          </div>
          <div className="panel-list">
            {filteredHistory.length === 0 && <div className="panel-empty">No history</div>}
            {filteredHistory.map((h, i) => (
              <div
                key={`${h.url}-${i}`}
                className="panel-item"
                onClick={() => handleOpenHistory(h.url)}
              >
                <span className="panel-item-title">{h.title || h.url}</span>
                <span className="panel-item-url">{h.url}</span>
                <span className="panel-item-time">{new Date(h.visitedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDownloads && <div className="panel-overlay" onClick={() => setShowDownloads(false)} />}
      {showDownloads && (
        <div className="panel downloads-panel">
          <div className="panel-header">
            <h3>Downloads</h3>
            <button className="panel-close" onClick={() => setShowDownloads(false)}>
              ✕
            </button>
          </div>
          <div className="panel-list">
            {browserState.downloads.length === 0 && <div className="panel-empty">No downloads</div>}
            {browserState.downloads.map((d) => (
              <div key={d.id} className="panel-item download-item">
                <span className="download-filename">{d.filename}</span>
                <span className="download-status">
                  {d.state === 'progressing' && d.totalBytes > 0
                    ? `${Math.round((d.receivedBytes / d.totalBytes) * 100)}%`
                    : d.state}
                </span>
                {d.state === 'progressing' && d.totalBytes > 0 && (
                  <div className="download-progress">
                    <div
                      className="download-progress-bar"
                      style={{ width: `${(d.receivedBytes / d.totalBytes) * 100}%` }}
                    />
                  </div>
                )}
                {d.state === 'completed' && (
                  <div className="download-actions">
                    <button onClick={() => window.api.openDownloadFile(d.id)}>Open</button>
                    <button onClick={() => window.api.showInFolder(d.id)}>Show in folder</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showSettings && settings && (
        <div className="panel-overlay" onClick={() => setShowSettings(false)} />
      )}
      {showSettings && settings && (
        <div className="panel settings-panel">
          <div className="panel-header">
            <h3>Settings</h3>
            <button className="panel-close" onClick={() => setShowSettings(false)}>
              ✕
            </button>
          </div>
          <div className="panel-list" style={{ padding: '12px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Search Engine
              </label>
              <select
                value={settings.searchEngine}
                onChange={async (e) => {
                  const newSet = await window.api.updateSettings({
                    searchEngine: e.target.value as 'google' | 'bing' | 'baidu' | 'duckduckgo'
                  })
                  setSettings(newSet)
                }}
                style={{ width: '100%', padding: '4px' }}
              >
                <option value="google">Google</option>
                <option value="bing">Bing</option>
                <option value="baidu">Baidu</option>
                <option value="duckduckgo">DuckDuckGo</option>
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Download Path
              </label>
              <input
                type="text"
                value={settings.downloadPath}
                onChange={async (e) => {
                  const newSet = await window.api.updateSettings({ downloadPath: e.target.value })
                  setSettings(newSet)
                }}
                style={{
                  width: '100%',
                  padding: '4px',
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#eee',
                  fontSize: '12px'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label
                style={{ display: 'flex', alignItems: 'center', fontSize: '12px', gap: '6px' }}
              >
                <input
                  type="checkbox"
                  checked={settings.askWhereToSaveBeforeDownloading}
                  onChange={async (e) => {
                    const newSet = await window.api.updateSettings({
                      askWhereToSaveBeforeDownloading: e.target.checked
                    })
                    setSettings(newSet)
                  }}
                />
                Ask where to save each file
              </label>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label
                style={{ display: 'flex', alignItems: 'center', fontSize: '12px', gap: '6px' }}
              >
                <input
                  type="checkbox"
                  checked={settings.restoreSession}
                  onChange={async (e) => {
                    const newSet = await window.api.updateSettings({
                      restoreSession: e.target.checked
                    })
                    setSettings(newSet)
                  }}
                />
                Restore session on startup
              </label>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast.text}</div>}

      {activeTab?.isNewTab && (
        <div className="new-tab-content">
          <h1 className="new-tab-title">Zhi Browser</h1>
          <p className="new-tab-hint">Type a URL or search term in the address bar</p>
          {browserState.recentlyClosed.length > 0 && (
            <div className="new-tab-recent">
              <button className="restore-btn" onClick={() => window.api.restoreClosed()}>
                Restore last closed tab
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function App_PanelOnly(): React.ReactElement {
  const [panelType, setPanelType] = useState<SidePanelType>('bookmarks')
  const [browserState, setBrowserState] = useState<BrowserState>({
    tabs: [],
    activeTabId: '',
    findState: null,
    downloads: [],
    recentlyClosed: []
  })
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [bookmarkQuery, setBookmarkQuery] = useState('')
  const [settings, setSettings] = useState<BrowserSettings | null>(null)
  const [editingBookmark, setEditingBookmark] = useState<BookmarkEditState | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null)

  const requestConfirm = useCallback(
    (
      title: string,
      message: string,
      confirmLabel: string,
      onConfirm: () => void | Promise<void>
    ): void => {
      setConfirmDialog({ title, message, confirmLabel, onConfirm })
    },
    []
  )

  useEffect(() => {
    const unsubPanelType = window.api.onPanelType((type) => {
      setPanelType(type)
      setEditingBookmark(null)
      setConfirmDialog(null)
    })
    const unsubBrowserState = window.api.onBrowserState((state: BrowserState) =>
      setBrowserState(state)
    )
    const unsubDownloadUpdate = window.api.onDownloadUpdate(() => {
      window.api.getBrowserState().then(setBrowserState)
    })
    const unsubSettings = window.api.onSettings((updated) => setSettings(updated))
    const unsubClearData = window.api.onClearDataConfirm(() => {
      requestConfirm(
        'Clear browsing data',
        'Clear all history and download records?',
        'Clear',
        async () => {
          await window.api.clearHistory()
          await window.api.clearDownloads()
          setHistoryItems([])
          const downloads = await window.api.getDownloads()
          setBrowserState((current) => ({ ...current, downloads }))
        }
      )
    })

    window.api.getBrowserState().then(setBrowserState)
    window.api.getBookmarks().then(setBookmarks)
    window.api.getSettings().then(setSettings)

    return () => {
      unsubPanelType()
      unsubBrowserState()
      unsubDownloadUpdate()
      unsubSettings()
      unsubClearData()
    }
  }, [requestConfirm])

  useEffect(() => {
    if (panelType === 'bookmarks') {
      window.api.getBookmarks().then(setBookmarks)
    } else if (panelType === 'history') {
      window.api.getHistory(200).then(setHistoryItems)
    } else if (panelType === 'downloads') {
      window.api.getBrowserState().then(setBrowserState)
    } else if (panelType === 'settings') {
      window.api.getSettings().then(setSettings)
    } else if (panelType === 'about') {
      window.api.getAboutInfo().then(setAboutInfo).catch(console.error)
    }
  }, [panelType])

  const filteredBookmarks = bookmarkQuery
    ? bookmarks.filter(
        (b) =>
          b.url.toLowerCase().includes(bookmarkQuery.toLowerCase()) ||
          b.title.toLowerCase().includes(bookmarkQuery.toLowerCase())
      )
    : bookmarks
  const filteredHistory = historyQuery
    ? historyItems.filter(
        (h) =>
          h.url.toLowerCase().includes(historyQuery.toLowerCase()) ||
          h.title.toLowerCase().includes(historyQuery.toLowerCase())
      )
    : historyItems

  function closePanel(): void {
    window.api.hidePanel()
  }

  function handleOpenBookmark(url: string, newTab = false): void {
    window.api.openUrl(url, newTab)
    closePanel()
  }

  function handleOpenHistory(url: string, newTab = false): void {
    window.api.openUrl(url, newTab)
    closePanel()
  }

  function handleCopyUrl(url: string, e?: React.MouseEvent): void {
    e?.stopPropagation()
    window.api.copyToClipboard(url).catch(console.error)
  }

  async function handleDeleteBookmark(url: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.removeBookmark(url)
    const updated = await window.api.getBookmarks()
    setBookmarks(updated)
  }

  function handleEditBookmark(bookmark: BookmarkItem, e: React.MouseEvent): void {
    e.stopPropagation()
    setEditingBookmark({
      id: bookmark.id || bookmark.url,
      title: bookmark.title || bookmark.url,
      url: bookmark.url
    })
  }

  async function handleSaveBookmark(): Promise<void> {
    if (!editingBookmark) return
    const title = editingBookmark.title.trim()
    const url = editingBookmark.url.trim()
    if (!title || !url) return

    const updated = await window.api.updateBookmark(editingBookmark.id, title, url)
    setBookmarks(updated)
    setEditingBookmark(null)
  }

  function handleClearBookmarks(): void {
    requestConfirm('Clear bookmarks', 'Delete all bookmarks?', 'Clear', async () => {
      await window.api.clearBookmarks()
      setBookmarks([])
    })
  }

  async function handleRemoveHistoryEntry(item: HistoryItem, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.removeHistoryEntry(item.id || item.url)
    const updated = await window.api.getHistory(200)
    setHistoryItems(updated)
  }

  async function handleClearHistory(): Promise<void> {
    requestConfirm('Clear history', 'Delete all history entries?', 'Clear', async () => {
      await window.api.clearHistory()
      setHistoryItems([])
    })
  }

  async function handleOpenDownloadFile(downloadId: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.openDownloadFile(downloadId)
  }

  async function handleShowDownloadInFolder(
    downloadId: string,
    e: React.MouseEvent
  ): Promise<void> {
    e.stopPropagation()
    await window.api.showDownloadInFolder(downloadId)
  }

  async function handleRemoveDownload(downloadId: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.removeDownload(downloadId)
    const downloads = await window.api.getDownloads()
    setBrowserState((current) => ({ ...current, downloads }))
  }

  function handleClearDownloads(): void {
    requestConfirm('Clear downloads', 'Delete all download records?', 'Clear', async () => {
      await window.api.clearDownloads()
      setBrowserState((current) => ({ ...current, downloads: [] }))
    })
  }

  function handleUpdateSettings(partial: Partial<BrowserSettings>): void {
    window.api.updateSettings(partial).then(setSettings).catch(console.error)
  }

  async function handleSelectDownloadPath(): Promise<void> {
    const selected = await window.api.selectDownloadPath()
    if (selected) {
      handleUpdateSettings({ downloadPath: selected })
    }
  }

  function handleResetSettings(): void {
    requestConfirm('Reset settings', 'Restore all settings to defaults?', 'Reset', async () => {
      const updated = await window.api.resetSettings()
      setSettings(updated)
    })
  }

  async function handleConfirmDialog(): Promise<void> {
    const dialog = confirmDialog
    if (!dialog) return
    try {
      await dialog.onConfirm()
    } catch (error) {
      console.error(error)
    } finally {
      setConfirmDialog(null)
    }
  }

  return (
    <div className="panel-only-shell">
      <div className={`panel panel-only-panel ${panelType}-panel`}>
        {panelType === 'bookmarks' && (
          <>
            <div className="panel-header">
              <h3>Bookmarks</h3>
              <input
                className="panel-search"
                type="text"
                value={bookmarkQuery}
                onChange={(e) => setBookmarkQuery(e.target.value)}
                placeholder="Search bookmarks..."
              />
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list">
              {filteredBookmarks.length === 0 && <div className="panel-empty">No bookmarks</div>}
              {filteredBookmarks.map((b) => (
                <div key={b.url} className="panel-item" onClick={() => handleOpenBookmark(b.url)}>
                  {b.favicon && (
                    <img
                      className="panel-item-icon"
                      src={b.favicon}
                      alt=""
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <div className="panel-item-main">
                    <span className="panel-item-title">{b.title || b.url}</span>
                    <span className="panel-item-url">{b.url}</span>
                  </div>
                  <div className="panel-item-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenBookmark(b.url, true)
                      }}
                    >
                      New tab
                    </button>
                    <button onClick={(e) => handleEditBookmark(b, e)}>Edit</button>
                    <button onClick={(e) => handleCopyUrl(b.url, e)}>Copy</button>
                    <button onClick={(e) => handleDeleteBookmark(b.url, e)}>Delete</button>
                  </div>
                </div>
              ))}
              {bookmarks.length > 0 && (
                <button className="panel-action-btn" onClick={handleClearBookmarks}>
                  Clear all bookmarks
                </button>
              )}
            </div>
          </>
        )}

        {panelType === 'history' && (
          <>
            <div className="panel-header">
              <h3>History</h3>
              <input
                className="panel-search"
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search history..."
              />
              <button className="panel-clear" onClick={handleClearHistory}>
                Clear all
              </button>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list">
              {filteredHistory.length === 0 && <div className="panel-empty">No history</div>}
              {filteredHistory.map((h, i) => (
                <div
                  key={h.id || `${h.url}-${i}`}
                  className="panel-item"
                  onClick={() => handleOpenHistory(h.url)}
                >
                  <div className="panel-item-main">
                    <span className="panel-item-title">{h.title || h.url}</span>
                    <span className="panel-item-url">{h.url}</span>
                    <span className="panel-item-time">
                      {new Date(h.visitedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="panel-item-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenHistory(h.url, true)
                      }}
                    >
                      New tab
                    </button>
                    <button onClick={(e) => handleCopyUrl(h.url, e)}>Copy</button>
                    <button onClick={(e) => handleRemoveHistoryEntry(h, e)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {panelType === 'downloads' && (
          <>
            <div className="panel-header">
              <h3>Downloads</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list">
              {browserState.downloads.length === 0 && (
                <div className="panel-empty">No downloads</div>
              )}
              {browserState.downloads.map((d) => (
                <div key={d.id} className="panel-item download-item">
                  <div className="download-head">
                    <span className="download-filename">{d.filename || 'Unnamed file'}</span>
                    <span className={`download-status status-${d.state}`}>
                      {d.state === 'progressing' && d.totalBytes > 0
                        ? `${Math.round((d.receivedBytes / d.totalBytes) * 100)}%`
                        : d.state}
                    </span>
                  </div>
                  {d.state === 'progressing' && d.totalBytes > 0 && (
                    <div className="download-progress">
                      <div
                        className="download-progress-bar"
                        style={{ width: `${(d.receivedBytes / d.totalBytes) * 100}%` }}
                      />
                    </div>
                  )}
                  <span className="download-meta">
                    {formatBytes(d.receivedBytes || d.totalBytes)}
                    {d.totalBytes > 0 ? ` / ${formatBytes(d.totalBytes)}` : ''} ·{' '}
                    {new Date(d.startedAt).toLocaleString()}
                  </span>
                  <span className="download-path">{d.savePath || 'No saved path yet'}</span>
                  <span className="download-url">{d.url}</span>
                  <div className="download-actions">
                    <button disabled={!d.savePath} onClick={(e) => handleOpenDownloadFile(d.id, e)}>
                      Open
                    </button>
                    <button
                      disabled={!d.savePath}
                      onClick={(e) => handleShowDownloadInFolder(d.id, e)}
                    >
                      Folder
                    </button>
                    <button onClick={(e) => handleCopyUrl(d.url, e)}>Copy URL</button>
                    <button onClick={(e) => handleRemoveDownload(d.id, e)}>Delete</button>
                  </div>
                </div>
              ))}
              {browserState.downloads.length > 0 && (
                <button className="panel-action-btn" onClick={handleClearDownloads}>
                  Clear all downloads
                </button>
              )}
            </div>
          </>
        )}

        {panelType === 'settings' && (
          <>
            <div className="panel-header">
              <h3>Settings</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list settings-list">
              {!settings && <div className="panel-empty">Loading settings</div>}
              {settings && (
                <>
                  <div className="settings-row">
                    <label>Homepage</label>
                    <input
                      type="text"
                      value={settings.homepage}
                      onChange={(e) => handleUpdateSettings({ homepage: e.target.value })}
                    />
                  </div>
                  <div className="settings-row">
                    <label>New Tab Behavior</label>
                    <select
                      value={settings.newTabBehavior}
                      onChange={(e) =>
                        handleUpdateSettings({
                          newTabBehavior: e.target.value as BrowserSettings['newTabBehavior']
                        })
                      }
                    >
                      <option value="blank">Blank page</option>
                      <option value="homepage">Homepage</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <label>Search Engine</label>
                    <select
                      value={settings.searchEngine}
                      onChange={(e) =>
                        handleUpdateSettings({
                          searchEngine: e.target.value as BrowserSettings['searchEngine']
                        })
                      }
                    >
                      <option value="google">Google</option>
                      <option value="bing">Bing</option>
                      <option value="baidu">Baidu</option>
                      <option value="duckduckgo">DuckDuckGo</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <label>Download Path</label>
                    <div className="settings-path-row">
                      <input
                        type="text"
                        value={settings.downloadPath}
                        onChange={(e) => handleUpdateSettings({ downloadPath: e.target.value })}
                      />
                      <button onClick={() => handleSelectDownloadPath().catch(console.error)}>
                        Browse
                      </button>
                    </div>
                  </div>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      checked={settings.askWhereToSaveBeforeDownloading}
                      onChange={(e) =>
                        handleUpdateSettings({
                          askWhereToSaveBeforeDownloading: e.target.checked
                        })
                      }
                    />
                    Ask where to save each file
                  </label>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      checked={settings.restoreSession}
                      onChange={(e) => handleUpdateSettings({ restoreSession: e.target.checked })}
                    />
                    Restore session on startup
                  </label>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      checked={settings.saveHistory}
                      onChange={(e) => handleUpdateSettings({ saveHistory: e.target.checked })}
                    />
                    Save history
                  </label>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      checked={settings.saveDownloadsHistory}
                      onChange={(e) =>
                        handleUpdateSettings({ saveDownloadsHistory: e.target.checked })
                      }
                    />
                    Save downloads history
                  </label>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      checked={settings.devToolsEnabled}
                      onChange={(e) => handleUpdateSettings({ devToolsEnabled: e.target.checked })}
                    />
                    Enable DevTools
                  </label>
                  <div className="settings-actions">
                    <button onClick={() => window.api.openUserDataFolder().catch(console.error)}>
                      Open User Data
                    </button>
                    <button onClick={handleResetSettings}>Reset Settings</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {panelType === 'about' && (
          <>
            <div className="panel-header">
              <h3>About</h3>
              <button className="panel-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="panel-list about-list">
              {!aboutInfo && <div className="panel-empty">Loading about info</div>}
              {aboutInfo && (
                <>
                  <div className="about-app-name">{aboutInfo.appName}</div>
                  <div className="about-row">
                    <span>Version</span>
                    <strong>{aboutInfo.appVersion}</strong>
                  </div>
                  <div className="about-row">
                    <span>Electron</span>
                    <strong>{aboutInfo.electronVersion}</strong>
                  </div>
                  <div className="about-row">
                    <span>Chromium</span>
                    <strong>{aboutInfo.chromiumVersion}</strong>
                  </div>
                  <div className="about-row">
                    <span>Node.js</span>
                    <strong>{aboutInfo.nodeVersion}</strong>
                  </div>
                  <div className="about-path">{aboutInfo.userDataPath}</div>
                  <div className="settings-actions">
                    <button
                      onClick={() =>
                        window.api
                          .copyToClipboard(
                            `${aboutInfo.appName} ${aboutInfo.appVersion}\nElectron ${aboutInfo.electronVersion}\nChromium ${aboutInfo.chromiumVersion}\nNode.js ${aboutInfo.nodeVersion}\nData ${aboutInfo.userDataPath}`
                          )
                          .catch(console.error)
                      }
                    >
                      Copy Info
                    </button>
                    <button onClick={() => window.api.openUserDataFolder().catch(console.error)}>
                      Open User Data
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {editingBookmark && (
        <div className="panel-modal-overlay" onClick={() => setEditingBookmark(null)}>
          <div className="panel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-modal-header">
              <span>Edit Bookmark</span>
              <button onClick={() => setEditingBookmark(null)}>✕</button>
            </div>
            <label>
              Title
              <input
                value={editingBookmark.title}
                onChange={(e) => setEditingBookmark({ ...editingBookmark, title: e.target.value })}
              />
            </label>
            <label>
              URL
              <input
                value={editingBookmark.url}
                onChange={(e) => setEditingBookmark({ ...editingBookmark, url: e.target.value })}
              />
            </label>
            <div className="panel-modal-actions">
              <button onClick={() => handleSaveBookmark().catch(console.error)}>Save</button>
              <button onClick={() => setEditingBookmark(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <div className="panel-modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="panel-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-modal-header">
              <span>{confirmDialog.title}</span>
              <button onClick={() => setConfirmDialog(null)}>✕</button>
            </div>
            <p>{confirmDialog.message}</p>
            <div className="panel-modal-actions">
              <button onClick={() => handleConfirmDialog().catch(console.error)}>
                {confirmDialog.confirmLabel}
              </button>
              <button onClick={() => setConfirmDialog(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
