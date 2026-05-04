import fs from 'fs'
import path from 'path'
import { session } from 'electron'
import { ExtensionInstaller } from './installer'
import { ExtensionRegistry } from './registry'
import { registerExtensionIpcHandlers } from './ipc-handlers'
import type { ElectronExtension, ExtensionInfo, RegistryEntry } from './types'

export class ExtensionSystem {
  private registry: ExtensionRegistry
  private installer: ExtensionInstaller
  private ses: Electron.Session

  constructor() {
    this.registry = new ExtensionRegistry()
    this.installer = new ExtensionInstaller()
    this.ses = session.defaultSession
  }

  async initialize(): Promise<void> {
    this.ses.extensions.on('extension-loaded', (_event, extension) => {
      console.log(`[Extensions] Loaded: ${extension.name} (${extension.id})`)
    })

    this.ses.extensions.on('extension-unloaded', (_event, extension) => {
      console.log(`[Extensions] Unloaded: ${extension.name} (${extension.id})`)
    })

    await this.loadRegisteredExtensions()
    registerExtensionIpcHandlers(this)

    console.log(
      `[Extensions] System initialized. ${this.ses.extensions.getAllExtensions().length} extensions loaded.`
    )
  }

  async installFromLocal(dirPath: string): Promise<ExtensionInfo> {
    const extensionPath = this.installer.getLocalExtensionPath(dirPath)
    const ext = (await this.ses.extensions.loadExtension(extensionPath, {
      allowFileAccess: true
    })) as ElectronExtension

    this.registry.add({
      id: ext.id,
      path: extensionPath,
      enabled: true,
      installedAt: Date.now(),
      source: 'local'
    })

    return this.toExtensionInfo(ext)
  }

  async installFromWebStore(urlOrId: string): Promise<ExtensionInfo> {
    const extensionId = this.installer.parseWebStoreUrl(urlOrId)
    if (!extensionId) {
      throw new Error('无效的 Chrome Web Store URL 或扩展 ID')
    }

    const crxPath = await this.installer.downloadCrx(extensionId)
    const unpackedPath = await this.installer.unpackCrx(crxPath, extensionId)
    const ext = (await this.ses.extensions.loadExtension(unpackedPath, {
      allowFileAccess: true
    })) as ElectronExtension

    this.registry.add({
      id: ext.id,
      path: unpackedPath,
      enabled: true,
      installedAt: Date.now(),
      source: 'webstore'
    })

    return this.toExtensionInfo(ext)
  }

  uninstall(extensionId: string): void {
    this.removeLoadedExtension(extensionId)
    this.registry.remove(extensionId)
  }

  async enable(extensionId: string): Promise<void> {
    const entry = this.registry.get(extensionId)
    if (!entry) throw new Error('扩展不在注册表中')

    if (!this.isLoaded(extensionId)) {
      const ext = (await this.ses.extensions.loadExtension(entry.path, {
        allowFileAccess: true
      })) as ElectronExtension
      if (ext.id !== entry.id) {
        this.registry.remove(entry.id)
        this.registry.add({ ...entry, id: ext.id, enabled: true })
        return
      }
    }
    this.registry.setEnabled(extensionId, true)
  }

  disable(extensionId: string): void {
    this.removeLoadedExtension(extensionId)
    this.registry.setEnabled(extensionId, false)
  }

  async reload(extensionId: string): Promise<void> {
    const entry = this.registry.get(extensionId)
    if (!entry) throw new Error('扩展不在注册表中')

    this.removeLoadedExtension(extensionId)
    if (entry.enabled) {
      await this.ses.extensions.loadExtension(entry.path, { allowFileAccess: true })
    }
  }

  getAllInfo(): ExtensionInfo[] {
    const loaded = this.ses.extensions.getAllExtensions() as ElectronExtension[]
    const entries = this.registry.getAll()
    const infos: ExtensionInfo[] = []

    for (const ext of loaded) {
      const entry = entries.find((item) => item.id === ext.id)
      infos.push(this.toExtensionInfo(ext, entry))
    }

    for (const entry of entries) {
      if (!entry.enabled && !infos.some((info) => info.id === entry.id)) {
        infos.push(this.toDisabledInfo(entry))
      }
    }

    return infos.sort((a, b) => b.installedAt - a.installedAt)
  }

  destroy(): void {
    // Electron owns the loaded extension lifecycle for this session.
  }

  private async loadRegisteredExtensions(): Promise<void> {
    const entries = this.registry.getEnabled()

    for (const entry of entries) {
      try {
        if (!fs.existsSync(entry.path)) {
          console.warn(`[Extensions] Missing path: ${entry.path}`)
          continue
        }
        const ext = (await this.ses.extensions.loadExtension(entry.path, {
          allowFileAccess: true
        })) as ElectronExtension
        if (ext.id !== entry.id) {
          this.registry.remove(entry.id)
          this.registry.add({ ...entry, id: ext.id })
        }
      } catch (error) {
        console.error(`[Extensions] Failed to load ${entry.path}:`, error)
      }
    }
  }

  private toExtensionInfo(ext: ElectronExtension, entry?: RegistryEntry): ExtensionInfo {
    const manifest = ext.manifest || {}
    return {
      id: ext.id,
      name: ext.name || manifest.name || '未知扩展',
      version: ext.version || manifest.version || '0.0.0',
      description: manifest.description || '',
      enabled: true,
      path: ext.path,
      url: ext.url,
      icons: manifest.icons || {},
      hasPopup: Boolean(manifest.action?.default_popup || manifest.browser_action?.default_popup),
      hasOptions: Boolean(manifest.options_ui?.page || manifest.options_page),
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      hostPermissions: Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [],
      installedAt: entry?.installedAt || Date.now(),
      source: entry?.source || 'local'
    }
  }

  private toDisabledInfo(entry: RegistryEntry): ExtensionInfo {
    let manifest: Record<string, any> = {}
    try {
      const raw = fs.readFileSync(path.join(entry.path, 'manifest.json'), 'utf-8')
      manifest = JSON.parse(raw)
    } catch {
      manifest = {}
    }

    return {
      id: entry.id,
      name: manifest.name || '未知扩展',
      version: manifest.version || '0.0.0',
      description: manifest.description || '',
      enabled: false,
      path: entry.path,
      url: `chrome-extension://${entry.id}/`,
      icons: manifest.icons || {},
      hasPopup: Boolean(manifest.action?.default_popup || manifest.browser_action?.default_popup),
      hasOptions: Boolean(manifest.options_ui?.page || manifest.options_page),
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      hostPermissions: Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [],
      installedAt: entry.installedAt,
      source: entry.source
    }
  }

  private isLoaded(extensionId: string): boolean {
    return this.ses.extensions.getAllExtensions().some((extension) => extension.id === extensionId)
  }

  private removeLoadedExtension(extensionId: string): void {
    if (!this.isLoaded(extensionId)) return
    try {
      this.ses.extensions.removeExtension(extensionId)
    } catch (error) {
      console.warn(`[Extensions] Failed to remove ${extensionId}:`, error)
    }
  }
}

let instance: ExtensionSystem | null = null

export function getExtensionSystem(): ExtensionSystem {
  if (!instance) instance = new ExtensionSystem()
  return instance
}
