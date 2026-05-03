import { ipcMain, session, app } from 'electron'
import fs from 'fs'
import type { DeepPartial, Preferences } from '../../shared/preferences'
import { startCore, stopCore, isCoreRunning, getCoreOutput } from './core'
import { updateSubscription, getConfigPath, getLastSubscriptionInfo } from './subscription'
import { getProxies, switchProxy, testGroupDelay, testNodeDelay, setApiConfig } from './api'
import type { ProxyGroup, ProxyStatus } from './types'
import { setIncognitoProxy } from '../incognito'

type GetPreferences = () => Preferences
type UpdatePreferences = (partial: DeepPartial<Preferences>) => Preferences

function buildProxyRules(port: number): string {
  return `http=127.0.0.1:${port};https=127.0.0.1:${port};socks=127.0.0.1:${port}`
}

async function enableSessionProxy(port: number): Promise<void> {
  const proxyRules = buildProxyRules(port)
  await session.defaultSession.setProxy({ proxyRules })
  setIncognitoProxy(proxyRules)
}

async function disableSessionProxy(): Promise<void> {
  await session.defaultSession.setProxy({ mode: 'direct' })
  setIncognitoProxy(null)
}

function updateProxyPreferences(
  updatePreferences: UpdatePreferences,
  proxy: DeepPartial<Preferences['proxy']>
): Preferences {
  return updatePreferences({ proxy })
}

async function collectProxyGroups(): Promise<ProxyGroup[]> {
  const proxies = await getProxies()
  const groups: ProxyGroup[] = []

  for (const [name, info] of Object.entries(proxies)) {
    const node = info as { type?: string; now?: string; all?: string[] }
    if (node.type === 'Selector' || node.type === 'URLTest' || node.type === 'Fallback') {
      groups.push({
        name,
        type: node.type,
        now: node.now || '',
        all: node.all || []
      })
    }
  }

  return groups
}

export function registerProxyHandlers(
  getPreferences: GetPreferences,
  updatePreferences: UpdatePreferences
): void {
  ipcMain.handle('proxy:toggle', async (_event, enable: boolean) => {
    try {
      const prefs = getPreferences().proxy

      if (enable) {
        const configPath = getConfigPath()
        if (!fs.existsSync(configPath)) {
          return { success: false, error: '请先更新订阅' }
        }

        setApiConfig(prefs.apiPort, prefs.secret)
        const started = startCore(configPath)
        if (!started) {
          return { success: false, error: '内核启动失败，请检查 resources/mihomo.exe' }
        }

        await new Promise((resolve) => setTimeout(resolve, 500))
        await enableSessionProxy(prefs.mixedPort)
        updateProxyPreferences(updatePreferences, { enabled: true })
        return { success: true }
      }

      stopCore()
      await disableSessionProxy()
      updateProxyPreferences(updatePreferences, { enabled: false })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('proxy:status', async () => {
    try {
      const prefs = getPreferences().proxy
      const groups = await collectProxyGroups()
      const currentNode =
        groups.find((group) => group.name.includes('节点选择') || group.name.includes('select'))
          ?.now ||
        groups[0]?.now ||
        ''

      const status: ProxyStatus = {
        running: isCoreRunning(),
        enabled: prefs.enabled,
        currentNode,
        groups
      }

      return status
    } catch {
      return { running: false, enabled: false, currentNode: '', groups: [] }
    }
  })

  ipcMain.handle('proxy:updateSubscription', async (_event, url: string) => {
    try {
      const prefs = getPreferences().proxy
      const nodeCount = await updateSubscription(url, {
        mixedPort: prefs.mixedPort,
        apiPort: prefs.apiPort,
        secret: prefs.secret
      })

      updateProxyPreferences(updatePreferences, {
        subscriptionUrl: url,
        lastUpdated: Date.now()
      })

      return { success: true, nodeCount }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('proxy:getGroups', async () => {
    try {
      return await collectProxyGroups()
    } catch {
      return []
    }
  })

  ipcMain.handle('proxy:getNodes', async (_event, group: string) => {
    try {
      const proxies = await getProxies()
      const groupInfo = proxies[group] as { all?: string[] } | undefined
      if (!groupInfo?.all) return []

      return groupInfo.all.map((name) => {
        const nodeInfo = proxies[name] as
          | {
              type?: string
              alive?: boolean
              history?: { delay: number }[]
            }
          | undefined
        const lastDelay = nodeInfo?.history?.[nodeInfo.history.length - 1]?.delay ?? null
        return {
          name,
          type: nodeInfo?.type || '',
          alive: nodeInfo?.alive !== false,
          delay: lastDelay
        }
      })
    } catch {
      return []
    }
  })

  ipcMain.handle('proxy:switch', async (_event, group: string, node: string) => {
    try {
      const success = await switchProxy(group, node)
      return { success }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('proxy:testAllDelay', async (_event, group: string) => {
    try {
      return await testGroupDelay(group)
    } catch {
      return {}
    }
  })

  ipcMain.handle('proxy:testNodeDelay', async (_event, node: string) => {
    try {
      const delay = await testNodeDelay(node)
      return { delay }
    } catch {
      return { delay: -1 }
    }
  })

  ipcMain.handle('proxy:getLogs', () => {
    try {
      return getCoreOutput()
    } catch {
      return []
    }
  })

  ipcMain.handle('proxy:getSubscriptionInfo', () => {
    try {
      return getLastSubscriptionInfo()
    } catch {
      return { lastUpdated: null, nodeCount: 0, filePath: getConfigPath() }
    }
  })

  app.on('will-quit', () => {
    stopCore()
  })
}

export async function proxyAutoStart(getPreferences: GetPreferences): Promise<void> {
  try {
    const prefs = getPreferences().proxy
    if (!prefs.autoStart || !fs.existsSync(getConfigPath())) return

    setApiConfig(prefs.apiPort, prefs.secret)
    const started = startCore(getConfigPath())
    if (!started) return

    await new Promise((resolve) => setTimeout(resolve, 500))
    await enableSessionProxy(prefs.mixedPort)
  } catch {
    // Auto-start failures are surfaced in proxy logs and should not block app launch.
  }
}
