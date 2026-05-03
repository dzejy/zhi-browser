export interface ProxyNode {
  name: string
  type: string
  alive: boolean
  delay: number | null
}

export interface ProxyGroup {
  name: string
  type: string
  now: string
  all: string[]
}

export interface ProxyStatus {
  running: boolean
  enabled: boolean
  currentNode: string
  groups: ProxyGroup[]
}

export interface ProxyPreferences {
  enabled: boolean
  subscriptionUrl: string
  mixedPort: number
  apiPort: number
  secret: string
  autoStart: boolean
  lastUpdated: number | null
}
