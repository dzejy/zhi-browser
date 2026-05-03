import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { Workspace, WorkspaceState } from './types'

const STORE_PATH = path.join(app.getPath('userData'), 'workspaces.json')

const DEFAULT_STATE: WorkspaceState = {
  workspaces: [
    {
      id: 'default',
      name: '默认',
      icon: '🏠',
      color: '#6366f1',
      tabIds: [],
      pinnedTabIds: [],
      createdAt: Date.now(),
      isDefault: true
    }
  ],
  activeWorkspaceId: 'default',
  tabLayout: 'horizontal',
  sidebarWidth: 240,
  sidebarCollapsed: false,
  autoCollapse: true
}

let state: WorkspaceState = { ...DEFAULT_STATE }

export function loadWorkspaceState(): WorkspaceState {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
      state = { ...DEFAULT_STATE, ...data }
    }
  } catch {
    state = { ...DEFAULT_STATE }
  }
  return state
}

export function saveWorkspaceState(): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8')
  } catch {}
}

export function getState(): WorkspaceState {
  return state
}

export function setState(newState: Partial<WorkspaceState>): void {
  state = { ...state, ...newState }
  saveWorkspaceState()
}

export function addWorkspace(workspace: Workspace): void {
  state.workspaces = [...state.workspaces, workspace]
  saveWorkspaceState()
}

export function removeWorkspace(id: string): boolean {
  if (id === 'default') return false
  state.workspaces = state.workspaces.filter((w) => w.id !== id)
  if (state.activeWorkspaceId === id) state.activeWorkspaceId = 'default'
  saveWorkspaceState()
  return true
}

export function updateWorkspace(id: string, updates: Partial<Workspace>): boolean {
  const idx = state.workspaces.findIndex((w) => w.id === id)
  if (idx === -1) return false
  state.workspaces[idx] = { ...state.workspaces[idx], ...updates }
  saveWorkspaceState()
  return true
}

export function getActiveWorkspace(): Workspace {
  return state.workspaces.find((w) => w.id === state.activeWorkspaceId) || state.workspaces[0]
}

export function switchWorkspace(id: string): boolean {
  if (!state.workspaces.find((w) => w.id === id)) return false
  state.activeWorkspaceId = id
  saveWorkspaceState()
  return true
}

export function addTabToWorkspace(workspaceId: string, tabId: string): void {
  const ws = state.workspaces.find((w) => w.id === workspaceId)
  if (!ws) return
  if (!ws.tabIds.includes(tabId)) {
    ws.tabIds.push(tabId)
    saveWorkspaceState()
  }
}

export function removeTabFromWorkspace(workspaceId: string, tabId: string): void {
  const ws = state.workspaces.find((w) => w.id === workspaceId)
  if (!ws) return
  ws.tabIds = ws.tabIds.filter((id) => id !== tabId)
  ws.pinnedTabIds = ws.pinnedTabIds.filter((id) => id !== tabId)
  saveWorkspaceState()
}

export function pinTab(workspaceId: string, tabId: string): void {
  const ws = state.workspaces.find((w) => w.id === workspaceId)
  if (!ws) return
  if (!ws.pinnedTabIds.includes(tabId)) {
    ws.pinnedTabIds.push(tabId)
    saveWorkspaceState()
  }
}

export function unpinTab(workspaceId: string, tabId: string): void {
  const ws = state.workspaces.find((w) => w.id === workspaceId)
  if (!ws) return
  ws.pinnedTabIds = ws.pinnedTabIds.filter((id) => id !== tabId)
  saveWorkspaceState()
}

export function setTabLayout(layout: 'horizontal' | 'vertical'): void {
  state.tabLayout = layout
  saveWorkspaceState()
}

export function getEffectiveSidebarWidth(): number {
  if (state.tabLayout !== 'vertical') return 0
  if (state.sidebarCollapsed) return 48
  return Math.max(160, Math.min(420, state.sidebarWidth || DEFAULT_STATE.sidebarWidth))
}
