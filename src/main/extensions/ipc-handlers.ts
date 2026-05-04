import { dialog, ipcMain } from 'electron'
import type { ExtensionInfo } from './types'

export interface ExtensionIpcController {
  getAllInfo(): ExtensionInfo[]
  installFromLocal(dirPath: string): Promise<ExtensionInfo>
  installFromWebStore(urlOrId: string): Promise<ExtensionInfo>
  uninstall(extensionId: string): void
  enable(extensionId: string): Promise<void>
  disable(extensionId: string): void
  reload(extensionId: string): Promise<void>
}

export function registerExtensionIpcHandlers(system: ExtensionIpcController): void {
  ipcMain.handle('ext:getAll', () => system.getAllInfo())

  ipcMain.handle('ext:installLocal', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择扩展目录（包含 manifest.json）'
    })
    if (result.canceled || !result.filePaths[0]) return null
    return system.installFromLocal(result.filePaths[0])
  })

  ipcMain.handle('ext:installWebStore', async (_event, urlOrId: string) => {
    return system.installFromWebStore(urlOrId)
  })

  ipcMain.handle('ext:uninstall', (_event, id: string) => {
    system.uninstall(id)
    return { success: true }
  })

  ipcMain.handle('ext:enable', async (_event, id: string) => {
    await system.enable(id)
    return { success: true }
  })

  ipcMain.handle('ext:disable', (_event, id: string) => {
    system.disable(id)
    return { success: true }
  })

  ipcMain.handle('ext:reload', async (_event, id: string) => {
    await system.reload(id)
    return { success: true }
  })
}
