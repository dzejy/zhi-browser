import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface QuickNote {
  id: string
  title: string
  content: string
  updatedAt: number
}

const FILE = path.join(app.getPath('userData'), 'quick-notes.json')

let cache: QuickNote[] | null = null

export function loadNotes(): QuickNote[] {
  if (cache) return cache
  try {
    if (fs.existsSync(FILE)) {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as QuickNote[]
      return cache
    }
  } catch {}
  cache = [
    {
      id: 'default',
      title: '笔记',
      content: '',
      updatedAt: Date.now()
    }
  ]
  return cache
}

export function saveNotes(): void {
  if (!cache) return
  try {
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2), 'utf-8')
  } catch {}
}

export function getAllNotes(): QuickNote[] {
  return loadNotes()
}

export function upsertNote(note: { id: string; title: string; content: string }): QuickNote {
  const notes = loadNotes()
  const idx = notes.findIndex((n) => n.id === note.id)
  const updated: QuickNote = { ...note, updatedAt: Date.now() }
  if (idx === -1) {
    notes.push(updated)
  } else {
    notes[idx] = updated
  }
  saveNotes()
  return updated
}

export function createNote(): QuickNote {
  const note: QuickNote = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: '新笔记',
    content: '',
    updatedAt: Date.now()
  }
  loadNotes().push(note)
  saveNotes()
  return note
}

export function deleteNote(id: string): boolean {
  const notes = loadNotes()
  const before = notes.length
  cache = notes.filter((n) => n.id !== id)
  if (cache.length === 0) {
    cache.push({
      id: 'default',
      title: '笔记',
      content: '',
      updatedAt: Date.now()
    })
  }
  if (cache.length !== before) {
    saveNotes()
    return true
  }
  return false
}
