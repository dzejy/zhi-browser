import { useEffect, useRef, useState } from 'react'
import './styles.css'

interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

export default function QuickNote(): React.JSX.Element {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api
      .quickNoteGetAll()
      .then((all) => {
        setNotes(all)
        if (all.length > 0) setActiveId(all[0].id)
      })
      .catch(() => {})
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.api.quickNoteClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const active = notes.find((n) => n.id === activeId)

  const debouncedSave = (note: Note): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      window.api
        .quickNoteSave({ id: note.id, title: note.title, content: note.content })
        .catch(() => {})
    }, 500)
  }

  const updateActive = (patch: Partial<Note>): void => {
    if (!active) return
    const next = { ...active, ...patch, updatedAt: Date.now() }
    setNotes((prev) => prev.map((n) => (n.id === next.id ? next : n)))
    debouncedSave(next)
  }

  const handleAdd = async (): Promise<void> => {
    const newNote = await window.api.quickNoteCreate()
    setNotes((prev) => [...prev, newNote])
    setActiveId(newNote.id)
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (notes.length <= 1) return
    await window.api.quickNoteDelete(id)
    const remaining = notes.filter((n) => n.id !== id)
    setNotes(remaining)
    if (activeId === id) setActiveId(remaining[0]?.id ?? '')
  }

  const formatTime = (ts: number): string => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return ''
    }
  }

  return (
    <div className="qn-root">
      <div className="qn-header">
        <div className="qn-tabs">
          {notes.map((n) => (
            <button
              key={n.id}
              className={`qn-tab ${activeId === n.id ? 'active' : ''}`}
              onClick={() => setActiveId(n.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (notes.length > 1 && confirm(`删除「${n.title}」？`)) handleDelete(n.id)
              }}
              title={n.title}
            >
              {n.title || '未命名'}
            </button>
          ))}
        </div>
        <div className="qn-actions">
          <button className="qn-btn" onClick={handleAdd} title="新建笔记">
            ＋
          </button>
          <button
            className="qn-btn"
            onClick={() => window.api.quickNoteClose()}
            title="关闭"
          >
            ✕
          </button>
        </div>
      </div>
      {active && (
        <>
          <input
            className="qn-title-input"
            value={active.title}
            placeholder="标题"
            onChange={(e) => updateActive({ title: e.target.value })}
          />
          <textarea
            className="qn-content"
            value={active.content}
            placeholder="开始记录…"
            onChange={(e) => updateActive({ content: e.target.value })}
          />
          <div className="qn-footer">
            <span>{active.content.length} 字</span>
            <span>{formatTime(active.updatedAt)}</span>
          </div>
        </>
      )}
    </div>
  )
}
