import { globalShortcut, app } from 'electron'
import { ShortcutItem, ShortcutConfig } from './types'
import { DEFAULT_SHORTCUTS } from './defaults'
import * as fs from 'fs'
import * as path from 'path'

const CONFIG_FILE = path.join(app.getPath('userData'), 'shortcuts.json')
let currentShortcuts: ShortcutItem[] = []
const actionHandlers: Map<string, () => void> = new Map()

export function loadShortcuts(): ShortcutItem[] {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as ShortcutConfig
      const merged = DEFAULT_SHORTCUTS.map((def) => {
        const saved = data.shortcuts.find((s) => s.id === def.id)
        return saved ? { ...def, currentKey: saved.currentKey, enabled: saved.enabled } : def
      })
      currentShortcuts = merged
      return merged
    }
  } catch {}
  currentShortcuts = [...DEFAULT_SHORTCUTS]
  return currentShortcuts
}

export function saveShortcuts(): void {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ shortcuts: currentShortcuts }, null, 2),
      'utf-8'
    )
  } catch {}
}

export function registerAction(id: string, handler: () => void): void {
  actionHandlers.set(id, handler)
}

export function registerAllShortcuts(): void {
  globalShortcut.unregisterAll()
  for (const item of currentShortcuts) {
    if (!item.enabled || !item.currentKey) continue
    const handler = actionHandlers.get(item.id)
    if (!handler) continue
    try {
      globalShortcut.register(item.currentKey, handler)
    } catch {}
  }
}

export function updateShortcut(
  id: string,
  newKey: string
): { success: boolean; conflict?: string } {
  const conflict = currentShortcuts.find(
    (s) => s.id !== id && s.currentKey === newKey && s.enabled
  )
  if (conflict) return { success: false, conflict: conflict.label }
  const item = currentShortcuts.find((s) => s.id === id)
  if (item) {
    item.currentKey = newKey
    saveShortcuts()
    registerAllShortcuts()
  }
  return { success: true }
}

export function toggleShortcut(id: string, enabled: boolean): void {
  const item = currentShortcuts.find((s) => s.id === id)
  if (item) {
    item.enabled = enabled
    saveShortcuts()
    registerAllShortcuts()
  }
}

export function getShortcuts(): ShortcutItem[] {
  return currentShortcuts
}
