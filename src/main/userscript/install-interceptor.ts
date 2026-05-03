import { BaseWindow, WebContents, dialog, net } from 'electron'
import { parseMetadata } from './metadata-parser'
import { installScript } from './store'

export interface OpenInTabOptions {
  loadURLOptions?: Electron.LoadURLOptions
}

export function setupInstallInterceptor(
  webContents: WebContents,
  getMainWindow: () => BaseWindow | null,
  openInTab?: (url: string, options?: OpenInTabOptions) => void,
  onInstalled?: (payload: { name: string }) => void
): void {
  webContents.on('will-navigate', async (event, url) => {
    if (isUserScriptUrl(url)) {
      event.preventDefault()
      await handleUserScriptInstall(url, getMainWindow, onInstalled)
    }
  })

  webContents.setWindowOpenHandler((details) => {
    const { url } = details
    if (isUserScriptUrl(url)) {
      handleUserScriptInstall(url, getMainWindow, onInstalled).catch(() => {})
      return { action: 'deny' }
    }

    if (url && url !== 'about:blank' && openInTab) {
      const postBody = details.postBody
      const contentType = postBody?.contentType
      const boundary = postBody?.boundary
      const loadURLOptions: Electron.LoadURLOptions = {}

      if (details.referrer?.url) {
        loadURLOptions.httpReferrer = details.referrer
      }
      if (postBody?.data?.length) {
        loadURLOptions.postData = postBody.data
        if (contentType) {
          loadURLOptions.extraHeaders = boundary
            ? `content-type: ${contentType}; boundary=${boundary}`
            : `content-type: ${contentType}`
        }
      }

      openInTab(url, { loadURLOptions })
      return { action: 'deny' }
    }

    // Allow intermediate about:blank popup windows so sites that submit forms
    // into a newly opened window can carry query text correctly.
    return { action: 'allow' }
  })
}

function isUserScriptUrl(url: string): boolean {
  return url.endsWith('.user.js') || url.includes('.user.js?')
}

async function handleUserScriptInstall(
  url: string,
  getMainWindow: () => BaseWindow | null,
  onInstalled?: (payload: { name: string }) => void
): Promise<void> {
  try {
    const response = await net.fetch(url)
    const code = await response.text()
    const meta = parseMetadata(code)

    if (!meta.name || meta.name === 'Unnamed Script') {
      return
    }

    const mainWindow = getMainWindow()
    const options: Electron.MessageBoxOptions = {
      type: 'question',
      title: '安装用户脚本',
      message: `确定要安装「${meta.name}」吗？`,
      detail: [
        `版本: ${meta.version}`,
        `作者: ${meta.author}`,
        `描述: ${meta.description}`,
        '',
        `匹配: ${meta.match.join(', ') || meta.include.join(', ') || '无'}`,
        `权限: ${meta.grant.join(', ') || '无'}`
      ].join('\n'),
      buttons: ['安装', '取消'],
      defaultId: 0,
      cancelId: 1
    }
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options)

    if (result.response === 0) {
      installScript(code)
      onInstalled?.({ name: meta.name })
    }
  } catch (error) {
    console.error('[UserScript] Install from URL failed:', error)
  }
}
