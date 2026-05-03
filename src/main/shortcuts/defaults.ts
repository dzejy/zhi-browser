import { ShortcutItem } from './types'

export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: 'screenshot:capture', label: '截图', defaultKey: 'Alt+A', currentKey: 'Alt+A', enabled: true },
  { id: 'screenshot:pin', label: '贴图', defaultKey: 'Alt+W', currentKey: 'Alt+W', enabled: true },
  { id: 'screenshot:long', label: '长截图', defaultKey: 'Alt+L', currentKey: 'Alt+L', enabled: true },
  { id: 'command-palette:toggle', label: '命令面板', defaultKey: 'Ctrl+K', currentKey: 'Ctrl+K', enabled: true },
  { id: 'quick-note:toggle', label: '快捷笔记', defaultKey: 'Alt+N', currentKey: 'Alt+N', enabled: true },
  { id: 'tab:hibernate-others', label: '休眠其他标签', defaultKey: 'Alt+H', currentKey: 'Alt+H', enabled: true },
  { id: 'translate:page', label: '翻译当前页', defaultKey: 'Alt+T', currentKey: 'Alt+T', enabled: true },
  { id: 'reader:toggle', label: '阅读模式', defaultKey: 'Alt+R', currentKey: 'Alt+R', enabled: true },
  { id: 'proxy:toggle', label: '代理开关', defaultKey: 'Alt+P', currentKey: 'Alt+P', enabled: true },
  { id: 'darkmode:toggle', label: '暗色模式', defaultKey: 'Alt+D', currentKey: 'Alt+D', enabled: true }
]
