import { WebContentsView } from 'electron'

export function executeGestureAction(
  action: string,
  getActiveView: () => WebContentsView | null,
  createTab: () => void,
  closeTab: () => void,
  reopenTab: () => void
): void {
  const view = getActiveView()
  if (!view && action !== 'newTab') return
  const wc = view?.webContents

  if (wc?.isDestroyed()) return

  switch (action) {
    case 'goBack':
      if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
      break
    case 'goForward':
      if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
      break
    case 'newTab':
      createTab()
      break
    case 'closeTab':
      closeTab()
      break
    case 'refresh':
      wc?.reload()
      break
    case 'stopLoad':
      wc?.stop()
      break
    case 'scrollTop':
      wc?.executeJavaScript('window.scrollTo({ top: 0, behavior: "smooth" })', true).catch(() => {})
      break
    case 'scrollBottom':
      wc
        ?.executeJavaScript('window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })', true)
        .catch(() => {})
      break
    case 'reopenTab':
      reopenTab()
      break
  }
}
