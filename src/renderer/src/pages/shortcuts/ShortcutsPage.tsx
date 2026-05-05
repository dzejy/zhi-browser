import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import './shortcuts.css'
import './shortcuts.elegant.css'

interface ShortcutItem {
  id: string
  label: string
  category: string
  defaultKey: string
  currentKey: string
  enabled: boolean
  scope: 'global' | 'app'
}

const MODIFIER_KEYS = new Set([
  'Control',
  'Shift',
  'Alt',
  'Meta',
  'Hyper',
  'Super',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Dead'
])

const CODE_TO_LITERAL: Record<string, string> = {
  Slash: '/',
  Backquote: '`',
  Backslash: '\\',
  Period: '.',
  Comma: ',',
  Quote: "'",
  Semicolon: ';',
  Equal: '=',
  Minus: '-',
  BracketLeft: '[',
  BracketRight: ']'
}

const FRIENDLY_KEY: Record<string, string> = {
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ' ': 'Space'
}

function buildAcceleratorFromEvent(e: ReactKeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let label = e.key
  const code = e.code
  if (code && CODE_TO_LITERAL[code]) {
    label = CODE_TO_LITERAL[code]
  } else if (code) {
    const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code)
    if (digit) label = digit[1]
    const fn = /^F([1-9]|1[0-9]|2[0-4])$/.exec(code)
    if (fn) label = `F${fn[1]}`
    const letter = /^Key([A-Z])$/.exec(code)
    if (letter) label = letter[1]
  }
  if (FRIENDLY_KEY[label]) label = FRIENDLY_KEY[label]
  if (label.length === 1) label = label.toUpperCase()
  parts.push(label)
  return parts.join('+')
}

function shortcutMatches(item: ShortcutItem, keyword: string): boolean {
  const haystack = `${item.label} ${item.category} ${item.currentKey} ${item.defaultKey}`.toLowerCase()
  return haystack.includes(keyword)
}

interface RowEditState {
  recording: boolean
  pending: string
  error: string
}

function defaultRowState(): RowEditState {
  return { recording: false, pending: '', error: '' }
}

