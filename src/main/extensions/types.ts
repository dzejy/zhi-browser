export interface ElectronExtension {
  id: string
  name: string
  version: string
  path: string
  url: string
  manifest: Record<string, any>
}

export interface RegistryEntry {
  id: string
  path: string
  enabled: boolean
  installedAt: number
  source: 'local' | 'crx' | 'webstore'
}

export interface ExtensionInfo {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  path: string
  url: string
  icons: Record<string, string>
  hasPopup: boolean
  hasOptions: boolean
  permissions: string[]
  hostPermissions: string[]
  installedAt: number
  source: 'local' | 'crx' | 'webstore'
}
