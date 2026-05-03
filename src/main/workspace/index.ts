import { ipcMain } from 'electron'
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
}

export function registerWorkspaceHandlers(options: WorkspaceHandlerOptions = {}): void {
  loadWorkspaceState()

  const notifyLayoutChanged = (): void => {
    options.onLayoutChanged?.()
  }

  ipcMain.handle('workspace:getState', () => getState())
  ipcMain.handle('workspace:getAll', () => getState().workspaces)
  ipcMain.handle('workspace:getActive', () => getActiveWorkspace())

  ipcMain.handle(
    'workspace:add',
    (_e, data: { name: string; icon: string; color: string }) => {
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

  ipcMain.handle('workspace:remove', (_e, id: string) => ({
    success: removeWorkspace(id)
  }))
  ipcMain.handle(
    'workspace:update',
    (_e, id: string, updates: Partial<Workspace>) => ({
      success: updateWorkspace(id, updates)
    })
  )
  ipcMain.handle('workspace:switch', (_e, id: string) => ({
    success: switchWorkspace(id)
  }))
  ipcMain.handle('workspace:addTab', (_e, wsId: string, tabId: string) => {
    addTabToWorkspace(wsId, tabId)
    return { success: true }
  })
  ipcMain.handle('workspace:removeTab', (_e, wsId: string, tabId: string) => {
    removeTabFromWorkspace(wsId, tabId)
    return { success: true }
  })
  ipcMain.handle('workspace:pinTab', (_e, wsId: string, tabId: string) => {
    pinTab(wsId, tabId)
    return { success: true }
  })
  ipcMain.handle('workspace:unpinTab', (_e, wsId: string, tabId: string) => {
    unpinTab(wsId, tabId)
    return { success: true }
  })
  ipcMain.handle(
    'workspace:setLayout',
    (_e, layout: 'horizontal' | 'vertical') => {
      setTabLayout(layout)
      notifyLayoutChanged()
      return { success: true }
    }
  )
  ipcMain.handle('workspace:setSidebarWidth', (_e, w: number) => {
    setState({ sidebarWidth: w })
    notifyLayoutChanged()
    return { success: true }
  })
  ipcMain.handle('workspace:setSidebarCollapsed', (_e, v: boolean) => {
    setState({ sidebarCollapsed: v })
    notifyLayoutChanged()
    return { success: true }
  })
  ipcMain.handle('workspace:setAutoCollapse', (_e, v: boolean) => {
    setState({ autoCollapse: v })
    return { success: true }
  })
}
