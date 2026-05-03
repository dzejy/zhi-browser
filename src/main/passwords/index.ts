import { ipcMain } from 'electron'
import {
  getAllPasswords,
  getPassword,
  addPassword,
  updatePassword,
  deletePassword,
  searchPasswords
} from './store'

export function registerPasswordHandlers(): void {
  ipcMain.handle('passwords:getAll', () => {
    try {
      return getAllPasswords()
    } catch {
      return []
    }
  })

  ipcMain.handle('passwords:getPassword', (_event, id: string) => {
    try {
      return getPassword(id)
    } catch {
      return null
    }
  })

  ipcMain.handle(
    'passwords:add',
    (_event, data: { url: string; username: string; password: string; title: string }) => {
      try {
        const id = addPassword(data)
        return { success: true, id }
      } catch {
        return { success: false }
      }
    }
  )

  ipcMain.handle(
    'passwords:update',
    (
      _event,
      id: string,
      data: Partial<{ url: string; username: string; password: string; title: string }>
    ) => {
      try {
        const success = updatePassword(id, data)
        return { success }
      } catch {
        return { success: false }
      }
    }
  )

  ipcMain.handle('passwords:delete', (_event, id: string) => {
    try {
      const success = deletePassword(id)
      return { success }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('passwords:search', (_event, keyword: string) => {
    try {
      return searchPasswords(keyword)
    } catch {
      return []
    }
  })
}
