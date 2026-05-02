import type { WebContents } from 'electron'
import type { ExtractedPageContent } from '../shared/aiTypes'

export async function extractPageContent(
  webContents: WebContents,
  maxChars: number
): Promise<ExtractedPageContent> {
  const extractScript = `
    (() => {
      const title = document.title || ''
      const url = location.href || ''

      let selection = ''
      try {
        selection = (window.getSelection() || '').toString().trim()
      } catch {
        selection = ''
      }

      let text = ''
      try {
        const containers = document.querySelectorAll('article, main, [role="main"]')
        if (containers.length > 0) {
          const parts = []
          containers.forEach((el) => {
            parts.push(el.innerText || '')
          })
          text = parts.join('\\n\\n')
        }

        if (!text || text.length < 100) {
          const clone = document.body ? document.body.cloneNode(true) : null
          if (clone) {
            const removes = clone.querySelectorAll(
              'script, style, noscript, nav, footer, header, aside, ' +
                '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
                '.sidebar, .nav, .footer, .header, .menu, .ad, .ads, .advertisement'
            )
            removes.forEach((el) => el.remove())
            text = (clone.innerText || '').trim()
          }
        }
      } catch {
        text = (document.body && document.body.innerText) || ''
      }

      text = text.replace(/\\n{3,}/g, '\\n\\n').trim()
      return { title, url, text, selection }
    })()
  `

  try {
    const result = await webContents.executeJavaScript(extractScript, true)
    const title = typeof result?.title === 'string' ? result.title : ''
    const url = typeof result?.url === 'string' ? result.url : ''
    const selection = typeof result?.selection === 'string' ? result.selection : ''
    let text = typeof result?.text === 'string' ? result.text : ''

    const safeMax = Number.isFinite(maxChars) ? Math.max(1000, Math.floor(maxChars)) : 12000
    if (text.length > safeMax) {
      text = `${text.slice(0, safeMax)}\n\n[内容已截断]`
    }

    return {
      title,
      url,
      text,
      selection,
      excerpt: text.slice(0, 500)
    }
  } catch {
    return { title: '', url: '', text: '', selection: '', excerpt: '' }
  }
}

export async function extractSelection(webContents: WebContents): Promise<string> {
  const script = `
    (() => {
      try {
        return (window.getSelection() || '').toString().trim()
      } catch {
        return ''
      }
    })()
  `

  try {
    const result = await webContents.executeJavaScript(script, true)
    return typeof result === 'string' ? result : ''
  } catch {
    return ''
  }
}
