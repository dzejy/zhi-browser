import { ipcMain, session, Session } from 'electron'

let incognitoSession: Session | null = null
let incognitoTabCount = 0
let currentProxyRules: string | null = null

export function getIncognitoSession(): Session {
  if (!incognitoSession) {
    incognitoSession = session.fromPartition('incognito', { cache: false })
    if (currentProxyRules) {
      incognitoSession.setProxy({ proxyRules: currentProxyRules }).catch(() => {})
    }
  }
  return incognitoSession
}

export function isIncognito(): boolean {
  return incognitoTabCount > 0
}

export function noteIncognitoTabCreated(): void {
  incognitoTabCount += 1
}

export function noteIncognitoTabClosed(): void {
  incognitoTabCount = Math.max(0, incognitoTabCount - 1)
  if (incognitoTabCount === 0) {
    clearIncognitoData()
  }
}

export function clearIncognitoData(): void {
  if (!incognitoSession) return
  incognitoSession.clearStorageData().catch(() => {})
  incognitoSession.clearCache().catch(() => {})
  incognitoSession.clearAuthCache().catch(() => {})
}

export function setIncognitoProxy(proxyRules: string | null): void {
  currentProxyRules = proxyRules
  if (!incognitoSession) return
  const options = proxyRules ? { proxyRules } : { mode: 'direct' as const }
  incognitoSession.setProxy(options).catch(() => {})
}

export function registerIncognitoHandlers(callbacks: {
  createTab: (url: string, options: { session: Session; incognito: boolean }) => void
  getActiveTabWebContents: () => Electron.WebContents | null
}): void {
  ipcMain.handle('incognito:newTab', (_event, url?: string) => {
    try {
      const ses = getIncognitoSession()
      callbacks.createTab(url || 'about:blank', { session: ses, incognito: true })
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('incognito:isActive', () => {
    try {
      return isIncognito()
    } catch {
      return false
    }
  })

  ipcMain.handle('incognito:clearData', () => {
    try {
      clearIncognitoData()
      return { success: true }
    } catch {
      return { success: false }
    }
  })
}
