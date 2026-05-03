import { ipcMain, nativeTheme } from 'electron'
import type { IpcMainInvokeEvent, WebContents, WebContentsView } from 'electron'
import type { BrowserSettings } from '../../shared/types'
import { getPreferences, getSettings, updatePreferences } from '../settings'
import { CHROME_BG_COLOR, DARK_BG_COLOR, LIGHT_BG_COLOR } from './constants'
import { DARK_MODE_FORCE_CSS, DARK_MODE_INSTANT_CSS } from './darkCSS'

export { CHROME_BG_COLOR, DARK_BG_COLOR, LIGHT_BG_COLOR } from './constants'

const injectedCSSKeys = new Map<number, string>()
const pendingInjects = new Map<number, Promise<void>>()
const boundWebContents = new WeakSet<WebContents>()

// Pages whose own background luminance falls below this threshold are treated as
// already-dark and left alone (we drop our own injection to avoid double-styling).
const SITE_DARK_LUMINANCE_THRESHOLD = 0.3

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

  // Pre-paint backstop: light CSS that just darkens html/body so the white frame
  // Chromium briefly shows during navigation is masked. Real styling waits for dom-ready.
  webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return
    if (shouldBeDark()) {
      injectInstantDarkMode(webContents)
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

async function replaceInjectedCSS(webContents: WebContents, css: string): Promise<void> {
  if (webContents.isDestroyed()) return
  const wcId = webContents.id
  const oldKey = injectedCSSKeys.get(wcId)
  const key = await webContents.insertCSS(css, { cssOrigin: 'user' })
  injectedCSSKeys.set(wcId, key)
  if (oldKey && oldKey !== key) {
    await webContents.removeInsertedCSS(oldKey).catch(() => {
      /* stale keys are common after navigation */
    })
  }
}

async function dropInjectedCSS(webContents: WebContents): Promise<void> {
  if (webContents.isDestroyed()) return
  const wcId = webContents.id
  const key = injectedCSSKeys.get(wcId)
  if (!key) return
  injectedCSSKeys.delete(wcId)
  await webContents.removeInsertedCSS(key).catch(() => {
    /* stale keys are common after navigation */
  })
}

// Returns true if the page's own background is already dark and we should leave
// it alone. Returns false on detection failure so we still inject the safety net.
async function isSiteAlreadyDark(webContents: WebContents): Promise<boolean> {
  if (webContents.isDestroyed()) return false
  try {
    const result = (await webContents.executeJavaScript(
      `(() => {
        const parse = (s) => {
          if (!s || s === 'rgba(0, 0, 0, 0)' || s === 'transparent') return null
          const m = s.match(/\\d+(?:\\.\\d+)?/g)
          if (!m || m.length < 3) return null
          const [r, g, b] = m.map(Number)
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255
        }
        const bodyLum = document.body ? parse(getComputedStyle(document.body).backgroundColor) : null
        const htmlLum = parse(getComputedStyle(document.documentElement).backgroundColor)
        const lum = bodyLum !== null ? bodyLum : htmlLum
        return lum
      })()`,
      true
    )) as number | null
    return typeof result === 'number' && result < SITE_DARK_LUMINANCE_THRESHOLD
  } catch {
    return false
  }
}

function enqueueInjection(webContents: WebContents, task: () => Promise<void>): Promise<void> {
  const wcId = webContents.id
  const previous = pendingInjects.get(wcId) || Promise.resolve()
  const next = previous
    .catch(() => {
      /* keep the queue moving */
    })
    .then(async () => {
      if (webContents.isDestroyed() || !shouldBeDark()) return
      await task()
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
  return next
}

// Pre-paint pass: only used between did-start-navigation and dom-ready. It just
// puts up a dark backdrop so the Chromium navigation flash isn't white.
export async function injectInstantDarkMode(webContents: WebContents): Promise<void> {
  if (webContents.isDestroyed()) return
  await enqueueInjection(webContents, async () => {
    await replaceInjectedCSS(webContents, DARK_MODE_INSTANT_CSS)
  })
}

// Post-load pass: detects whether the site already has a dark theme. If yes,
// we strip our own injection so the site's own dark design shows through cleanly.
// If no, we apply the layered force CSS.
export async function injectDarkMode(webContents: WebContents): Promise<void> {
  if (webContents.isDestroyed()) return
  await enqueueInjection(webContents, async () => {
    const siteDark = await isSiteAlreadyDark(webContents)
    if (siteDark) {
      await dropInjectedCSS(webContents)
      return
    }
    await replaceInjectedCSS(webContents, DARK_MODE_FORCE_CSS)
  })
}

export async function removeDarkMode(webContents: WebContents): Promise<void> {
  const wcId = webContents.id
  const pending = pendingInjects.get(wcId)
  if (pending) {
    await pending.catch(() => {
      /* pending injection may have been interrupted by navigation */
    })
  }
  await dropInjectedCSS(webContents)
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
