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
  url: string
  title: string
  favicon: string
  closedAt: number
}
interface BookmarkItem {
  url: string
  title: string
  favicon: string
  createdAt: number
}
interface HistoryItem {
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
  restoreSession: boolean
  downloadPath: string
  askWhereToSaveBeforeDownloading: boolean
}

type SidePanelType = 'bookmarks' | 'history' | 'downloads' | 'settings'

const TOP_CHROME_HEIGHT = 74
const FIND_BAR_HEIGHT = 34
const ERROR_BAR_HEIGHT = 32

function getOpenPanelType(
  showBookmarks: boolean,
  showHistory: boolean,
  showDownloads: boolean,
  showSettings: boolean
): SidePanelType | null {
  if (showBookmarks) return 'bookmarks'
  if (showHistory) return 'history'
  if (showDownloads) return 'downloads'
  if (showSettings) return 'settings'
  return null
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
      window.api.getHistory(200).then(setHistoryItems)
    })
    const unsub9 = window.api.onOpenDownloadsPanel(() => {
      setShowDownloads(true)
      setShowBookmarks(false)
      setShowHistory(false)
      setShowSettings(false)
    })
    const unsub10 = window.api.onPanelClosed(() => {
      setShowBookmarks(false)
      setShowHistory(false)
      setShowDownloads(false)
      setShowSettings(false)
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

    const openPanelType = getOpenPanelType(showBookmarks, showHistory, showDownloads, showSettings)
    if (openPanelType) {
      window.api.showPanel(openPanelType)
    } else {
      window.api.hidePanel()
    }
  }, [showFind, activeTab?.error, showBookmarks, showHistory, showDownloads, showSettings])

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
  }

  async function handleShowHistory(): Promise<void> {
    const items = await window.api.getHistory(200)
    setHistoryItems(items)
    setShowHistory(!showHistory)
    setShowBookmarks(false)
    setShowDownloads(false)
    setShowSettings(false)
  }

  function handleShowDownloads(): void {
    setShowDownloads(!showDownloads)
    setShowBookmarks(false)
    setShowHistory(false)
    setShowSettings(false)
  }
  function handleShowSettings(): void {
    setShowSettings(!showSettings)
    setShowBookmarks(false)
    setShowHistory(false)
    setShowDownloads(false)
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
        window.api.getHistory(200).then(setHistoryItems)
      } else if (ctrl && e.key === 'j') {
        e.preventDefault()
        setShowDownloads(true)
        setShowBookmarks(false)
        setShowHistory(false)
        setShowSettings(false)
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

  useEffect(() => {
    const unsubPanelType = window.api.onPanelType((type) => setPanelType(type))
    const unsubBrowserState = window.api.onBrowserState((state: BrowserState) =>
      setBrowserState(state)
    )
    const unsubDownloadUpdate = window.api.onDownloadUpdate(() => {
      window.api.getBrowserState().then(setBrowserState)
    })

    window.api.getBrowserState().then(setBrowserState)
    window.api.getBookmarks().then(setBookmarks)
    window.api.getSettings().then(setSettings)

    return () => {
      unsubPanelType()
      unsubBrowserState()
      unsubDownloadUpdate()
    }
  }, [])

  useEffect(() => {
    if (panelType === 'bookmarks') {
      window.api.getBookmarks().then(setBookmarks)
    } else if (panelType === 'history') {
      window.api.getHistory(200).then(setHistoryItems)
    } else if (panelType === 'downloads') {
      window.api.getBrowserState().then(setBrowserState)
    } else if (panelType === 'settings') {
      window.api.getSettings().then(setSettings)
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

  function handleOpenBookmark(url: string): void {
    window.api.openUrl(url, false)
    closePanel()
  }

  function handleOpenHistory(url: string): void {
    window.api.openUrl(url, false)
    closePanel()
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
                    <label>Search Engine</label>
                    <select
                      value={settings.searchEngine}
                      onChange={async (e) => {
                        const newSet = await window.api.updateSettings({
                          searchEngine: e.target.value as BrowserSettings['searchEngine']
                        })
                        setSettings(newSet)
                      }}
                    >
                      <option value="google">Google</option>
                      <option value="bing">Bing</option>
                      <option value="baidu">Baidu</option>
                      <option value="duckduckgo">DuckDuckGo</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <label>Download Path</label>
                    <input
                      type="text"
                      value={settings.downloadPath}
                      onChange={async (e) => {
                        const newSet = await window.api.updateSettings({
                          downloadPath: e.target.value
                        })
                        setSettings(newSet)
                      }}
                    />
                  </div>
                  <label className="settings-check">
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
                  <label className="settings-check">
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
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
