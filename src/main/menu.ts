import { app, Menu, MenuItemConstructorOptions } from 'electron'

export interface MenuActions {
  newTab: () => void
  closeTab: () => void
  reload: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  toggleDevTools: () => void
  focusAddressBar: () => void
  findInPage: () => void
  showHistory: () => void
  showBookmarks: () => void
  showDownloads: () => void
  showSettings: () => void
  showAbout: () => void
  reopenClosedTab: () => void
  addBookmark: () => void
  openUserDataFolder: () => void
  clearBrowsingData: () => void
  isDevToolsEnabled: () => boolean
}

export function buildMenu(actions: MenuActions): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: actions.newTab },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: actions.closeTab },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Alt+F4', click: () => app.quit() }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: actions.findInPage }
      ]
    },
    {
      label: '&View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: actions.reload },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: actions.zoomIn },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: actions.zoomOut },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: actions.zoomReset },
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          enabled: actions.isDevToolsEnabled(),
          click: actions.toggleDevTools
        },
        { type: 'separator' },
        { label: 'Focus Address Bar', accelerator: 'CmdOrCtrl+L', click: actions.focusAddressBar }
      ]
    },
    {
      label: '&History',
      submenu: [
        { label: 'Show History', accelerator: 'CmdOrCtrl+H', click: actions.showHistory },
        {
          label: 'Reopen Closed Tab',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: actions.reopenClosedTab
        }
      ]
    },
    {
      label: '&Bookmarks',
      submenu: [
        { label: 'Add Bookmark', accelerator: 'CmdOrCtrl+D', click: actions.addBookmark },
        { label: 'Show Bookmarks', accelerator: 'CmdOrCtrl+Shift+B', click: actions.showBookmarks }
      ]
    },
    {
      label: '&Downloads',
      submenu: [
        { label: 'Show Downloads', accelerator: 'CmdOrCtrl+J', click: actions.showDownloads }
      ]
    },
    {
      label: '&Tools',
      submenu: [
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: actions.showSettings },
        { label: 'Open User Data Folder', click: actions.openUserDataFolder },
        { type: 'separator' },
        { label: 'Clear Browsing Data', click: actions.clearBrowsingData }
      ]
    },
    {
      label: '&Help',
      submenu: [{ label: 'About Zhi Browser', click: actions.showAbout }]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
