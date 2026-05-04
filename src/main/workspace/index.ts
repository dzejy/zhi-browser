import { ipcMain, IpcMainInvokeEvent } from 'electron'
import {
  loadWorkspaceState,
  getState,
  setState,
  addWorkspace,
  removeWorkspace,
  updateWorkspace,
  getActiveWorkspace,
  switchWorkspace,
  addTabToWorkspace,
  removeTabFromWorkspace,
  pinTab,
  unpinTab,
  setTabLayout
} from './store'
import { Workspace } from './types'

interface WorkspaceHandlerOptions {
  onLayoutChanged?: () => void
  validateSender?: (event: IpcMainInvokeEvent) => boolean
}

export function registerWorkspaceHandlers(options: WorkspaceHandlerOptions = {}): void {
  loadWorkspaceState()
  const isAllowed = (event: IpcMainInvokeEvent): boolean => options.validateSender?.(event) ?? true

  const notifyLayoutChanged = (): void => {
    options.onLayoutChanged?.()
  }

  ipcMain.handle('workspace:getState', (event) => (isAllowed(event) ? getState() : null))
  ipcMain.handle('workspace:getAll', (event) => (isAllowed(event) ? getState().workspaces : []))
  ipcMain.handle('workspace:getActive', (event) =>
    isAllowed(event) ? getActiveWorkspace() : null
  )

  ipcMain.handle(
    'workspace:add',
    (event, data: { name: string; icon: string; color: string }) => {
      if (!isAllowed(event)) return { success: false }
      const workspace: Workspace = {
        id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: data.name,
        icon: data.icon,
        color: data.color,
        tabIds: [],
        pinnedTabIds: [],
        createdAt: Date.now(),
        isDefault: false
      }
      addWorkspace(workspace)
      return { success: true, id: workspace.id }
    }
  )

  ipcMain.handle('workspace:remove', (event, id: string) => ({
    success: isAllowed(event) ? removeWorkspace(id) : false
  }))
  ipcMain.handle(
    'workspace:update',
    (event, id: string, updates: Partial<Workspace>) => ({
      success: isAllowed(event) ? updateWorkspace(id, updates) : false
    })
  )
  ipcMain.handle('workspace:switch', (event, id: string) => ({
    success: isAllowed(event) ? switchWorkspace(id) : false
  }))
  ipcMain.handle('workspace:addTab', (event, wsId: string, tabId: string) => {
    if (!isAllowed(event)) return { success: false }
    addTabToWorkspace(wsId, tabId)
    return { success: true }
  })
  ipcMain.handle('workspace:removeTab', (event, wsId: string, tabId: string) => {
    if (!isAllowed(event)) return { success: false }
    removeTabFromWorkspace(wsId, tabId)
    return { success: true }
  })
  ipcMain.handle('workspace:pinTab', (event, wsId: string, tabId: string) => {
    if (!isAllowed(event)) return { success: false }
    pinTab(wsId, tabId)
    return { success: true }
  })
  ipcMain.handle('workspace:unpinTab', (event, wsId: string, tabId: string) => {
    if (!isAllowed(event)) return { success: false }
    unpinTab(wsId, tabId)
    return { success: true }
  })
  ipcMain.handle(
    'workspace:setLayout',
    (event, layout: 'horizontal' | 'vertical') => {
      if (!isAllowed(event)) return { success: false }
      setTabLayout(layout)
      notifyLayoutChanged()
      return { success: true }
    }
  )
  ipcMain.handle('workspace:setSidebarWidth', (event, w: number) => {
    if (!isAllowed(event)) return { success: false }
    setState({ sidebarWidth: w })
    notifyLayoutChanged()
    return { success: true }
  })
  ipcMain.handle('workspace:setSidebarCollapsed', (event, v: boolean) => {
    if (!isAllowed(event)) return { success: false }
    setState({ sidebarCollapsed: v })
    notifyLayoutChanged()
    return { success: true }
  })
  ipcMain.handle('workspace:setAutoCollapse', (event, v: boolean) => {
    if (!isAllowed(event)) return { success: false }
    setState({ autoCollapse: v })
    return { success: true }
  })
}
