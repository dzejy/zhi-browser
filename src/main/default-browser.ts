import { app, shell, dialog } from 'electron'
import { execSync } from 'child_process'

export function setAsDefaultBrowser(): void {
  const protocols = ['http', 'https']

  for (const protocol of protocols) {
    const success = app.setAsDefaultProtocolClient(protocol)
    if (!success) {
      console.warn('[default-browser] Failed to register protocol: ' + protocol)
    }
  }

  try {
    const exePath = process.execPath

    const browserPath = 'HKCU\\Software\\Clients\\StartMenuInternet\\ZhiBrowser'
    execSync(`reg add "${browserPath}" /ve /d "Zhi Browser" /f`)

    const capabilitiesPath = `${browserPath}\\Capabilities`
    execSync(`reg add "${capabilitiesPath}" /v ApplicationName /d "Zhi Browser" /f`)
    execSync(`reg add "${capabilitiesPath}" /v ApplicationDescription /d "Zhi Browser 个人 AI 浏览器" /f`)

    const urlAssocPath = `${capabilitiesPath}\\URLAssociations`
    execSync(`reg add "${urlAssocPath}" /v http /d "ZhiBrowserURL" /f`)
    execSync(`reg add "${urlAssocPath}" /v https /d "ZhiBrowserURL" /f`)

    const browserDefaultIconPath = `${browserPath}\\DefaultIcon`
    execSync(`reg add "${browserDefaultIconPath}" /ve /d "${exePath},0" /f`)

    const browserCommandPath = `${browserPath}\\shell\\open\\command`
    execSync(`reg add "${browserCommandPath}" /ve /d "\\"${exePath}\\" \\"%1\\"" /f`)

    const urlClassPath = 'HKCU\\Software\\Classes\\ZhiBrowserURL'
    execSync(`reg add "${urlClassPath}" /ve /d "Zhi Browser URL" /f`)
    execSync(`reg add "${urlClassPath}" /v "URL Protocol" /d "" /f`)

    const urlClassDefaultIconPath = `${urlClassPath}\\DefaultIcon`
    execSync(`reg add "${urlClassDefaultIconPath}" /ve /d "${exePath},0" /f`)

    const urlClassCommandPath = `${urlClassPath}\\shell\\open\\command`
    execSync(`reg add "${urlClassCommandPath}" /ve /d "\\"${exePath}\\" \\"%1\\"" /f`)

    execSync(`reg add "HKCU\\Software\\RegisteredApplications" /v ZhiBrowser /d "Software\\Clients\\StartMenuInternet\\ZhiBrowser\\Capabilities" /f`)

    execSync(`reg add "HKCU\\Software\\Classes\\.htm\\OpenWithProgids" /v ZhiBrowserURL /d "" /f`)
    execSync(`reg add "HKCU\\Software\\Classes\\.html\\OpenWithProgids" /v ZhiBrowserURL /d "" /f`)
  } catch (error) {
    console.error('[default-browser] Failed to write registry:', error)
  }

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
}

export function isDefaultBrowser(): boolean {
  return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https')
}
