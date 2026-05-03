import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import YAML from 'yaml'
import { generateConfig } from './configTemplate'
import { restartCore, isCoreRunning } from './core'

const PROXY_DIR = path.join(app.getPath('userData'), 'proxy')
const CONFIG_PATH = path.join(PROXY_DIR, 'config.yaml')

let lastUpdated: number | null = null
let nodeCount = 0

export function getConfigPath(): string {
  return CONFIG_PATH
}

export async function updateSubscription(
  url: string,
  options: {
    mixedPort: number
    apiPort: number
    secret: string
  }
): Promise<number> {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('订阅链接不能为空')
  }

  if (!fs.existsSync(PROXY_DIR)) {
    fs.mkdirSync(PROXY_DIR, { recursive: true })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url.trim(), {
      headers: { 'User-Agent': 'clash.meta' },
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const content = await response.text()
    const config = generateConfig({
      mixedPort: options.mixedPort,
      apiPort: options.apiPort,
      secret: options.secret,
      subscriptionContent: content
    })

    fs.writeFileSync(CONFIG_PATH, config, 'utf-8')

    const parsed = YAML.parse(config) as { proxies?: unknown }
    nodeCount = Array.isArray(parsed?.proxies) ? parsed.proxies.length : 0
    lastUpdated = Date.now()

    if (isCoreRunning()) {
      restartCore(CONFIG_PATH)
    }

    return nodeCount
  } finally {
    clearTimeout(timeout)
  }
}

export function getLastSubscriptionInfo(): {
  lastUpdated: number | null
  nodeCount: number
  filePath: string
} {
  return {
    lastUpdated,
    nodeCount,
    filePath: CONFIG_PATH
  }
}
