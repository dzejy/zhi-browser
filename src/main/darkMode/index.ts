import { ipcMain, nativeTheme } from 'electron'
import type { IpcMainInvokeEvent, WebContents, WebContentsView } from 'electron'
import type { BrowserSettings } from '../../shared/types'
import { getPreferences, getSettings, updatePreferences } from '../settings'
import { CHROME_BG_COLOR, DARK_BG_COLOR, LIGHT_BG_COLOR } from './constants'
import { DARK_MODE_FORCE_CSS } from './darkCSS'

export { CHROME_BG_COLOR, DARK_BG_COLOR, LIGHT_BG_COLOR } from './constants'

const injectedCSSKeys = new Map<number, string>()
const pendingInjects = new Map<number, Promise<void>>()
const boundWebContents = new WeakSet<WebContents>()

interface RegisterDarkModeHandlersOptions {
  getAllViews: () => WebContentsView[]
  validateSender: (event: IpcMainInvokeEvent) => boolean
  onDarkModeChanged?: (enabled: boolean) => void
  onSettingsChanged?: (settings: BrowserSettings) => void
}

function shouldBeDark(): boolean {
  return getPreferences().webDarkMode
}

function getBackgroundColor(): string {
  return shouldBeDark() ? DARK_BG_COLOR : LIGHT_BG_COLOR
}

function syncNativeTheme(): void {
  nativeTheme.themeSource = shouldBeDark() ? 'dark' : 'system'
}

export function applyViewBackgroundColor(view: WebContentsView): void {
  view.setBackgroundColor(getBackgroundColor())
}

export function getWindowBackgroundColor(): string {
  return shouldBeDark() ? DARK_BG_COLOR : CHROME_BG_COLOR
}

export function bindDarkModeToWebContents(webContents: WebContents): void {
  if (boundWebContents.has(webContents)) return
  boundWebContents.add(webContents)

  webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return
    if (shouldBeDark()) {
      injectDarkMode(webContents)
    } else {
      removeDarkMode(webContents)
    }
  })

  webContents.on('dom-ready', () => {
    if (shouldBeDark()) {
      injectDarkMode(webContents)
    } else {
      removeDarkMode(webContents)
    }
  })

  webContents.on('destroyed', () => {
    cleanupDarkMode(webContents)
  })
}

export async function injectDarkMode(webContents: WebContents): Promise<void> {
  if (webContents.isDestroyed()) return

  const wcId = webContents.id
  const previous = pendingInjects.get(wcId) || Promise.resolve()
  const next = previous
    .catch(() => {
      /* keep the injection queue moving */
    })
    .then(async () => {
      if (webContents.isDestroyed() || !shouldBeDark()) return

      const oldKey = injectedCSSKeys.get(wcId)
      const key = await webContents.insertCSS(DARK_MODE_FORCE_CSS, { cssOrigin: 'user' })
      injectedCSSKeys.set(wcId, key)

      if (oldKey && oldKey !== key) {
        await webContents.removeInsertedCSS(oldKey).catch(() => {
          /* stale keys are common after navigation */
        })
      }
    })
    .catch(() => {
      /* webContents may be navigating or destroyed */
    })
    .finally(() => {
      if (pendingInjects.get(wcId) === next) {
        pendingInjects.delete(wcId)
      }
    })

  pendingInjects.set(wcId, next)
  await next
}

export async function removeDarkMode(webContents: WebContents): Promise<void> {
  const wcId = webContents.id
  const pending = pendingInjects.get(wcId)
  if (pending) {
    await pending.catch(() => {
      /* pending injection may have been interrupted by navigation */
    })
  }

  if (webContents.isDestroyed()) return

  const key = injectedCSSKeys.get(wcId)
  if (!key) return

  await webContents.removeInsertedCSS(key).catch(() => {
    /* stale keys are common after navigation */
  })
  injectedCSSKeys.delete(wcId)
}

export function isDarkModeInjected(webContents: WebContents): boolean {
  return injectedCSSKeys.has(webContents.id) || pendingInjects.has(webContents.id)
}

export function cleanupDarkMode(webContents: WebContents): void {
  injectedCSSKeys.delete(webContents.id)
  pendingInjects.delete(webContents.id)
}

export async function refreshAllTabsDarkMode(getAllViews: () => WebContentsView[]): Promise<void> {
  const dark = shouldBeDark()
  syncNativeTheme()

  for (const view of getAllViews()) {
    view.setBackgroundColor(dark ? DARK_BG_COLOR : LIGHT_BG_COLOR)
    if (dark) {
      await injectDarkMode(view.webContents)
    } else {
      await removeDarkMode(view.webContents)
    }
  }
}

export function registerDarkModeHandlers(options: RegisterDarkModeHandlersOptions): void {
  syncNativeTheme()

  ipcMain.handle('darkMode:toggle', async (event) => {
    if (!options.validateSender(event)) return false

    const newState = !getPreferences().webDarkMode
    updatePreferences({ webDarkMode: newState })
    syncNativeTheme()
    options.onDarkModeChanged?.(newState)
    await refreshAllTabsDarkMode(options.getAllViews)

    const updated = getSettings()
    options.onSettingsChanged?.(updated)
    return newState
  })

  ipcMain.handle('darkMode:get', (event) => {
    if (!options.validateSender(event)) return false
    return getPreferences().webDarkMode
  })
}

export function isDarkMode(): boolean {
  return shouldBeDark()
}
