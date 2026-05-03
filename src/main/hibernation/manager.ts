import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { HibernatedTabState, HibernationPrefs } from './types'

interface TabAdapter {
  getTab(tabId: string):
    | {
        url: string
        title: string
        favicon: string
        view: Electron.WebContentsView
        isAudible: boolean
      }
    | undefined
  getTabOrder(): string[]
  getActiveTabId(): string
  loadUrl(tabId: string, url: string): void
}

const PLACEHOLDER_URL = 'about:blank'
const PREF_FILE = path.join(app.getPath('userData'), 'hibernation.json')

const lastActive: Map<string, number> = new Map()
const hibernatedTabs: Map<string, HibernatedTabState> = new Map()
let prefs: HibernationPrefs = { enabled: false, timeoutMinutes: 30, whitelist: [] }
let adapter: TabAdapter | null = null
let timer: ReturnType<typeof setInterval> | null = null

function loadPrefs(): void {
  try {
    if (fs.existsSync(PREF_FILE)) {
      prefs = { ...prefs, ...JSON.parse(fs.readFileSync(PREF_FILE, 'utf-8')) }
    }
  } catch {}
}

function savePrefs(): void {
  try {
    fs.writeFileSync(PREF_FILE, JSON.stringify(prefs, null, 2), 'utf-8')
  } catch {}
}

export function initHibernationManager(tabAdapter: TabAdapter): void {
  adapter = tabAdapter
  loadPrefs()
  if (timer) clearInterval(timer)
  timer = setInterval(checkHibernation, 60000)
}

export function recordTabActive(tabId: string): void {
  lastActive.set(tabId, Date.now())
}

export function getHibernationPrefs(): HibernationPrefs {
  return { ...prefs }
}

export function setHibernationPrefs(p: Partial<HibernationPrefs>): void {
  prefs = { ...prefs, ...p }
  savePrefs()
}

export function isTabHibernated(tabId: string): boolean {
  return hibernatedTabs.has(tabId)
}

export function getHibernatedTabState(tabId: string): HibernatedTabState | null {
  return hibernatedTabs.get(tabId) ?? null
}

export function getHibernatedTabIds(): string[] {
  return Array.from(hibernatedTabs.keys())
}

function isWhitelisted(url: string): boolean {
  try {
    const u = new URL(url)
    return prefs.whitelist.some((w) => u.hostname.includes(w))
  } catch {
    return false
  }
}

export async function hibernateTab(tabId: string): Promise<boolean> {
  if (!adapter) return false
  if (hibernatedTabs.has(tabId)) return true
  const tab = adapter.getTab(tabId)
  if (!tab) return false
  if (!tab.url || tab.url === PLACEHOLDER_URL) return false
  if (tab.isAudible) return false
  if (isWhitelisted(tab.url)) return false

  let scrollY = 0
  try {
    const result = await tab.view.webContents.executeJavaScript('window.scrollY || 0')
    if (typeof result === 'number') scrollY = result
  } catch {}

  hibernatedTabs.set(tabId, {
    tabId,
    url: tab.url,
    title: tab.title,
    favicon: tab.favicon,
    scrollY,
    hibernatedAt: Date.now()
  })

  adapter.loadUrl(tabId, PLACEHOLDER_URL)
  return true
}

export function wakeTab(tabId: string): boolean {
  if (!adapter) return false
  const state = hibernatedTabs.get(tabId)
  if (!state) return false
  hibernatedTabs.delete(tabId)
  adapter.loadUrl(tabId, state.url)
  recordTabActive(tabId)
  return true
}

export async function hibernateOthers(): Promise<number> {
  if (!adapter) return 0
  const active = adapter.getActiveTabId()
  const order = adapter.getTabOrder()
  let count = 0
  for (const id of order) {
    if (id === active) continue
    const ok = await hibernateTab(id)
    if (ok) count++
  }
  return count
}

async function checkHibernation(): Promise<void> {
  if (!adapter || !prefs.enabled) return
  const now = Date.now()
  const threshold = prefs.timeoutMinutes * 60 * 1000
  const active = adapter.getActiveTabId()
  for (const id of adapter.getTabOrder()) {
    if (id === active) continue
    if (hibernatedTabs.has(id)) continue
    const last = lastActive.get(id) ?? now
    if (now - last >= threshold) {
      await hibernateTab(id).catch(() => {})
    }
  }
}

export function notifyTabClosed(tabId: string): void {
  hibernatedTabs.delete(tabId)
  lastActive.delete(tabId)
}
