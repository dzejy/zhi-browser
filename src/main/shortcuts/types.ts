export type ShortcutScope = 'global' | 'app'

export interface ShortcutItem {
  id: string
  label: string
  category: string
  defaultKey: string
  currentKey: string
  enabled: boolean
  scope: ShortcutScope
}

export interface ShortcutConfig {
  shortcuts: Array<Pick<ShortcutItem, 'id' | 'currentKey' | 'enabled'>>
}
