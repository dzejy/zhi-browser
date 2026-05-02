import { ipcMain, Notification, clipboard, net } from 'electron'
import {
  getAllScripts,
  getScript,
  installScript,
  removeScript,
  toggleScript,
  getScriptStorage,
  setScriptStorage,
  deleteScriptStorage,
  listScriptStorageKeys
} from './store'
import { parseMetadata } from './metadata-parser'

type GMCallArgs = Record<string, unknown>

export function registerUserScriptIPC(openInTab: (url: string, active: boolean) => void): void {
  ipcMain.handle('userscript:get-all', () => {
    try {
      const scripts = getAllScripts()
      return scripts.map((script) => ({
        id: script.id,
        meta: script.meta,
        enabled: script.enabled,
        installTime: script.installTime,
        updateTime: script.updateTime
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle('userscript:get-code', (_event, id: string) => {
    try {
      const script = getScript(id)
      return script?.code || ''
    } catch {
      return ''
    }
  })

  ipcMain.handle('userscript:install', (_event, code: string) => {
    try {
      const script = installScript(code)
      return { id: script.id, meta: script.meta, enabled: script.enabled }
    } catch (error) {
      return { error: String(error) }
    }
  })

  ipcMain.handle('userscript:install-from-url', async (_event, url: string) => {
    try {
      const response = await net.fetch(url)
      const code = await response.text()
      const meta = parseMetadata(code)
      if (!meta.name || meta.name === 'Unnamed Script') {
        return { success: false, error: '无效的用户脚本文件' }
      }
      const script = installScript(code)
      return { success: true, id: script.id, meta: script.meta }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('userscript:remove', (_event, id: string) => {
    try {
      removeScript(id)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('userscript:toggle', (_event, id: string, enabled: boolean) => {
    try {
      toggleScript(id, enabled)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('userscript:update', async (_event, id: string) => {
    const script = getScript(id)
    if (!script || (!script.meta.updateURL && !script.meta.downloadURL)) {
      return { success: false, error: '没有更新地址' }
    }
    const url = script.meta.downloadURL || script.meta.updateURL
    try {
      const response = await net.fetch(url)
      const code = await response.text()
      const newMeta = parseMetadata(code)
      if (newMeta.version !== script.meta.version) {
        installScript(code)
        return { success: true, newVersion: newMeta.version }
      }
      return { success: false, error: '已是最新版本' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('userscript:gm-call', async (_event, scriptId: string, method: string, args: GMCallArgs) => {
    try {
      switch (method) {
        case 'getValue': {
          const storage = getScriptStorage(scriptId)
          const key = String(args.key)
          const value = storage[key]
          return value !== undefined ? value : args.defaultValue
        }
        case 'setValue': {
          setScriptStorage(scriptId, String(args.key), args.value)
          return true
        }
        case 'deleteValue': {
          deleteScriptStorage(scriptId, String(args.key))
          return true
        }
        case 'listValues': {
          return listScriptStorageKeys(scriptId)
        }
        case 'xmlhttpRequest': {
          const requestMethod = typeof args.method === 'string' ? args.method : 'GET'
          const requestHeaders =
            args.headers && typeof args.headers === 'object'
              ? (args.headers as Record<string, string>)
              : {}
          const fetchOptions: {
            method: string
            headers: Record<string, string>
            body?: string | ArrayBuffer
          } = {
            method: requestMethod,
            headers: requestHeaders
          }
          if ((typeof args.data === 'string' || args.data instanceof ArrayBuffer) && requestMethod !== 'GET') {
            fetchOptions.body = args.data
          }
          const response = await net.fetch(String(args.url), fetchOptions)
          const responseText = await response.text()
          return {
            status: response.status,
            statusText: response.statusText,
            responseText,
            responseHeaders: Object.fromEntries(response.headers.entries()),
            finalUrl: response.url
          }
        }
        case 'notification': {
          const notification = new Notification({
            title: typeof args.title === 'string' ? args.title : 'Zhi Browser',
            body:
              typeof args.text === 'string'
                ? args.text
                : typeof args.body === 'string'
                  ? args.body
                  : '',
            icon: typeof args.image === 'string' ? args.image : undefined
          })
          notification.show()
          return true
        }
        case 'setClipboard': {
          clipboard.writeText(typeof args.text === 'string' ? args.text : '')
          return true
        }
        case 'openInTab': {
          openInTab(String(args.url), args.active !== false)
          return true
        }
        case 'registerMenuCommand': {
          return true
        }
        default:
          console.warn(`[UserScript] Unknown GM method: ${method}`)
          return null
      }
    } catch (error) {
      throw new Error(`GM API failed: ${String(error)}`)
    }
  })
}
