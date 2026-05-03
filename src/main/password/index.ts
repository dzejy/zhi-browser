import { ipcMain, WebContents } from 'electron'
import {
  getAllPasswords,
  getPassword,
  addPassword,
  updatePassword
} from '../passwords/store'
import { PASSWORD_DETECTOR_SCRIPT } from './detector'
import { performAutofill } from './autofill'

interface PendingFill {
  wc: WebContents
}

const pendingFills: Map<number, PendingFill> = new Map()
let sendPromptToUi: (channel: string, payload: unknown) => void = () => {}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function findEntriesForUrl(url: string): Array<{ id: string; username: string }> {
  const host = getHostname(url)
  const all = getAllPasswords()
  return all
    .filter((e) => getHostname(e.url) === host)
    .map((e) => ({ id: e.id, username: e.username }))
}

export function bindPasswordDetection(wc: WebContents): void {
  const inject = (): void => {
    wc.executeJavaScript(PASSWORD_DETECTOR_SCRIPT, true).catch(() => {})
  }
  wc.on('did-finish-load', inject)
  wc.on('did-frame-finish-load', (_e, isMainFrame) => {
    if (isMainFrame) inject()
  })
  pendingFills.set(wc.id, { wc })
  wc.on('destroyed', () => {
    pendingFills.delete(wc.id)
  })
}

export function registerPasswordHandlers(
  sendPrompt?: (channel: string, payload: unknown) => void
): void {
  if (sendPrompt) sendPromptToUi = sendPrompt
  ipcMain.handle('password:auto-check', (_e, url: string) => findEntriesForUrl(url))

  ipcMain.handle(
    'password:auto-save',
    (
      _e,
      data: { url: string; username: string; password: string; title: string }
    ) => {
      const host = getHostname(data.url)
      const all = getAllPasswords()
      const existing = all.find(
        (entry) => getHostname(entry.url) === host && entry.username === data.username
      )
      if (existing) {
        const oldPlain = getPassword(existing.id)
        if (oldPlain === data.password) return { success: true }
        updatePassword(existing.id, { password: data.password })
        return { success: true }
      }
      addPassword(data)
      return { success: true }
    }
  )

  ipcMain.handle('password:auto-fill', async (e, id: string, webContentsId?: number) => {
    const all = getAllPasswords()
    const entry = all.find((item) => item.id === id)
    if (!entry) return { success: false }
    const plain = getPassword(id)
    if (!plain) return { success: false }
    const target = typeof webContentsId === 'number'
      ? pendingFills.get(webContentsId)?.wc
      : e.sender
    if (!target || target.isDestroyed()) return { success: false }
    const ok = await performAutofill(target, entry.username, plain)
    return ok
      ? { success: true, username: entry.username }
      : { success: false }
  })

  ipcMain.on(
    'password:detect',
    (
      _e,
      data: { url: string; username: string; password: string; title: string }
    ) => {
      const host = getHostname(data.url)
      const all = getAllPasswords()
      const existing = all.find(
        (entry) => getHostname(entry.url) === host && entry.username === data.username
      )
      const sameAsSaved =
        existing && (() => {
          try {
            return getPassword(existing.id) === data.password
          } catch {
            return false
          }
        })()
      if (sameAsSaved) return
      sendPromptToUi('password:save-prompt', {
        url: data.url,
        username: data.username,
        password: data.password,
        existing: !!existing
      })
    }
  )

  ipcMain.on('password:check-autofill', (_e, url: string) => {
    const matches = findEntriesForUrl(url)
    if (matches.length === 0) return
    sendPromptToUi('password:fill-prompt', {
      url,
      webContentsId: _e.sender.id,
      entries: matches
    })
  })
}
