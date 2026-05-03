import { BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { PinImageOptions } from './types'

const pinWindows: Set<BrowserWindow> = new Set()
const pinImageDataByWebContentsId: Map<number, string> = new Map()

export function createPinWindow(options: PinImageOptions): BrowserWindow {
  const win = new BrowserWindow({
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.max(50, Math.round(options.width)),
    height: Math.max(50, Math.round(options.height)),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.setMenu(null)
  pinWindows.add(win)
  // Capture the id up-front; win.webContents is destroyed by the time 'closed' fires.
  const webContentsId = win.webContents.id
  pinImageDataByWebContentsId.set(webContentsId, options.dataUrl)

  win.on('closed', () => {
    pinWindows.delete(win)
    pinImageDataByWebContentsId.delete(webContentsId)
  })

  win.webContents.on('context-menu', () => {
    if (win.isDestroyed()) return
    const menu = Menu.buildFromTemplate([
      {
        label: '关闭贴图',
        click: () => {
          if (!win.isDestroyed()) win.close()
        }
      }
    ])
    menu.popup({ window: win })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/pin-image`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'pin-image' })
  }

  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return
    win.webContents.send('pin-image:data', options.dataUrl)
  })

  return win
}

export function getPinImageData(webContentsId: number): string | null {
  return pinImageDataByWebContentsId.get(webContentsId) ?? null
}

export function closeAllPinWindows(): void {
  for (const w of pinWindows) {
    if (!w.isDestroyed()) w.close()
  }
  pinWindows.clear()
}
