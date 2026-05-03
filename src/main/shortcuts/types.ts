export interface ShortcutItem {
  id: string
  label: string
  defaultKey: string
  currentKey: string
  enabled: boolean
}

export interface ShortcutConfig {
  shortcuts: ShortcutItem[]
}
