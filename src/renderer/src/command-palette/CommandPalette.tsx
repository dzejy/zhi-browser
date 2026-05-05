import { useEffect, useMemo, useRef, useState } from 'react'
import { fuzzyMatch } from './matcher'
import './styles.css'
import './styles.elegant.css'

interface BuiltinCmd {
  id: string
  label: string
  category: string
  icon: string
  shortcut?: string
  action: () => void | Promise<void>
}

interface BookmarkLite {
  id?: string
  url: string
  title: string
}

interface HistoryLite {
  id?: string
  url: string
  title: string
}

const PREFIXES: Record<string, string> = {
  '>': '命令',
  '/': '历史',
  '@': '书签',
  '#': '标签页',
  '!': '自定义'
}

type Mode = 'all' | 'command' | 'history' | 'bookmark' | 'tab' | 'custom'

interface ListItem {
  id: string
  label: string
  category: string
  icon: string
  shortcut?: string
  onExec: () => void | Promise<void>
  score: number
}

export default function CommandPalette(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [bookmarks, setBookmarks] = useState<BookmarkLite[]>([])
  const [history, setHistory] = useState<HistoryLite[]>([])
  const [tabs, setTabs] = useState<Array<{ id: string; title: string; url: string }>>([])
  const [customs, setCustoms] = useState<
    Array<{ id: string; label: string; type: string; payload: string }>
  >([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    window.api
      .bookmarksGetAll()
      .then((b) => setBookmarks(b as BookmarkLite[]))
      .catch(() => {})
    window.api
      .historyGetAll({ limit: 100 })
      .then((res) => setHistory((res?.items || []) as HistoryLite[]))
      .catch(() => {})
    window.api
      .getBrowserState()
      .then((s) => {
        setTabs(
          s.tabs.map((t) => ({ id: t.id, title: t.title || '新标签页', url: t.url || '' }))
        )
      })
      .catch(() => {})
    window.api
      .commandPaletteGetCustom()
      .then((cs) => setCustoms(cs))
      .catch(() => {})
  }, [])

  const close = (): void => {
    window.api.commandPaletteClose()
  }

  const navigateOrNewTab = (url: string): void => {
    window.api.openUrl(url, true)
    close()
  }

  const switchTab = (tabId: string): void => {
    window.api.switchTab(tabId)
    close()
  }

  const builtins = useMemo<BuiltinCmd[]>(
    () => [
      {
        id: 'new-tab',
        label: '新建标签页',
        category: '标签页',
        icon: '＋',
        shortcut: 'Ctrl+T',
        action: () => {
          window.api.createTab()
          close()
        }
      },
      {
        id: 'close-tab',
        label: '关闭当前标签',
        category: '标签页',
        icon: '✕',
        shortcut: 'Ctrl+W',
        action: () => {
          window.api
            .getBrowserState()
            .then((s) => {
              if (s.activeTabId) window.api.closeTab(s.activeTabId)
              close()
            })
            .catch(close)
        }
      },
      {
        id: 'screenshot',
        label: '截图',
        category: '工具',
        icon: '📸',
        shortcut: 'Alt+A',
        action: () => {
          window.api.screenshotOpen()
          close()
        }
      },
      {
        id: 'translate',
        label: '翻译当前页',
        category: '工具',
        icon: '🌐',
        shortcut: 'Alt+T',
        action: () => {
          window.api.translatePage(true)
          close()
        }
      },
      {
        id: 'darkmode',
        label: '切换暗色模式',
        category: '设置',
        icon: '🌙',
        shortcut: 'Alt+D',
        action: () => {
          window.api.toggleDarkMode()
          close()
        }
      },
      {
        id: 'reader',
        label: '阅读模式',
        category: '工具',
        icon: '📖',
        shortcut: 'Alt+R',
        action: () => {
          window.api.readerEnter().finally(close)
        }
      },
      {
        id: 'proxy-toggle',
        label: '切换代理开关',
        category: '设置',
        icon: '🛡',
        shortcut: 'Alt+P',
        action: () => {
          window.api
            .proxyStatus()
            .then((s) => window.api.proxyToggle(!s.enabled))
            .finally(close)
        }
      },
      {
        id: 'devtools',
        label: '打开开发者工具',
        category: '工具',
        icon: '🛠',
        action: () => {
          window.api.toggleDevTools().finally(close)
        }
      },
      {
        id: 'open-history',
        label: '打开历史记录',
        category: '导航',
        icon: '🕒',
        action: () => {
          window.api.showPanel('history')
          close()
        }
      },
      {
        id: 'open-bookmarks',
        label: '打开书签管理',
        category: '导航',
        icon: '⭐',
        action: () => {
          window.api.showPanel('bookmarks')
          close()
        }
      },
      {
        id: 'open-downloads',
        label: '打开下载',
        category: '导航',
        icon: '⬇',
        action: () => {
          window.api.showPanel('downloads')
          close()
        }
      },
      {
        id: 'open-settings',
        label: '打开设置',
        category: '导航',
        icon: '⚙',
        action: () => {
          window.api.showPanel('settings')
          close()
        }
      },
      {
        id: 'long-screenshot',
        label: '长截图当前页',
        category: '工具',
        icon: '📐',
        shortcut: 'Alt+L',
        action: () => {
          window.api.screenshotLongCapture().finally(close)
        }
      },
      {
        id: 'quick-note',
        label: '打开快捷笔记',
        category: '工具',
        icon: '📝',
        shortcut: 'Alt+N',
        action: () => {
          window.api.quickNoteToggle().finally(close)
        }
      },
      {
        id: 'hibernate-others',
        label: '休眠其他标签页',
        category: '标签页',
        icon: '💤',
        shortcut: 'Alt+H',
        action: () => {
          window.api.hibernationHibernateOthers().finally(close)
        }
      },
      {
        id: 'restore-closed',
        label: '恢复关闭的标签页',
        category: '标签页',
        icon: '↺',
        shortcut: 'Ctrl+Shift+T',
        action: () => {
          window.api.restoreClosed()
          close()
        }
      },
      {
        id: 'clear-cache',
        label: '清除浏览数据',
        category: '设置',
        icon: '🧹',
        action: () => {
          window.api.showPanel('settings')
          close()
        }
      }
    ],
    []
  )

  const { mode, effectiveQuery } = useMemo<{ mode: Mode; effectiveQuery: string }>(() => {
    const trimmed = query.trimStart()
    const first = trimmed[0]
    if (first && PREFIXES[first]) {
      const map: Record<string, Mode> = {
        '>': 'command',
        '/': 'history',
        '@': 'bookmark',
        '#': 'tab',
        '!': 'custom'
      }
      return { mode: map[first], effectiveQuery: trimmed.slice(1).trim() }
    }
    return { mode: 'all', effectiveQuery: trimmed.trim() }
  }, [query])

  const items = useMemo<ListItem[]>(() => {
    const out: ListItem[] = []

    const pushIfMatched = (item: ListItem, hay: string): void => {
      if (!effectiveQuery) {
        out.push(item)
        return
      }
      const m = fuzzyMatch(effectiveQuery, hay)
      if (m.matched) out.push({ ...item, score: m.score })
    }

    if (mode === 'all' || mode === 'command') {
      builtins.forEach((b) =>
        pushIfMatched(
          {
            id: 'b_' + b.id,
            label: b.label,
            category: b.category,
            icon: b.icon,
            shortcut: b.shortcut,
            onExec: b.action,
            score: 0
          },
          b.label + ' ' + b.category
        )
      )
    }
    if (mode === 'all' || mode === 'history') {
      history.slice(0, 50).forEach((h) =>
        pushIfMatched(
          {
            id: 'h_' + (h.id ?? h.url),
            label: h.title || h.url,
            category: '历史',
            icon: '🕒',
            onExec: () => navigateOrNewTab(h.url),
            score: 0
          },
          (h.title || '') + ' ' + (h.url || '')
        )
      )
    }
    if (mode === 'all' || mode === 'bookmark') {
      bookmarks.slice(0, 50).forEach((b) =>
        pushIfMatched(
          {
            id: 'm_' + (b.id ?? b.url),
            label: b.title || b.url,
            category: '书签',
            icon: '⭐',
            onExec: () => navigateOrNewTab(b.url),
            score: 0
          },
          (b.title || '') + ' ' + (b.url || '')
        )
      )
    }
    if (mode === 'all' || mode === 'tab') {
      tabs.forEach((t) =>
        pushIfMatched(
          {
            id: 't_' + t.id,
            label: t.title,
            category: '标签页',
            icon: '📑',
            onExec: () => switchTab(t.id),
            score: 0
          },
          t.title + ' ' + t.url
        )
      )
    }
    if (mode === 'all' || mode === 'custom') {
      customs.forEach((c) =>
        pushIfMatched(
          {
            id: 'c_' + c.id,
            label: c.label,
            category: '自定义',
            icon: '⚡',
            onExec: () => {
              window.api.commandPaletteExecuteCustom({
                id: c.id,
                label: c.label,
                type: c.type as 'open-url' | 'run-js' | 'set-pref' | 'launch-app',
                payload: c.payload,
                createdAt: 0
              })
            },
            score: 0
          },
          c.label
        )
      )
    }

    out.sort((a, b) => b.score - a.score)
    return out.slice(0, 20)
  }, [mode, effectiveQuery, builtins, history, bookmarks, tabs, customs])

  useEffect(() => {
    setActive(0)
  }, [query])

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[active]
      if (item) item.onExec()
    }
  }

  return (
    <div className="cp-overlay" onClick={close}>
      <div className="cp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cp-input-row">
          {mode !== 'all' && <div className="cp-mode-badge">{PREFIXES[query[0] || '']}</div>}
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="输入命令… (>命令 /历史 @书签 #标签 !自定义)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
          />
        </div>
        <div ref={listRef} className="cp-list">
          {items.length === 0 && <div className="cp-empty">无匹配项</div>}
          {items.map((it, i) => (
            <div
              key={it.id}
              className={`cp-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => it.onExec()}
            >
              <div className="cp-item-icon">{it.icon}</div>
              <div className="cp-item-label">{it.label}</div>
              <div className="cp-item-cat">{it.category}</div>
              {it.shortcut && <div className="cp-item-shortcut">{it.shortcut}</div>}
            </div>
          ))}
        </div>
        <div className="cp-hint">↑/↓ 选择 · Enter 执行 · Esc 关闭</div>
      </div>
    </div>
  )
}
