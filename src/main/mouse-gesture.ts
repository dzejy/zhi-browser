import { ipcMain } from 'electron'

export interface GestureAction {
  pattern: string
  action: string
  label: string
}

export const DEFAULT_GESTURES: GestureAction[] = [
  { pattern: 'L', action: 'goBack', label: '后退' },
  { pattern: 'R', action: 'goForward', label: '前进' },
  { pattern: 'D', action: 'newTab', label: '新建标签页' },
  { pattern: 'U', action: 'scrollTop', label: '回到顶部' },
  { pattern: 'DR', action: 'closeTab', label: '关闭标签页' },
  { pattern: 'UD', action: 'refresh', label: '刷新页面' },
  { pattern: 'DU', action: 'stopLoad', label: '停止加载' },
  { pattern: 'LR', action: 'reopenTab', label: '恢复关闭的标签' },
  { pattern: 'RD', action: 'scrollBottom', label: '到底部' }
]

export function registerMouseGestureHandlers(
  executeAction: (action: string, webContentsId: number) => void
): void {
  ipcMain.handle('gesture:execute', async (_event, pattern: string, webContentsId: number) => {
    const matched = DEFAULT_GESTURES.find((gesture) => gesture.pattern === pattern)
    if (matched) {
      executeAction(matched.action, webContentsId)
      return true
    }
    return false
  })

  ipcMain.handle('gesture:getConfig', async () => {
    return DEFAULT_GESTURES
  })
}
