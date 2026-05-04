import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './history.css'

interface HistoryEntry {
  id: string
  title: string
  url: string
  favicon?: string
  timestamp: number
}

type ClearRange = 'hour' | 'day' | 'week' | 'all'

const STORAGE_KEY = 'zhi-history'

const sampleSites = [
  ['Zhi Browser 设计草案', 'https://github.com/zhi-browser/design'],
  ['Electron WebContentsView', 'https://www.electronjs.org/docs/latest/api/web-contents-view'],
  ['React Hooks 参考', 'https://zh-hans.react.dev/reference/react'],
  ['TypeScript Utility Types', 'https://www.typescriptlang.org/docs/handbook/utility-types.html'],
  ['MDN CSS backdrop-filter', 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/backdrop-filter'],
  ['知乎：效率工具讨论', 'https://www.zhihu.com/question/123456'],
  ['哔哩哔哩：Electron 教程', 'https://www.bilibili.com/video/BV1demo'],
  ['少数派：浏览器插件推荐', 'https://sspai.com/post/88888'],
  ['Chromium Extensions', 'https://developer.chrome.com/docs/extensions'],
  ['Vite 构建优化', 'https://vite.dev/guide/performance'],
  ['GitHub Trending', 'https://github.com/trending'],
  ['Product Hunt 今日新品', 'https://www.producthunt.com'],
  ['Figma Community', 'https://www.figma.com/community'],
  ['Node.js Streams', 'https://nodejs.org/api/stream.html'],
  ['CSS Tricks Grid Guide', 'https://css-tricks.com/snippets/css/complete-guide-grid'],
  ['Can I Use backdrop-filter', 'https://caniuse.com/css-backdrop-filter'],
  ['Web.dev Storage', 'https://web.dev/storage-for-the-web'],
  ['Chrome Web Store', 'https://chromewebstore.google.com'],
  ['Bing 搜索：浏览器 UI', 'https://www.bing.com/search?q=browser+ui'],
  ['百度搜索：Electron 扩展', 'https://www.baidu.com/s?wd=Electron%20%E6%89%A9%E5%B1%95']
]

function createHistoryEntry(index: number): HistoryEntry {
  const [title, url] = sampleSites[index]
  const now = Date.now()
  const day = 1000 * 60 * 60 * 24
  const offset = index < 8 ? index * 1000 * 60 * 28 : index < 14 ? day + index * 1000 * 60 * 35 : day * 3 + index * 1000 * 60 * 75
  return {
    id: `history-${index}-${now}`,
    title,
    url,
    favicon: `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`,
    timestamp: now - offset
  }
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return sampleSites.map((_, index) => createHistoryEntry(index))
    const parsed = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(parsed) ? parsed : sampleSites.map((_, index) => createHistoryEntry(index))
  } catch {
    return sampleSites.map((_, index) => createHistoryEntry(index))
  }
}

function saveHistory(history: HistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function getDayStart(timestamp = Date.now()): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function groupHistory(entries: HistoryEntry[]): Array<{ label: string; items: HistoryEntry[] }> {
  const today = getDayStart()
  const yesterday = today - 1000 * 60 * 60 * 24
  const groups = [
    { label: '今天', items: entries.filter((item) => item.timestamp >= today) },
    { label: '昨天', items: entries.filter((item) => item.timestamp >= yesterday && item.timestamp < today) },
    { label: '更早', items: entries.filter((item) => item.timestamp < yesterday) }
  ]
  return groups.filter((group) => group.items.length > 0)
}

function getClearCutoff(range: ClearRange): number {
  const now = Date.now()
  if (range === 'hour') return now - 1000 * 60 * 60
  if (range === 'day') return now - 1000 * 60 * 60 * 24
  if (range === 'week') return now - 1000 * 60 * 60 * 24 * 7
  return 0
}

export function HistoryPage(): React.JSX.Element {
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [clearRange, setClearRange] = useState<ClearRange>('day')

  useEffect(() => saveHistory(history), [history])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp)
    if (!keyword) return sorted
    return sorted.filter(
      (item) => item.title.toLowerCase().includes(keyword) || item.url.toLowerCase().includes(keyword)
    )
  }, [history, query])

  const grouped = useMemo(() => groupHistory(filtered), [filtered])

  function toggleSelected(id: string): void {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function deleteOne(id: string): void {
    setHistory((current) => current.filter((item) => item.id !== id))
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  function deleteSelected(): void {
    setHistory((current) => current.filter((item) => !selectedIds.has(item.id)))
    setSelectedIds(new Set())
  }

  function clearByRange(): void {
    if (clearRange === 'all') {
      setHistory([])
    } else {
      const cutoff = getClearCutoff(clearRange)
      setHistory((current) => current.filter((item) => item.timestamp < cutoff))
    }
    setSelectedIds(new Set())
    setShowClearDialog(false)
  }

  return (
    <div className="history-page">
      <div className="history-shell">
        <header className="history-topbar">
          <div>
            <span className="history-eyebrow">内部页面</span>
            <h1>历史记录</h1>
          </div>
          <div className="history-actions">
            <label className="history-search">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或 URL" />
            </label>
            {selectedIds.size > 0 && (
              <button className="history-danger-btn" onClick={deleteSelected}>删除选中 ({selectedIds.size})</button>
            )}
            <button className="history-danger-btn" onClick={() => setShowClearDialog(true)}>清除浏览数据</button>
          </div>
        </header>

        <main className="history-list">
          {grouped.length === 0 ? (
            <div className="history-empty">
              <div>◷</div>
              <p>{query ? '没有匹配的历史记录' : '暂无历史记录'}</p>
            </div>
          ) : (
            grouped.map((group) => (
              <section key={group.label} className="history-group">
                <div className="history-group-title"><span>{group.label}</span></div>
                {group.items.map((item, index) => (
                  <div key={item.id} className="history-item" style={{ '--delay': `${index * 30}ms` } as CSSProperties}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      aria-label={`选择 ${item.title}`}
                    />
                    <div className="history-favicon">
                      <span>🌐</span>
                      {item.favicon && <img src={item.favicon} alt="" onError={(event) => (event.currentTarget.style.display = 'none')} />}
                    </div>
                    <button className="history-link" onClick={() => window.api?.openUrl?.(item.url, false)}>
                      <strong>{item.title}</strong>
                      <span>{item.url}</span>
                    </button>
                    <time>{formatTime(item.timestamp)}</time>
                    <button className="history-delete" onClick={() => deleteOne(item.id)} title="删除">×</button>
                  </div>
                ))}
              </section>
            ))
          )}
        </main>
      </div>

      {showClearDialog && (
        <div className="history-modal-backdrop" onClick={() => setShowClearDialog(false)}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <h2>清除浏览数据</h2>
            <p>请选择要清除的时间范围，操作会立即更新本地历史记录。</p>
            <div className="history-range-list">
              {([
                ['hour', '最近 1 小时'],
                ['day', '最近 24 小时'],
                ['week', '最近 7 天'],
                ['all', '全部']
              ] as Array<[ClearRange, string]>).map(([value, label]) => (
                <label key={value} className={clearRange === value ? 'active' : ''}>
                  <input type="radio" checked={clearRange === value} onChange={() => setClearRange(value)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="history-modal-actions">
              <button className="history-secondary-btn" onClick={() => setShowClearDialog(false)}>取消</button>
              <button className="history-danger-btn" onClick={clearByRange}>确认清除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
