import { app, shell, dialog } from 'electron'

export function setAsDefaultBrowser(): void {
  const protocols = ['http', 'https']

  for (const protocol of protocols) {
    const success = app.setAsDefaultProtocolClient(protocol)
    if (!success) {
      console.warn('[default-browser] Failed to register protocol: ' + protocol)
    }
  }

  if (process.platform === 'win32') {
    dialog
      .showMessageBox({
        type: 'info',
        title: '设置默认浏览器',
        message:
          '已向系统注册 Zhi Browser 为 HTTP/HTTPS 处理程序。\n\nWindows 要求您在系统设置中手动确认默认浏览器，点击"打开设置"前往。',
        buttons: ['打开设置', '稍后再说'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) {
          shell.openExternal('ms-settings:defaultapps')
        }
      })
  } else if (process.platform === 'darwin') {
    dialog.showMessageBox({
      type: 'info',
      title: '设置默认浏览器',
      message: '已将 Zhi Browser 设置为默认浏览器。',
      buttons: ['好']
    })
  } else {
    dialog.showMessageBox({
      type: 'info',
      title: '设置默认浏览器',
      message:
        '已注册协议处理程序。\n\n如未自动生效，请在终端执行：\nxdg-settings set default-web-browser zhi-browser.desktop',
      buttons: ['确定']
    })
  }
}

export function isDefaultBrowser(): boolean {
  return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https')
}
