import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  loadShortcuts,
  registerAllShortcuts,
  registerAction,
  updateShortcut,
  toggleShortcut,
  getShortcuts
} from './registry'

let shortcutWindow: BrowserWindow | null = null

export function initShortcuts(): void {
  loadShortcuts()
}

export function startShortcuts(): void {
  registerAllShortcuts()
}

export function openShortcutSettingsWindow(): void {
  if (shortcutWindow && !shortcutWindow.isDestroyed()) {
    shortcutWindow.focus()
    return
  }

  shortcutWindow = new BrowserWindow({
    width: 620,
    height: 520,
    minWidth: 520,
    minHeight: 420,
    title: '快捷键设置',
    backgroundColor: '#15161d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  shortcutWindow.on('closed', () => {
    shortcutWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    shortcutWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/shortcuts`)
  } else {
    shortcutWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'shortcuts' })
  }
}

export function registerShortcutHandlers(): void {
  ipcMain.handle('shortcuts:getAll', () => getShortcuts())
  ipcMain.handle('shortcuts:update', (_e, id: string, newKey: string) =>
    updateShortcut(id, newKey)
  )
  ipcMain.handle('shortcuts:toggle', (_e, id: string, enabled: boolean) => {
    toggleShortcut(id, enabled)
    return { success: true }
  })
  ipcMain.handle('shortcuts:open-settings', () => {
    openShortcutSettingsWindow()
    return { success: true }
  })
  ipcMain.handle('shortcuts:close-settings', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.close()
    return { success: true }
  })
}

export { registerAction }
