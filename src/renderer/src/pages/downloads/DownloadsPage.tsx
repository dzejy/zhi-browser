import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './downloads.css'

type DownloadStatus = 'completed' | 'downloading' | 'paused' | 'failed'

interface DownloadEntry {
  id: string
  fileName: string
  size: number
  sourceUrl: string
  downloadedAt: number
  status: DownloadStatus
  progress: number
  speed?: string
}

const STORAGE_KEY = 'zhi-downloads'

const defaultDownloads: DownloadEntry[] = [
  createDownload('zhi-browser-3.2.0-win-x64.exe', 128_400_000, 'https://release.zhi.dev/download/win', 'completed', 100),
  createDownload('aurora-wallpaper.png', 4_920_000, 'https://images.example.com/aurora-wallpaper.png', 'completed', 100),
  createDownload('meeting-recording.mp4', 762_000_000, 'https://cdn.example.com/video/meeting-recording.mp4', 'downloading', 68, '6.8 MB/s'),
  createDownload('lofi-focus-session.mp3', 58_600_000, 'https://audio.example.com/lofi-focus-session.mp3', 'downloading', 42, '1.2 MB/s'),
  createDownload('design-assets.zip', 245_000_000, 'https://assets.example.com/design-assets.zip', 'paused', 57),
  createDownload('product-specification.pdf', 3_400_000, 'https://docs.example.com/product-specification.pdf', 'failed', 21),
  createDownload('browser-extension-sample.crx', 1_900_000, 'https://extensions.example.com/sample.crx', 'failed', 8),
  createDownload('notes-export.md', 180_000, 'https://notes.example.com/export.md', 'completed', 100)
]

function createDownload(
  fileName: string,
  size: number,
  sourceUrl: string,
  status: DownloadStatus,
  progress: number,
  speed?: string
): DownloadEntry {
  return {
    id: `${fileName}-${Math.random().toString(36).slice(2, 8)}`,
    fileName,
    size,
    sourceUrl,
    downloadedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 48),
    status,
    progress,
    speed
  }
}

function loadDownloads(): DownloadEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultDownloads
    const parsed = JSON.parse(raw) as DownloadEntry[]
    return Array.isArray(parsed) ? parsed : defaultDownloads
  } catch {
    return defaultDownloads
  }
}

function saveDownloads(downloads: DownloadEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads))
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️'
  if (['mp4', 'mov', 'mkv', 'webm'].includes(ext)) return '🎬'
  if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return '🎵'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'crx'].includes(ext)) return '📦'
  if (['pdf', 'doc', 'docx', 'md', 'txt', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) return '📄'
  return '📎'
}

function getStatusLabel(item: DownloadEntry): string {
  if (item.status === 'completed') return '已完成 ✓'
  if (item.status === 'downloading') return `下载中 ${item.progress}% · ${item.speed || '计算速度中'}`
  if (item.status === 'paused') return '已暂停'
  return '已失败 ✕'
}

export function DownloadsPage(): React.JSX.Element {
  const [downloads, setDownloads] = useState<DownloadEntry[]>(() => loadDownloads())
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => saveDownloads(downloads), [downloads])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const sorted = [...downloads].sort((a, b) => b.downloadedAt - a.downloadedAt)
    if (!keyword) return sorted
    return sorted.filter(
      (item) => item.fileName.toLowerCase().includes(keyword) || item.sourceUrl.toLowerCase().includes(keyword)
    )
  }, [downloads, query])

  function updateDownload(id: string, updates: Partial<DownloadEntry>): void {
    setDownloads((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  function removeDownload(id: string): void {
    setDownloads((current) => current.filter((item) => item.id !== id))
  }

  function showNotice(text: string): void {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 1800)
  }

  return (
    <div className="downloads-page">
      <div className="downloads-shell">
        <header className="downloads-topbar">
          <div>
            <span className="downloads-eyebrow">内部页面</span>
            <h1>下载管理</h1>
          </div>
          <div className="downloads-actions">
            <label className="downloads-search">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名或来源" />
            </label>
            <button className="downloads-secondary-btn" onClick={() => setDownloads([])}>清除下载记录</button>
          </div>
        </header>

        {notice && <div className="downloads-notice">{notice}</div>}

        <main className="downloads-list">
          {filtered.length === 0 ? (
            <div className="downloads-empty">
              <div>⇩</div>
              <p>{query ? '没有匹配的下载记录' : '暂无下载记录'}</p>
            </div>
          ) : (
            filtered.map((item, index) => (
              <article
                key={item.id}
                className={`downloads-card is-${item.status}`}
                style={{ '--delay': `${index * 30}ms` } as CSSProperties}
              >
                <div className="downloads-file-icon">{getFileIcon(item.fileName)}</div>
                <div className="downloads-card-main">
                  <div className="downloads-card-head">
                    <strong>{item.fileName}</strong>
                    <span className="downloads-status">{getStatusLabel(item)}</span>
                  </div>
                  <div className="downloads-meta">
                    <span>{formatSize(item.size)}</span>
                    <span>{item.sourceUrl}</span>
                    <time>{formatTime(item.downloadedAt)}</time>
                  </div>
                  {item.status === 'downloading' && (
                    <div className="downloads-progress" aria-label={`下载进度 ${item.progress}%`}>
                      <div className="downloads-progress-fill" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>
                <div className="downloads-card-actions">
                  {item.status === 'completed' && (
                    <>
                      <button onClick={() => showNotice('正在打开文件')}>打开文件</button>
                      <button onClick={() => showNotice('正在打开所在文件夹')}>打开所在文件夹</button>
                      <button className="danger" onClick={() => removeDownload(item.id)}>删除记录</button>
                    </>
                  )}
                  {item.status === 'downloading' && (
                    <>
                      <button onClick={() => updateDownload(item.id, { status: 'paused', speed: undefined })}>暂停</button>
                      <button className="danger" onClick={() => removeDownload(item.id)}>取消</button>
                    </>
                  )}
                  {item.status === 'paused' && (
                    <>
                      <button onClick={() => updateDownload(item.id, { status: 'downloading', speed: '2.4 MB/s' })}>继续</button>
                      <button className="danger" onClick={() => removeDownload(item.id)}>取消</button>
                    </>
                  )}
                  {item.status === 'failed' && (
                    <>
                      <button onClick={() => updateDownload(item.id, { status: 'downloading', progress: 12, speed: '1.7 MB/s' })}>重试</button>
                      <button className="danger" onClick={() => removeDownload(item.id)}>删除</button>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
        </main>
      </div>
    </div>
  )
}
