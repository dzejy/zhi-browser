import { BrowserWindow, ipcMain, WebContentsView } from 'electron'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'

const previewCache = new Map<number, string>()
const PREVIEW_WIDTH = 320
const PREVIEW_HEIGHT = 200
let previewWindow: BrowserWindow | null = null
let blurHideTimer: ReturnType<typeof setTimeout> | null = null
const trackedParentWindows = new WeakSet<BrowserWindow>()

function getPreviewWindow(): BrowserWindow {
  if (previewWindow && !previewWindow.isDestroyed()) return previewWindow

  previewWindow = new BrowserWindow({
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  previewWindow.setIgnoreMouseEvents(true)
  previewWindow.setAlwaysOnTop(true, 'screen-saver')
  previewWindow.on('closed', () => {
    previewWindow = null
  })
  return previewWindow
}

function clearBlurHideTimer(): void {
  if (!blurHideTimer) return
  clearTimeout(blurHideTimer)
  blurHideTimer = null
}

function hidePreviewWindow(): void {
  clearBlurHideTimer()
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.hide()
  }
}

function attachParentFocusFallback(parent: BrowserWindow): void {
  if (trackedParentWindows.has(parent)) return
  trackedParentWindows.add(parent)

  parent.on('blur', () => {
    clearBlurHideTimer()
    blurHideTimer = setTimeout(() => {
      hidePreviewWindow()
    }, 1000)
  })

  parent.on('focus', () => {
    clearBlurHideTimer()
  })

  parent.on('closed', () => {
    clearBlurHideTimer()
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderPreviewHtml(options: { image?: string; kind?: 'image' | 'newtab' }): string {
  const image = options.image ? escapeHtml(options.image) : ''
  const snowUrl = getSnowImageUrl()
  const body =
    options.kind === 'newtab'
      ? `<div class="newtab"><div class="bg"></div><div class="time">11:09:38</div><div class="search"></div><div class="grid">${Array.from({ length: 6 }).map(() => '<span></span>').join('')}</div></div>`
      : `<img class="image" src="${image}" />`

  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
.image,.newtab{width:${PREVIEW_WIDTH}px;height:${PREVIEW_HEIGHT}px;border-radius:14px;border:1px solid rgba(255,255,255,.18);box-sizing:border-box;overflow:hidden;box-shadow:0 14px 42px rgba(0,0,0,.5),0 4px 14px rgba(0,0,0,.3)}
.image{display:block;object-fit:cover;background:#171a22}
.newtab{position:relative;background:#172033;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.bg{position:absolute;inset:0;background:linear-gradient(rgba(20,28,42,.2),rgba(20,28,42,.28)),url('${snowUrl}') center/cover no-repeat}
.time{position:absolute;top:34px;left:0;right:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:1px;text-align:center;text-shadow:0 2px 10px rgba(0,0,0,.35)}
.search{position:absolute;top:77px;left:64px;right:64px;height:21px;border-radius:999px;background:rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.24);backdrop-filter:blur(7px)}
.grid{position:absolute;left:52px;right:52px;bottom:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px 12px}
.grid span{height:32px;border-radius:8px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(7px)}
</style></head><body>${body}</body></html>`
}

function getSnowImageUrl(): string {
  const assetDir = join(__dirname, '../renderer/assets')
  try {
    if (existsSync(assetDir)) {
      const file = readdirSync(assetDir).find((name) => /^snow-.*\.jpg$/i.test(name))
      if (file) return pathToFileURL(join(assetDir, file)).toString()
    }
  } catch {
    /* fall back below */
  }

  const sourceImage = join(process.cwd(), 'src/renderer/src/assets/images/snow.jpg')
  if (existsSync(sourceImage)) return pathToFileURL(sourceImage).toString()
  return ''
}

export function registerTabPreviewHandlers(
  getTabViewById: (tabId: number) => WebContentsView | null
): void {
  ipcMain.handle('tabPreview:capture', async (_event, tabId: number) => {
    const cached = previewCache.get(tabId)
    if (cached) return cached

    const view = getTabViewById(tabId)
    if (!view || view.webContents.isDestroyed()) return null

    try {
      const image = await view.webContents.capturePage()
      if (image.isEmpty()) return null

      const resized = image.resize({ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT })
      const dataUrl = resized.toDataURL()

      previewCache.set(tabId, dataUrl)
      setTimeout(() => previewCache.delete(tabId), 5000)

      return dataUrl
    } catch {
      return null
    }
  })

  ipcMain.handle('tabPreview:clear', async (_event, tabId: number) => {
    previewCache.delete(tabId)
  })

  ipcMain.handle(
    'tabPreview:show',
    async (event, options: { x: number; y: number; image?: string; kind?: 'image' | 'newtab' }) => {
      const parent = BrowserWindow.fromWebContents(event.sender)
      if (parent && !parent.isDestroyed()) {
        attachParentFocusFallback(parent)
      }
      clearBlurHideTimer()
      const win = getPreviewWindow()
      const x = Math.round(options.x - PREVIEW_WIDTH / 2)
      const y = Math.round(options.y)
      win.setBounds({ x, y, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT })
      await win.loadURL(
        'data:text/html;charset=utf-8,' + encodeURIComponent(renderPreviewHtml(options))
      )
      win.showInactive()
    }
  )

  ipcMain.handle('tabPreview:hide', async () => {
    hidePreviewWindow()
  })
}

export function clearTabPreview(tabId: number): void {
  previewCache.delete(tabId)
}
