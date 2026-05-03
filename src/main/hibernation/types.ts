export interface HibernatedTabState {
  tabId: string
  url: string
  title: string
  favicon: string
  scrollY: number
  hibernatedAt: number
}

export interface HibernationPrefs {
  enabled: boolean
  timeoutMinutes: number
  whitelist: string[]
}
