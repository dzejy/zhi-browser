// src/main/storage.ts
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

let storageDir = ''

function getStorageDir(): string {
  if (!storageDir) {
    const userDataPath = app.getPath('userData')
    storageDir = join(userDataPath, 'browser-data')
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true })
    }
  }
  return storageDir
}

export function readJSON<T>(filename: string, fallback: T): T {
  try {
    const filepath = join(getStorageDir(), filename)
    if (!existsSync(filepath)) return fallback
    const raw = readFileSync(filepath, 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed as T
  } catch {
    return fallback
  }
}

export function writeJSON(filename: string, data: unknown): void {
  try {
    const filepath = join(getStorageDir(), filename)
    writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
  } catch {
    // Silent fail
  }
}
