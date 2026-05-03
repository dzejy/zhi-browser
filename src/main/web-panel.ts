/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import { WebContentsView, ipcMain, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface WebPanelItem {
  id: string
  name: string
  url: string
  icon: string
  order: number
}

interface WebPanelState {
  panels: WebPanelItem[]
  activeId: string | null
  visible: boolean
  width: number
}

const state: WebPanelState = {
  panels: [],
  activeId: null,
  visible: false,
  width: 360
}

const panelViews: Map<string, WebContentsView> = new Map()
let mainWindowRef: Electron.BaseWindow | null = null
let getLayoutOffsetsRef: (() => { top: number; leftIconBar: number; verticalTab: number }) | null = null
let onLayoutChangedRef: (() => void) | null = null

const DATA_FILE = 'web-panels.json'

function getDataPath(): string {
  return path.join(app.getPath('userData'), DATA_FILE)
}

function loadPanels(): void {
  try {
    const raw = fs.readFileSync(getDataPath(), 'utf-8')
    const data = JSON.parse(raw)
    state.panels = data.panels || []
    state.width = data.width || 360
  } catch {
    state.panels = []
  }
}

function savePanels(): void {
  fs.writeFileSync(getDataPath(), JSON.stringify({
    panels: state.panels,
    width: state.width
  }, null, 2), 'utf-8')
}

function createPanelView(panel: WebPanelItem): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  })
  view.webContents.loadURL(panel.url)
  panelViews.set(panel.id, view)
  return view
}

function relayoutPanel(): void {
  if (!mainWindowRef || !state.visible || !state.activeId) return
  const view = panelViews.get(state.activeId)
  if (!view) return

  const offsets = getLayoutOffsetsRef?.() || { top: 0, leftIconBar: 0, verticalTab: 0 }
  const bounds = mainWindowRef.getBounds()
  const x = offsets.leftIconBar + offsets.verticalTab
  const y = offsets.top
  const w = state.width
  const h = bounds.height - y

  view.setBounds({ x, y, width: w, height: h })
}

function notifyLayoutChanged(): void {
  onLayoutChangedRef?.()
}

function showPanel(id: string): void {
  if (!mainWindowRef) return

  // Hide current
  if (state.activeId && state.activeId !== id) {
    const current = panelViews.get(state.activeId)
    if (current) {
      mainWindowRef.contentView.removeChildView(current)
    }
  }

  state.activeId = id
  state.visible = true

  let view = panelViews.get(id)
  if (!view) {
    const panel = state.panels.find(p => p.id === id)
    if (!panel) return
    view = createPanelView(panel)
  }

  mainWindowRef.contentView.addChildView(view)
  relayoutPanel()
}

function hidePanel(): void {
  if (!mainWindowRef || !state.activeId) return
  const view = panelViews.get(state.activeId)
  if (view) {
    mainWindowRef.contentView.removeChildView(view)
  }
  state.visible = false
  state.activeId = null
}

export function getWebPanelOffset(): number {
  if (!state.visible) return 0
  return state.width
}

export function getWebPanelRailWidth(): number {
  return state.panels.length > 0 ? 48 : 0
}

export function registerWebPanelHandlers(
  mainWindow: Electron.BaseWindow,
  getLayoutOffsets: () => { top: number; leftIconBar: number; verticalTab: number },
  onLayoutChanged?: () => void
): void {
  mainWindowRef = mainWindow
  getLayoutOffsetsRef = getLayoutOffsets
  onLayoutChangedRef = onLayoutChanged ?? null
  loadPanels()

  ipcMain.handle('webpanel:getAll', () => {
    return state.panels
  })

  ipcMain.handle('webpanel:add', (_e, item: Omit<WebPanelItem, 'id' | 'order'>) => {
    const id = `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newPanel: WebPanelItem = {
      id,
      name: item.name,
      url: item.url,
      icon: item.icon,
      order: state.panels.length
    }
    state.panels.push(newPanel)
    savePanels()
    notifyLayoutChanged()
    return newPanel
  })

  ipcMain.handle('webpanel:remove', (_e, id: string) => {
    const view = panelViews.get(id)
    if (view) {
      if (state.activeId === id) {
        mainWindowRef?.contentView.removeChildView(view)
        state.activeId = null
        state.visible = false
      }
      view.webContents.close()
      panelViews.delete(id)
    }
    state.panels = state.panels.filter(p => p.id !== id)
    savePanels()
    notifyLayoutChanged()
    return true
  })

  ipcMain.handle('webpanel:update', (_e, id: string, updates: Partial<WebPanelItem>) => {
    const panel = state.panels.find(p => p.id === id)
    if (!panel) return false
    if (updates.name !== undefined) panel.name = updates.name
    if (updates.url !== undefined) panel.url = updates.url
    if (updates.icon !== undefined) panel.icon = updates.icon
    savePanels()
    return true
  })

  ipcMain.handle('webpanel:toggle', (_e, id: string) => {
    if (state.activeId === id && state.visible) {
      hidePanel()
    } else {
      showPanel(id)
    }
    notifyLayoutChanged()
    return { visible: state.visible, activeId: state.activeId }
  })

  ipcMain.handle('webpanel:hide', () => {
    hidePanel()
    notifyLayoutChanged()
    return true
  })

  ipcMain.handle('webpanel:isVisible', () => {
    return state.visible
  })

  ipcMain.handle('webpanel:getActive', () => {
    return state.activeId
  })

  ipcMain.handle('webpanel:setWidth', (_e, width: number) => {
    state.width = Math.max(200, Math.min(600, width))
    savePanels()
    relayoutPanel()
    notifyLayoutChanged()
    return state.width
  })

  ipcMain.handle('webpanel:reorder', (_e, orderedIds: string[]) => {
    orderedIds.forEach((id, index) => {
      const panel = state.panels.find(p => p.id === id)
      if (panel) panel.order = index
    })
    state.panels.sort((a, b) => a.order - b.order)
    savePanels()
    return state.panels
  })

  ipcMain.handle('webpanel:relayout', () => {
    relayoutPanel()
    return true
  })
}
