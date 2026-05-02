import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { UserScript, parseMetadata, generateScriptId } from './metadata-parser'

const SCRIPTS_DIR = path.join(app.getPath('userData'), 'userscripts')
const SCRIPTS_CONFIG = path.join(SCRIPTS_DIR, 'scripts.json')

function ensureDir(): void {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true })
  }
}

function loadConfig(): Record<string, { enabled: boolean; installTime: number; updateTime: number }> {
  ensureDir()
  if (!fs.existsSync(SCRIPTS_CONFIG)) return {}
  try {
    return JSON.parse(fs.readFileSync(SCRIPTS_CONFIG, 'utf-8'))
  } catch {
    return {}
  }
}

function saveConfig(
  config: Record<string, { enabled: boolean; installTime: number; updateTime: number }>
): void {
  ensureDir()
  fs.writeFileSync(SCRIPTS_CONFIG, JSON.stringify(config, null, 2), 'utf-8')
}

export function getAllScripts(): UserScript[] {
  ensureDir()
  const config = loadConfig()
  const scripts: UserScript[] = []

  const files = fs.readdirSync(SCRIPTS_DIR).filter((file) => file.endsWith('.user.js'))
  for (const file of files) {
    try {
      const code = fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf-8')
      const meta = parseMetadata(code)
      const id = file.replace('.user.js', '')
      const cfg = config[id] || { enabled: true, installTime: Date.now(), updateTime: Date.now() }
      scripts.push({
        id,
        meta,
        code,
        enabled: cfg.enabled,
        installTime: cfg.installTime,
        updateTime: cfg.updateTime
      })
    } catch {
      /* skip broken scripts */
    }
  }

  return scripts
}

export function getScript(id: string): UserScript | null {
  const filePath = path.join(SCRIPTS_DIR, `${id}.user.js`)
  if (!fs.existsSync(filePath)) return null
  const code = fs.readFileSync(filePath, 'utf-8')
  const meta = parseMetadata(code)
  const config = loadConfig()
  const cfg = config[id] || { enabled: true, installTime: Date.now(), updateTime: Date.now() }
  return {
    id,
    meta,
    code,
    enabled: cfg.enabled,
    installTime: cfg.installTime,
    updateTime: cfg.updateTime
  }
}

export function installScript(code: string): UserScript {
  ensureDir()
  const meta = parseMetadata(code)
  const id = generateScriptId(meta)
  const filePath = path.join(SCRIPTS_DIR, `${id}.user.js`)

  fs.writeFileSync(filePath, code, 'utf-8')

  const config = loadConfig()
  const now = Date.now()
  config[id] = { enabled: true, installTime: config[id]?.installTime || now, updateTime: now }
  saveConfig(config)

  return { id, meta, code, enabled: true, installTime: config[id].installTime, updateTime: now }
}

export function removeScript(id: string): void {
  const filePath = path.join(SCRIPTS_DIR, `${id}.user.js`)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  const config = loadConfig()
  delete config[id]
  saveConfig(config)
}

export function toggleScript(id: string, enabled: boolean): void {
  const config = loadConfig()
  if (config[id]) {
    config[id].enabled = enabled
  } else {
    config[id] = { enabled, installTime: Date.now(), updateTime: Date.now() }
  }
  saveConfig(config)
}

export function getScriptStorage(scriptId: string): Record<string, unknown> {
  ensureDir()
  const storagePath = path.join(SCRIPTS_DIR, `${scriptId}.storage.json`)
  if (!fs.existsSync(storagePath)) return {}
  try {
    return JSON.parse(fs.readFileSync(storagePath, 'utf-8'))
  } catch {
    return {}
  }
}

export function setScriptStorage(scriptId: string, key: string, value: unknown): void {
  ensureDir()
  const storagePath = path.join(SCRIPTS_DIR, `${scriptId}.storage.json`)
  const storage = getScriptStorage(scriptId)
  storage[key] = value
  fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2), 'utf-8')
}

export function deleteScriptStorage(scriptId: string, key: string): void {
  ensureDir()
  const storagePath = path.join(SCRIPTS_DIR, `${scriptId}.storage.json`)
  const storage = getScriptStorage(scriptId)
  delete storage[key]
  fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2), 'utf-8')
}

export function listScriptStorageKeys(scriptId: string): string[] {
  return Object.keys(getScriptStorage(scriptId))
}
