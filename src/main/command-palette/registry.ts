import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { CustomCommand } from './types'

const FILE = path.join(app.getPath('userData'), 'custom-commands.json')

let cache: CustomCommand[] = []
let loaded = false

export function loadCustomCommands(): CustomCommand[] {
  if (loaded) return cache
  try {
    if (fs.existsSync(FILE)) {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as CustomCommand[]
    }
  } catch {
    cache = []
  }
  loaded = true
  return cache
}

export function saveCustomCommands(): void {
  try {
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2), 'utf-8')
  } catch {}
}

export function addCustomCommand(cmd: Omit<CustomCommand, 'id' | 'createdAt'>): CustomCommand {
  loadCustomCommands()
  const item: CustomCommand = {
    ...cmd,
    id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now()
  }
  cache.push(item)
  saveCustomCommands()
  return item
}

export function removeCustomCommand(id: string): boolean {
  loadCustomCommands()
  const before = cache.length
  cache = cache.filter((c) => c.id !== id)
  if (cache.length !== before) {
    saveCustomCommands()
    return true
  }
  return false
}

export function getCustomCommands(): CustomCommand[] {
  return loadCustomCommands()
}
