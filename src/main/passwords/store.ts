import { safeStorage } from 'electron'
import { readJSON, writeJSON } from '../storage'
import type { PasswordEntry } from './types'

const PASSWORDS_FILE = 'passwords.json'

let entries: PasswordEntry[] = []
let loaded = false

type PublicPasswordEntry = Omit<PasswordEntry, 'encryptedPassword'>

function load(): void {
  if (loaded) return
  entries = readJSON<PasswordEntry[]>(PASSWORDS_FILE, [])
  loaded = true
}

function save(): void {
  writeJSON(PASSWORDS_FILE, entries)
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function toPublicEntry(entry: PasswordEntry): PublicPasswordEntry {
  return {
    id: entry.id,
    url: entry.url,
    username: entry.username,
    title: entry.title,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  }
}

export function encryptPassword(plain: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(plain).toString('base64')
  }
  const encrypted = safeStorage.encryptString(plain)
  return encrypted.toString('base64')
}

export function decryptPassword(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  }
  const buffer = Buffer.from(encrypted, 'base64')
  return safeStorage.decryptString(buffer)
}

export function getAllPasswords(): PublicPasswordEntry[] {
  load()
  return entries.map(toPublicEntry)
}

export function getPassword(id: string): string | null {
  load()
  const entry = entries.find((item) => item.id === id)
  if (!entry) return null
  return decryptPassword(entry.encryptedPassword)
}

export function addPassword(data: {
  url: string
  username: string
  password: string
  title: string
}): string {
  load()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const url = data.url.trim()
  const entry: PasswordEntry = {
    id,
    url,
    username: data.username.trim(),
    encryptedPassword: encryptPassword(data.password),
    title: data.title.trim() || getHostname(url),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  entries.unshift(entry)
  save()
  return id
}

export function updatePassword(
  id: string,
  data: Partial<{ url: string; username: string; password: string; title: string }>
): boolean {
  load()
  const index = entries.findIndex((item) => item.id === id)
  if (index === -1) return false

  if (typeof data.url === 'string' && data.url.trim()) entries[index].url = data.url.trim()
  if (typeof data.username === 'string') entries[index].username = data.username.trim()
  if (typeof data.title === 'string') entries[index].title = data.title.trim()
  if (typeof data.password === 'string' && data.password) {
    entries[index].encryptedPassword = encryptPassword(data.password)
  }
  entries[index].updatedAt = Date.now()

  save()
  return true
}

export function deletePassword(id: string): boolean {
  load()
  const before = entries.length
  entries = entries.filter((item) => item.id !== id)
  if (entries.length < before) {
    save()
    return true
  }
  return false
}

export function searchPasswords(keyword: string): PublicPasswordEntry[] {
  load()
  const lower = keyword.toLowerCase()
  return entries
    .filter(
      (item) =>
        item.url.toLowerCase().includes(lower) ||
        item.username.toLowerCase().includes(lower) ||
        item.title.toLowerCase().includes(lower)
    )
    .map(toPublicEntry)
}
