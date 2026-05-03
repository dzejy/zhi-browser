import { BrowserWindow, ipcMain, screen } from 'electron'
import type { BaseWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  getAllNotes,
  upsertNote,
  createNote,
  deleteNote
} from './storage'

let noteWindow: BrowserWindow | null = null
let getMainWindow: () => BaseWindow | null = () => null

export function initQuickNote(getMain: () => BaseWindow | null): void {
  getMainWindow = getMain
}

export function toggleQuickNote(): void {
  if (noteWindow && !noteWindow.isDestroyed()) {
    noteWindow.close()
    return
  }
  openQuickNoteWindow()
}

function openQuickNoteWindow(): void {
  const main = getMainWindow()
  const display = main
    ? screen.getDisplayMatching(main.getBounds())
    : screen.getPrimaryDisplay()
  const { x, y, width, height } = display.workArea
  const w = 360
  const h = 320
  noteWindow = new BrowserWindow({
    x: x + width - w - 24,
    y: y + height - h - 24,
    width: w,
    height: h,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 280,
    minHeight: 220,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  noteWindow.setMenu(null)
  noteWindow.on('closed', () => {
    noteWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    noteWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/quick-note`)
  } else {
    noteWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'quick-note' })
  }
}

export function registerQuickNoteHandlers(): void {
  ipcMain.handle('quick-note:toggle', () => {
    toggleQuickNote()
    return { success: true }
  })
  ipcMain.handle('quick-note:close', () => {
    if (noteWindow && !noteWindow.isDestroyed()) noteWindow.close()
    return { success: true }
  })
  ipcMain.handle('quick-note:get-all', () => getAllNotes())
  ipcMain.handle(
    'quick-note:save',
    (_e, note: { id: string; title: string; content: string }) => {
      upsertNote(note)
      return { success: true }
    }
  )
  ipcMain.handle('quick-note:create', () => createNote())
  ipcMain.handle('quick-note:delete', (_e, id: string) => ({
    success: deleteNote(id)
  }))
}