export function ShortcutsPage(): React.JSX.Element {
  const [items, setItems] = useState<ShortcutItem[]>([])
  const [query, setQuery] = useState('')
  const [rowState, setRowState] = useState<Record<string, RowEditState>>({})
  const [statusMessage, setStatusMessage] = useState<string>('')
  const statusTimerRef = useRef<number | null>(null)

  const updateRow = useCallback((id: string, patch: Partial<RowEditState>) => {
    setRowState((prev) => ({ ...prev, [id]: { ...defaultRowState(), ...prev[id], ...patch } }))
  }, [])

  const flashStatus = useCallback((text: string) => {
    setStatusMessage(text)
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
    statusTimerRef.current = window.setTimeout(() => setStatusMessage(''), 2400)
  }, [])

  useEffect(() => {
    let cancelled = false
    window.api
      .shortcutsGetAll()
      .then((list) => {
        if (!cancelled) setItems(list as ShortcutItem[])
      })
      .catch((err) => console.error('[shortcuts] load failed', err))
    const unsubscribe = window.api.onShortcutsChanged((list) => {
      setItems(list as ShortcutItem[])
    })
    return () => {
      cancelled = true
      unsubscribe()
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
    }
  }, [])

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword ? items.filter((item) => shortcutMatches(item, keyword)) : items
    const map = new Map<string, ShortcutItem[]>()
    for (const item of filtered) {
      const list = map.get(item.category)
      if (list) list.push(item)
      else map.set(item.category, [item])
    }
    return Array.from(map, ([category, list]) => ({ category, items: list }))
  }, [items, query])

  const startRecording = useCallback(
    (id: string) => {
      setRowState((prev) => {
        const next: Record<string, RowEditState> = {}
        for (const [key, state] of Object.entries(prev)) {
          if (key !== id) next[key] = { ...state, recording: false }
        }
        next[id] = { recording: true, pending: '', error: '' }
        return next
      })
    },
    []
  )

  const cancelRecording = useCallback((id: string) => {
    updateRow(id, { recording: false, pending: '', error: '' })
  }, [updateRow])

  const applyKey = useCallback(
    async (id: string, newKey: string) => {
      const result = await window.api.shortcutsUpdate(id, newKey)
      if (!result.success) {
        const conflictLabel = result.conflict?.label ?? '已有快捷键'
        updateRow(id, {
          recording: false,
          pending: newKey,
          error: `与「${conflictLabel}」冲突`
        })
        return false
      }
      updateRow(id, { recording: false, pending: '', error: '' })
      flashStatus('快捷键已更新')
      return true
    },
    [flashStatus, updateRow]
  )

  const handleKeyCapture = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        cancelRecording(id)
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        applyKey(id, '').catch(console.error)
        return
      }
      const accel = buildAcceleratorFromEvent(e)
      if (!accel) return
      applyKey(id, accel).catch(console.error)
    },
    [applyKey, cancelRecording]
  )

  const resetOne = useCallback(
    async (id: string) => {
      const result = await window.api.shortcutsReset(id)
      if (result.success) {
        updateRow(id, defaultRowState())
        flashStatus('已恢复默认')
      }
    },
    [flashStatus, updateRow]
  )

  const toggleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      await window.api.shortcutsToggle(id, enabled)
      flashStatus(enabled ? '已启用' : '已禁用')
    },
    [flashStatus]
  )

  const resetAll = useCallback(async () => {
    if (!window.confirm('确定要将所有快捷键恢复为默认值吗？')) return
    await window.api.shortcutsResetAll()
    setRowState({})
    flashStatus('已恢复所有默认快捷键')
  }, [flashStatus])

  return (
    <div className="shortcuts-page">
      <div className="shortcuts-shell">
        <header className="shortcuts-topbar">
          <div className="shortcuts-topbar-left">
            <span className="shortcuts-eyebrow">内部页面</span>
            <h1>快捷键</h1>
          </div>
          <div className="shortcuts-topbar-actions">
            <label className="shortcuts-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索功能或按键"
              />
            </label>
            <button type="button" className="shortcuts-button is-danger" onClick={resetAll}>
              全部重置
            </button>
          </div>
        </header>

        {statusMessage && <div className="shortcuts-banner">{statusMessage}</div>}

        <main className="shortcuts-list">
          {groups.length === 0 ? (
            <div className="shortcuts-empty">
              <div>⌘</div>
              <p>没有匹配的快捷键</p>
            </div>
          ) : (
            groups.map((group, groupIndex) => (
              <section
                key={group.category}
                className="shortcuts-group"
                style={{ '--delay': `${groupIndex * 30}ms` } as CSSProperties}
              >
                <h2>{group.category}</h2>
                <div className="shortcuts-card">
                  {group.items.map((item) => {
                    const state = rowState[item.id] ?? defaultRowState()
                    const recording = state.recording
                    const conflict = !!state.error
                    const display = recording
                      ? '请按下新组合…'
                      : item.currentKey || '未设置'
                    const isCustom = item.currentKey !== item.defaultKey
                    return (
                      <div
                        key={item.id}
                        className={`shortcuts-row ${item.enabled ? '' : 'is-disabled'}`}
                      >
                        <div className="shortcuts-row-label">
                          <span className="shortcuts-label-text">{item.label}</span>
                          <span className="shortcuts-label-meta">
                            {item.scope === 'global' ? '全局热键' : '应用内'}
                            {isCustom ? ` · 默认 ${item.defaultKey}` : ''}
                            {state.error ? ` · ${state.error}` : ''}
                          </span>
                        </div>
                        <div className="shortcuts-row-actions">
                          <button
                            type="button"
                            className={
                              'shortcuts-key-display' +
                              (recording ? ' is-recording' : '') +
                              (conflict ? ' is-conflict' : '') +
                              (!item.currentKey && !recording ? ' is-empty' : '')
                            }
                            onClick={() => {
                              if (recording) cancelRecording(item.id)
                              else startRecording(item.id)
                            }}
                            onBlur={() => {
                              if (recording) cancelRecording(item.id)
                            }}
                            onKeyDown={(e) => {
                              if (!recording) return
                              handleKeyCapture(e, item.id)
                            }}
                            title={
                              recording
                                ? 'Esc 取消，Backspace 清除'
                                : '点击后按下新的组合键'
                            }
                          >
                            {display}
                          </button>
                          <button
                            type="button"
                            className={`shortcuts-icon-button is-toggle ${
                              item.enabled ? 'is-on' : 'is-off'
                            }`}
                            title={item.enabled ? '已启用，点击禁用' : '已禁用，点击启用'}
                            onClick={() => toggleEnabled(item.id, !item.enabled)}
                          >
                            {item.enabled ? '●' : '○'}
                          </button>
                          <button
                            type="button"
                            className="shortcuts-icon-button"
                            title="恢复默认"
                            onClick={() => resetOne(item.id)}
                            disabled={!isCustom && item.enabled}
                          >
                            ↺
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    </div>
  )
}
