import { app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const isDevVariant = is.dev || !app.isPackaged
const appName = isDevVariant ? 'Zhi Browser Dev' : 'Zhi Browser'
const appModelId = isDevVariant ? 'com.zhi.browser.dev' : 'com.zhi.browser'
const userDataLeaf = isDevVariant ? 'Zhi Browser Dev' : 'Zhi Browser'

try {
  app.setName(appName)
} catch {
  /* ignore */
}

if (process.platform === 'win32') {
  app.setAppUserModelId(appModelId)
}

try {
  const appDataRoot = app.getPath('appData')
  app.setPath('userData', join(appDataRoot, userDataLeaf))
} catch {
  /* ignore */
}

process.env['ZHI_BROWSER_VARIANT'] = isDevVariant ? 'dev' : 'prod'
process.env['ZHI_BROWSER_APP_NAME'] = appName

void import('./app-main')
