export interface Workspace {
  id: string
  name: string
  icon: string
  color: string
  tabIds: string[]
  pinnedTabIds: string[]
  createdAt: number
  isDefault: boolean
}

export interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string
  tabLayout: 'horizontal' | 'vertical'
  sidebarWidth: number
  sidebarCollapsed: boolean
  autoCollapse: boolean
}

export interface TabInfo {
  id: string
  url: string
  title: string
  favicon: string
  isLoading: boolean
  isPinned: boolean
  workspaceId: string
  isActive: boolean
}
