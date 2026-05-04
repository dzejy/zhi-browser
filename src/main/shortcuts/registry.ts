import { app, BrowserWindow, globalShortcut, type Input } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { ShortcutItem, ShortcutConfig } from './types'
import { DEFAULT_SHORTCUTS } from './defaults'
import { matchInputToAccelerator } from './matcher'

const CONFIG_FILE = path.join(app.getPath('userData'), 'shortcuts.json')
let currentShortcuts: ShortcutItem[] = []
const actionHandlers: Map<string, () => void> = new Map()

function broadcastChange(): void {
  const list = getShortcuts()
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try {
      win.webContents.send('shortcuts:changed', list)
    } catch {
      /* renderer not ready */
    }
  }
}

export function loadShortcuts(): ShortcutItem[] {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as ShortcutConfig
      const merged = DEFAULT_SHORTCUTS.map((def) => {
        const saved = data.shortcuts?.find((s) => s.id === def.id)
        return saved
          ? {
              ...def,
              currentKey: typeof saved.currentKey === 'string' ? saved.currentKey : def.currentKey,
              enabled: typeof saved.enabled === 'boolean' ? saved.enabled : def.enabled
            }
          : def
      })
      currentShortcuts = merged
      return merged
    }
  } catch {
    /* fall through to defaults */
  }
  currentShortcuts = DEFAULT_SHORTCUTS.map((s) => ({ ...s }))
  return currentShortcuts
}

export function saveShortcuts(): void {
  try {
    const config: ShortcutConfig = {
      shortcuts: currentShortcuts.map((s) => ({
        id: s.id,
        currentKey: s.currentKey,
        enabled: s.enabled
      }))
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  } catch {
    /* ignore */
  }
}

export function registerAction(id: string, handler: () => void): void {
  actionHandlers.set(id, handler)
}

export function registerAllShortcuts(): void {
  globalShortcut.unregisterAll()
  for (const item of currentShortcuts) {
    if (item.scope !== 'global') continue
    if (!item.enabled || !item.currentKey) continue
    const handler = actionHandlers.get(item.id)
    if (!handler) continue
    try {
      globalShortcut.register(item.currentKey, handler)
    } catch {
      /* invalid accelerator */
    }
  }
}

interface UpdateResult {
  success: boolean
  conflict?: { id: string; label: string }
}

export function updateShortcut(id: string, newKey: string): UpdateResult {
  const trimmed = (newKey || '').trim()
  const conflict = currentShortcuts.find(
    (s) => s.id !== id && s.enabled && s.currentKey && s.currentKey === trimmed
  )
  if (trimmed && conflict) return { success: false, conflict: { id: conflict.id, label: conflict.label } }
  const item = currentShortcuts.find((s) => s.id === id)
  if (!item) return { success: false }
  item.currentKey = trimmed
  saveShortcuts()
  registerAllShortcuts()
  broadcastChange()
  return { success: true }
}

export function toggleShortcut(id: string, enabled: boolean): { success: boolean } {
  const item = currentShortcuts.find((s) => s.id === id)
  if (!item) return { success: false }
  item.enabled = enabled
  saveShortcuts()
  registerAllShortcuts()
  broadcastChange()
  return { success: true }
}

export function resetShortcut(id: string): { success: boolean; item?: ShortcutItem } {
  const item = currentShortcuts.find((s) => s.id === id)
  const def = DEFAULT_SHORTCUTS.find((s) => s.id === id)
  if (!item || !def) return { success: false }
  item.currentKey = def.defaultKey
  item.enabled = true
  saveShortcuts()
  registerAllShortcuts()
  broadcastChange()
  return { success: true, item: { ...item } }
}

export function resetAllShortcuts(): void {
  currentShortcuts = DEFAULT_SHORTCUTS.map((s) => ({ ...s }))
  saveShortcuts()
  registerAllShortcuts()
  broadcastChange()
}

export function getShortcuts(): ShortcutItem[] {
  return currentShortcuts.map((s) => ({ ...s }))
}

export function dispatchAppShortcut(input: Input): boolean {
  if (input.type !== 'keyDown') return false
  for (const item of currentShortcuts) {
    if (item.scope !== 'app' || !item.enabled || !item.currentKey) continue
    if (!matchInputToAccelerator(input, item.currentKey)) continue
    const handler = actionHandlers.get(item.id)
    if (!handler) continue
    try {
      handler()
    } catch (err) {
      console.error('[shortcuts] handler error', item.id, err)
    }
    return true
  }
  return false
}
