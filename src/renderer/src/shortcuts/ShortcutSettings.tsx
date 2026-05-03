import { useEffect, useState } from 'react'
import './styles.css'

interface ShortcutItem {
  id: string
  label: string
  defaultKey: string
  currentKey: string
  enabled: boolean
}

function normalizeKey(e: React.KeyboardEvent<HTMLInputElement>): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const raw = e.key
  if (!raw || ['Control', 'Alt', 'Shift', 'Meta'].includes(raw)) return ''
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    Escape: 'Esc',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right'
  }
  const key = keyMap[raw] || (raw.length === 1 ? raw.toUpperCase() : raw)
  parts.push(key)
  return parts.join('+')
}

export default function ShortcutSettings(): React.JSX.Element {
  const [items, setItems] = useState<ShortcutItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = async (): Promise<void> => {
    const all = await window.api.shortcutsGetAll()
    setItems(all)
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const updateKey = async (item: ShortcutItem, key: string): Promise<void> => {
    if (!key) return
    const result = await window.api.shortcutsUpdate(item.id, key)
    if (!result.success) {
      setMessage(`与「${result.conflict || '其他快捷键'}」冲突`)
      return
    }
    setMessage('快捷键已保存')
    setEditingId(null)
    await load()
  }

  const toggle = async (item: ShortcutItem, enabled: boolean): Promise<void> => {
    await window.api.shortcutsToggle(item.id, enabled)
    await load()
  }

  return (
    <div className="shortcut-root">
      <header className="shortcut-header">
        <div>
          <h1>快捷键设置</h1>
          <p>点击快捷键框后直接按下新的组合键。</p>
        </div>
        <button className="shortcut-close" onClick={() => window.api.shortcutsCloseSettings()}>
          关闭
        </button>
      </header>
      <main className="shortcut-list">
        {items.map((item) => (
          <section className="shortcut-item" key={item.id}>
            <label className="shortcut-enable">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(e) => toggle(item, e.target.checked).catch(() => {})}
              />
              <span />
            </label>
            <div className="shortcut-meta">
              <strong>{item.label}</strong>
              <small>{item.id}</small>
            </div>
            <input
              className={`shortcut-key ${editingId === item.id ? 'recording' : ''}`}
              readOnly
              value={editingId === item.id ? '请按新的快捷键' : item.currentKey}
              onFocus={() => {
                setEditingId(item.id)
                setMessage('')
              }}
              onKeyDown={(e) => {
                e.preventDefault()
                const key = normalizeKey(e)
                updateKey(item, key).catch(() => setMessage('保存失败'))
              }}
            />
            <button
              className="shortcut-reset"
              disabled={item.currentKey === item.defaultKey}
              onClick={() => updateKey(item, item.defaultKey).catch(() => setMessage('保存失败'))}
            >
              默认
            </button>
          </section>
        ))}
      </main>
      {message && <div className="shortcut-message">{message}</div>}
    </div>
  )
}
