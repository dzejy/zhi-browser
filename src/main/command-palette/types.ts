export interface CommandItem {
  id: string
  label: string
  category: string
  icon?: string
  shortcut?: string
  action: () => void | Promise<void>
}

export interface CustomCommand {
  id: string
  label: string
  type: 'open-url' | 'run-js' | 'set-pref' | 'launch-app'
  payload: string
  createdAt: number
}

export interface CommandPaletteWindowMessage {
  type: 'execute' | 'close' | 'navigate' | 'switchTab' | 'newTab'
  payload?: unknown
}
