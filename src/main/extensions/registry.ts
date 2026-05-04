import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import type { RegistryEntry } from './types'

const REGISTRY_PATH = path.join(app.getPath('userData'), 'extension-registry.json')

export class ExtensionRegistry {
  private entries: RegistryEntry[] = []

  constructor() {
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(REGISTRY_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as RegistryEntry[]
        this.entries = Array.isArray(parsed) ? parsed : []
      }
    } catch {
      this.entries = []
    }
  }

  private save(): void {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(this.entries, null, 2), 'utf-8')
  }

  getAll(): RegistryEntry[] {
    return [...this.entries]
  }

  getEnabled(): RegistryEntry[] {
    return this.entries.filter((entry) => entry.enabled)
  }

  add(entry: RegistryEntry): void {
    const index = this.entries.findIndex((item) => item.id === entry.id)
    if (index >= 0) {
      this.entries[index] = entry
    } else {
      this.entries.push(entry)
    }
    this.save()
  }

  remove(id: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== id)
    this.save()
  }

  setEnabled(id: string, enabled: boolean): void {
    const entry = this.entries.find((item) => item.id === id)
    if (!entry) return
    entry.enabled = enabled
    this.save()
  }

  has(id: string): boolean {
    return this.entries.some((entry) => entry.id === id)
  }

  get(id: string): RegistryEntry | undefined {
    return this.entries.find((entry) => entry.id === id)
  }
}
