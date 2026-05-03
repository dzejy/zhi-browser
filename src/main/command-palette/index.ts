import { BrowserWindow, ipcMain, shell } from 'electron'
import type { BaseWindow, WebContents } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { updatePreferences } from '../settings'
import {
  addCustomCommand,
  getCustomCommands,
  removeCustomCommand
} from './registry'
import { CustomCommand } from './types'

let paletteWindow: BrowserWindow | null = null
let getMainWindow: () => BaseWindow | null = () => null
let getDispatchWebContents: () => WebContents | null = () => null
let openUrlInTab: (url: string) => void = () => {}

export function initCommandPalette(
  getMain: () => BaseWindow | null,
  getDispatch?: () => WebContents | null,
  openUrl?: (url: string) => void
): void {
  getMainWindow = getMain
  if (getDispatch) getDispatchWebContents = getDispatch
  if (openUrl) openUrlInTab = openUrl
}

export function toggleCommandPalette(): void {
  if (paletteWindow && !paletteWindow.isDestroyed()) {
    paletteWindow.close()
    return
  }
  openCommandPalette()
}

function openCommandPalette(): void {
  const main = getMainWindow()
  const bounds = main?.getBounds() ?? { x: 100, y: 100, width: 800, height: 600 }
  const w = 600
  const h = 480
  paletteWindow = new BrowserWindow({
    x: Math.round(bounds.x + bounds.width / 2 - w / 2),
    y: Math.round(bounds.y + bounds.height * 0.15),
    width: w,
    height: h,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  paletteWindow.setMenu(null)
  paletteWindow.on('closed', () => {
    paletteWindow = null
  })
  paletteWindow.on('blur', () => {
    if (paletteWindow && !paletteWindow.isDestroyed()) paletteWindow.close()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    paletteWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/command-palette`)
  } else {
    paletteWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'command-palette'
    })
  }
}

export function registerCommandPaletteHandlers(): void {
  ipcMain.handle('command-palette:toggle', () => {
    toggleCommandPalette()
    return { success: true }
  })
  ipcMain.handle('command-palette:close', () => {
    if (paletteWindow && !paletteWindow.isDestroyed()) paletteWindow.close()
    return { success: true }
  })
  ipcMain.handle('command-palette:get-custom', () => getCustomCommands())
  ipcMain.handle(
    'command-palette:add-custom',
    (_e, cmd: Omit<CustomCommand, 'id' | 'createdAt'>) => addCustomCommand(cmd)
  )
  ipcMain.handle('command-palette:remove-custom', (_e, id: string) => ({
    success: removeCustomCommand(id)
  }))
  ipcMain.handle(
    'command-palette:execute-custom',
    async (_e, cmd: CustomCommand) => {
      const target = getDispatchWebContents()
      if (cmd.type === 'open-url') {
        openUrlInTab(cmd.payload)
      } else if (cmd.type === 'run-js') {
        await target?.executeJavaScript(cmd.payload, true).catch(() => null)
      } else if (cmd.type === 'launch-app') {
        try {
          await shell.openPath(cmd.payload)
        } catch {}
      } else if (cmd.type === 'set-pref') {
        try {
          const patch = JSON.parse(cmd.payload) as Record<string, unknown>
          updatePreferences(patch)
        } catch {}
      }
      if (paletteWindow && !paletteWindow.isDestroyed()) paletteWindow.close()
      return { success: true }
    }
  )
}
