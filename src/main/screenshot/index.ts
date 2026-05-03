import {
  app,
  BrowserWindow,
  ipcMain,
  clipboard,
  nativeImage,
  dialog,
  screen
} from 'electron'
import { join } from 'path'
import * as path from 'path'
import * as fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { captureFullScreen } from './capture'
import { captureLongPage } from './longCapture'
import type { LongCaptureSlice } from './longCapture'
import type { ScreenshotData } from './types'
import { createPinWindow, getPinImageData } from './pinWindow'

let captureWindow: BrowserWindow | null = null
let getActiveWebContentsRef: (() => Electron.WebContents | null) | null = null
let latestScreenshotSource: ScreenshotData | null = null

async function stitchLongCaptureSlices(slices: LongCaptureSlice[]): Promise<string> {
  if (slices.length === 0) throw new Error('no-slices')

  const stitchWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      sandbox: false,
      contextIsolation: true
    }
  })

  try {
    await stitchWindow.loadURL('data:text/html,<html><body></body></html>')
    const script = `
      (async () => {
        const slices = ${JSON.stringify(slices)}
        const images = await Promise.all(slices.map((slice) => new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = slice.dataUrl
        })))
        const width = Math.max(...images.map((img) => img.naturalWidth || img.width))
        const height = images.reduce((sum, img) => sum + (img.naturalHeight || img.height), 0)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        let y = 0
        images.forEach((img) => {
          const h = img.naturalHeight || img.height
          ctx.drawImage(img, 0, y)
          y += h
        })
        return canvas.toDataURL('image/png')
      })()
    `
    return await stitchWindow.webContents.executeJavaScript(script, true)
  } finally {
    if (!stitchWindow.isDestroyed()) stitchWindow.close()
  }
}

export async function captureLongScreenshotToClipboard(
  wc: Electron.WebContents | null
): Promise<{ success: boolean; error?: string; slices?: LongCaptureSlice[]; dataUrl?: string }> {
  if (!wc) return { success: false, error: 'no-active-tab' }
  try {
    const slices = await captureLongPage(wc)
    const dataUrl = await stitchLongCaptureSlices(slices)
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl))
    return { success: true, slices, dataUrl }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function openScreenshotWindow(): Promise<void> {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.focus()
    return
  }

  const data = await captureFullScreen(getActiveWebContentsRef?.() ?? null)
  if (!data) return
  latestScreenshotSource = data

  const display = screen.getPrimaryDisplay()
  const { x, y, width, height } = display.bounds

  captureWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  captureWindow.setMenu(null)
  captureWindow.setAlwaysOnTop(true, 'screen-saver')

  captureWindow.on('closed', () => {
    captureWindow = null
    latestScreenshotSource = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    captureWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/screenshot`)
  } else {
    captureWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'screenshot'
    })
  }

  captureWindow.webContents.once('did-finish-load', () => {
    if (!captureWindow || captureWindow.isDestroyed()) return
    captureWindow.webContents.send('screenshot:source', data)
  })
}

export function registerScreenshotHandlers(
  getActiveWebContents: () => Electron.WebContents | null
): void {
  getActiveWebContentsRef = getActiveWebContents

  ipcMain.handle('screenshot:open', async () => {
    await openScreenshotWindow()
    return { success: true }
  })

  ipcMain.handle('screenshot:get-source', () => latestScreenshotSource)

  ipcMain.handle(
    'screenshot:complete',
    (_e, payload: { action: 'copy' | 'save' | 'pin'; dataUrl: string; rect?: { x: number; y: number; width: number; height: number } }) => {
      const { action, dataUrl, rect } = payload
      const image = nativeImage.createFromDataURL(dataUrl)
      if (action === 'copy') {
        clipboard.writeImage(image)
      } else if (action === 'save') {
        const fp = dialog.showSaveDialogSync({
          title: '保存截图',
          defaultPath: path.join(
            app.getPath('pictures'),
            `screenshot-${Date.now()}.png`
          ),
          filters: [{ name: 'PNG', extensions: ['png'] }]
        })
        if (fp) {
          try {
            fs.writeFileSync(fp, image.toPNG())
          } catch {}
        }
      } else if (action === 'pin' && rect) {
        createPinWindow({
          dataUrl,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        })
      }
      if (captureWindow && !captureWindow.isDestroyed()) {
        captureWindow.close()
      }
      return { success: true }
    }
  )

  ipcMain.handle('screenshot:cancel', () => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.close()
    }
    return { success: true }
  })

  ipcMain.handle('screenshot:long-capture', async () => {
    const wc = getActiveWebContents()
    return captureLongScreenshotToClipboard(wc)
  })

  ipcMain.handle('pin-image:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && !win.isDestroyed()) win.close()
    return { success: true }
  })

  ipcMain.handle('pin-image:get-data', (e) => getPinImageData(e.sender.id))
}
