import { app, Menu, MenuItemConstructorOptions } from 'electron'
import { setAsDefaultBrowser, isDefaultBrowser } from './default-browser'

export interface MenuActions {
  newTab: () => void
  newIncognitoTab: () => void
  openFile: () => void
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
  showCommandPalette: () => void
  startScreenshot: () => void
  openQuickNote: () => void
  hibernateOtherTabs: () => void
  reopenClosedTab: () => void
  addBookmark: () => void
  openUserDataFolder: () => void
  clearBrowsingData: () => void
  isDevToolsEnabled: () => boolean
  isBookmarkBarVisible: () => boolean
  setBookmarkBarVisible: (visible: boolean) => void
}

let applicationMenu: Menu | null = null

export function buildMenu(actions: MenuActions): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '新标签页', accelerator: 'CmdOrCtrl+T', click: actions.newTab },
        {
          label: '新建无痕标签页',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: actions.newIncognitoTab
        },
        { label: '关闭标签页', accelerator: 'CmdOrCtrl+W', click: actions.closeTab },
        { type: 'separator' },
        { label: '打开文件', accelerator: 'CmdOrCtrl+O', click: actions.openFile },
        { type: 'separator' },
        { label: '退出', accelerator: 'Alt+F4', click: () => app.quit() }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
        { type: 'separator' },
        { label: '查找', accelerator: 'CmdOrCtrl+F', click: actions.findInPage }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', accelerator: 'CmdOrCtrl+R', click: actions.reload },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: actions.zoomIn },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: actions.zoomOut },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: actions.zoomReset },
        { type: 'separator' },
        {
          label: '显示书签栏',
          accelerator: 'CmdOrCtrl+Shift+B',
          type: 'checkbox',
          checked: actions.isBookmarkBarVisible(),
          click: (menuItem) => actions.setBookmarkBarVisible(menuItem.checked)
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'F12',
          enabled: actions.isDevToolsEnabled(),
          click: actions.toggleDevTools
        },
        { type: 'separator' },
        { label: '聚焦地址栏', accelerator: 'CmdOrCtrl+L', click: actions.focusAddressBar }
      ]
    },
    {
      label: '历史',
      submenu: [
        { label: '浏览历史', accelerator: 'CmdOrCtrl+H', click: actions.showHistory },
        {
          label: '恢复关闭的标签',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: actions.reopenClosedTab
        }
      ]
    },
    {
      label: '书签',
      submenu: [
        { label: '收藏此页', accelerator: 'CmdOrCtrl+D', click: actions.addBookmark },
        { label: '书签管理', accelerator: 'CmdOrCtrl+Shift+O', click: actions.showBookmarks }
      ]
    },
    {
      label: '下载',
      submenu: [{ label: '下载管理', accelerator: 'CmdOrCtrl+J', click: actions.showDownloads }]
    },
    {
      label: '工具',
      submenu: [
        { label: '命令面板', accelerator: 'CmdOrCtrl+K', click: actions.showCommandPalette },
        { label: '截图', accelerator: 'Alt+A', click: actions.startScreenshot },
        { label: '快捷笔记', accelerator: 'Alt+N', click: actions.openQuickNote },
        { label: '休眠其他标签页', accelerator: 'Alt+H', click: actions.hibernateOtherTabs },
        { type: 'separator' },
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: actions.showSettings },
        { label: '打开数据目录', click: actions.openUserDataFolder },
        { type: 'separator' },
        { label: '清除浏览数据', click: actions.clearBrowsingData },
        { type: 'separator' },
        {
          label: isDefaultBrowser() ? '✓ 已是默认浏览器' : '设置为默认浏览器',
          click: (): void => {
            setAsDefaultBrowser()
          },
          enabled: !isDefaultBrowser()
        }
      ]
    },
    {
      label: 'Zhi',
      click: actions.showAbout
    }
  ]

  applicationMenu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(applicationMenu)
}

export function popupMenu(options?: Electron.PopupOptions): void {
  const menu = applicationMenu || Menu.getApplicationMenu()
  menu?.popup(options)
}
