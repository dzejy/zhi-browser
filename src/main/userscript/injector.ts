import { WebContents } from 'electron'
import { UserScript } from './metadata-parser'
import { getAllScripts } from './store'
import { shouldInjectScript } from './url-match'
import { generateGMApiScript } from './gm-api-bridge'

export function setupScriptInjection(webContents: WebContents): void {
  webContents.on('did-start-navigation', (_event, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return
    injectScriptsForTiming(webContents, url, 'document-start')
  })

  webContents.on('dom-ready', () => {
    const url = webContents.getURL()
    injectScriptsForTiming(webContents, url, 'document-end')
  })

  webContents.on('did-finish-load', () => {
    const url = webContents.getURL()
    injectScriptsForTiming(webContents, url, 'document-idle')
  })
}

function injectScriptsForTiming(
  webContents: WebContents,
  url: string,
  timing: 'document-start' | 'document-end' | 'document-idle'
): void {
  if (!url || url === 'about:blank' || url.startsWith('devtools://')) return
  if (webContents.isDestroyed()) return

  const scripts = getAllScripts()

  for (const script of scripts) {
    if (!script.enabled) continue
    if (script.meta.runAt !== timing) continue
    if (!shouldInjectScript(script.meta, url)) continue

    injectSingleScript(webContents, script)
  }
}

function injectSingleScript(webContents: WebContents, script: UserScript): void {
  try {
    if (webContents.isDestroyed()) return
    const gmApi = generateGMApiScript(script.id, script.meta)
    webContents.executeJavaScript(gmApi, true).catch(() => {})

    const wrappedCode = `
(function() {
  'use strict';
  try {
    ${script.code}
  } catch(e) {
    console.error('[Zhi UserScript Error] ${script.meta.name}:', e);
  }
})();
`
    webContents.executeJavaScript(wrappedCode, true).catch((err) => {
      console.error(`[UserScript] Failed to inject "${script.meta.name}":`, err.message)
    })
  } catch (err) {
    console.error(`[UserScript] Error injecting "${script.meta.name}":`, err)
  }
}

export function getMatchingScripts(url: string): UserScript[] {
  const scripts = getAllScripts()
  return scripts.filter((script) => script.enabled && shouldInjectScript(script.meta, url))
}
