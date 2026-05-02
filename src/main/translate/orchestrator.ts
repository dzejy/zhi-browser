import type { WebContents } from 'electron'
import {
  buildBatchPrompt,
  buildTranslateBatches,
  normalizeTranslateSegments,
  parseNumberedTranslation,
  type TranslatePageSegment
} from './batcher'
import {
  TRANSLATE_PAGE_SCRIPT,
  TRANSLATE_REMOVE_SCRIPT,
  createTranslateApplyScript
} from './inject'
import { translateText } from './translateText'

const TRANSLATE_CONCURRENCY = 3

export async function translatePage(webContents: WebContents): Promise<void> {
  const result = await webContents.executeJavaScript(TRANSLATE_PAGE_SCRIPT, true).catch(() => [])
  const segments = normalizeTranslateSegments(result)
  const batches = buildTranslateBatches(segments)
  await runWithConcurrency(batches, webContents, TRANSLATE_CONCURRENCY)
}

export async function removePageTranslation(webContents: WebContents): Promise<void> {
  await webContents.executeJavaScript(TRANSLATE_REMOVE_SCRIPT, true).catch(() => {
    /* page may be unavailable */
  })
}

async function runWithConcurrency(
  batches: TranslatePageSegment[][],
  webContents: WebContents,
  concurrency = TRANSLATE_CONCURRENCY
): Promise<void> {
  let index = 0

  const worker = async (): Promise<void> => {
    while (index < batches.length) {
      const batch = batches[index++]
      if (!batch) return

      const stillActive = await isTranslateActive(webContents)
      if (!stillActive) return

      try {
        const prompt = buildBatchPrompt(batch)
        const response = await translateText(prompt, '简体中文')
        const translations = parseNumberedTranslation(response, batch.length)
        const shouldApply = await isTranslateActive(webContents)
        if (!shouldApply) return

        for (let i = 0; i < batch.length; i++) {
          await applyTranslation(webContents, batch[i], translations[i] || '⚠ 翻译失败')
        }
      } catch {
        for (const segment of batch) {
          await applyTranslation(webContents, segment, '⚠ 翻译失败')
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}

async function isTranslateActive(webContents: WebContents): Promise<boolean> {
  if (webContents.isDestroyed()) return false
  return webContents
    .executeJavaScript('Boolean(window.__zhiTranslateActive)', true)
    .catch(() => false)
}

async function applyTranslation(
  webContents: WebContents,
  segment: TranslatePageSegment,
  translated: string
): Promise<void> {
  if (webContents.isDestroyed()) return
  await webContents.executeJavaScript(createTranslateApplyScript(segment.id, translated), true).catch(() => {
    /* page may be unavailable */
  })
}
