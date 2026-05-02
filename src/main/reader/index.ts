import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { extractArticle } from './extract'
import { createReaderInjectScript, READER_EXIT_SCRIPT } from './inject'

export function registerReaderHandlers(getActiveWebContents: () => WebContents | null): void {
  ipcMain.handle('reader:extract', async () => {
    const wc = getActiveWebContents()
    if (!wc || wc.isDestroyed()) return { success: false, error: '无活跃标签页' }

    try {
      const html = await wc.executeJavaScript('document.documentElement.outerHTML', true)
      const url = wc.getURL()
      const article = extractArticle(html, url)

      if (!article || article.length < 500) {
        return { success: false, error: '当前页面不适合阅读模式' }
      }

      return { success: true, article }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('reader:enter', async () => {
    const wc = getActiveWebContents()
    if (!wc || wc.isDestroyed()) return { success: false, error: '无活跃标签页' }

    try {
      const html = await wc.executeJavaScript('document.documentElement.outerHTML', true)
      const url = wc.getURL()
      const article = extractArticle(html, url)

      if (!article || article.length < 500) {
        return { success: false, error: '当前页面不适合阅读模式' }
      }

      await wc.executeJavaScript(createReaderInjectScript(article), true).catch(() => {})
      return { success: true, article }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('reader:exit', async () => {
    const wc = getActiveWebContents()
    if (!wc || wc.isDestroyed()) return false
    await wc.executeJavaScript(READER_EXIT_SCRIPT, true).catch(() => {})
    return true
  })

  ipcMain.handle('reader:canExtract', async () => {
    const wc = getActiveWebContents()
    if (!wc || wc.isDestroyed()) return false

    try {
      const hasContent = await wc.executeJavaScript(
        `
        (function() {
          const article = document.querySelector('article, [role="main"], main, .post-content, .article-content, .entry-content')
          if (article && article.innerText.length > 200) return true
          const paragraphs = document.querySelectorAll('p')
          let totalLength = 0
          for (const p of paragraphs) { totalLength += p.innerText.length }
          return totalLength > 500
        })()
      `,
        true
      )
      return Boolean(hasContent)
    } catch {
      return false
    }
  })
}
