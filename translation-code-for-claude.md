# Zhi Browser Translation Code For Review

This is a read-only review bundle assembled from the current translation implementation. Source files were not modified for this bundle.

## Files To Review

- `src/main/translate.ts`: AI translation request wrapper and IPC handler for single text/batch text translation.
- `src/main/translate-inject.ts`: page-side collection/removal/apply scripts for immersive translation.
- `src/main/index.ts`: main-process orchestration for `translate:page`, batching, active tab access, and script execution.
- `src/preload/index.ts`: renderer API exposure for `translatePage`.
- `src/preload/index.d.ts`: renderer API type.
- `src/renderer/src/App.tsx`: toolbar state, click handler, and button.

## `src/main/translate.ts`

```ts
import { ipcMain } from 'electron'
import type { AIMessage } from '../shared/aiTypes'
import { getPreferences } from './settings'
import { callAI } from './aiProvider'

export async function translateText(text: string, targetLang: string): Promise<string> {
  const prefs = getPreferences()
  if (!prefs.ai.enabled) {
    throw new Error('AI 功能未启用')
  }

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `你是一个专业翻译引擎。请将以下内容翻译为${targetLang}。规则：1）只输出译文，不要解释；2）文本中包含分隔符「【|SPLIT|】」，翻译后必须保留这些分隔符在对应位置，用于分割不同段落；3）保持每个段落的语义完整；4）翻译要自然流畅。`
    },
    { role: 'user', content: text }
  ]

  const result = await callAI(prefs, messages)
  if (!result.success) {
    throw new Error(result.error || '翻译失败')
  }
  return result.text?.trim() || ''
}

export function registerTranslateHandlers(): void {
  ipcMain.handle('translate:text', async (_event, text: string, targetLang: string) => {
    try {
      const result = await translateText(text, targetLang)
      return { success: true, result }
    } catch (e) {
      return { success: false, result: '', error: String(e) }
    }
  })
}
```

## `src/main/translate-inject.ts`

```ts
export interface TranslatePageSegment {
  id: string
  text: string
}

export const TRANSLATE_SEPARATOR = '【|SPLIT|】'

export const TRANSLATE_PAGE_SCRIPT = `
(function zhiTranslateCollect() {
  if (window.__zhiTranslateActive) return [];
  window.__zhiTranslateActive = true;

  const style = document.createElement('style');
  style.id = 'zhi-translate-style';
  style.textContent = \`
    .zhi-translate-block {
      margin: 2px 0 4px 0;
      padding: 0;
      background: transparent;
      border: none;
      font-size: inherit;
      line-height: inherit;
      font-family: inherit;
      color: inherit;
      opacity: 0.6;
      transition: opacity 0.3s ease;
    }
    .zhi-translate-block.visible {
      opacity: 0.6;
    }
    .zhi-translate-block:hover {
      opacity: 0.85;
    }
    .zhi-translate-inline {
      display: block;
      font-size: 0.92em;
      margin-top: 2px;
    }
    .zhi-translate-loading-wrap {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 4px 0;
      opacity: 0.4;
    }
    .zhi-translate-dot {
      display: inline-block;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: currentColor;
      animation: zhiDotPulse 1.2s infinite ease-in-out;
    }
    .zhi-translate-dot:nth-child(2) { animation-delay: 0.2s; }
    .zhi-translate-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes zhiDotPulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.2); }
    }
  \`;
  document.head.appendChild(style);

  const allElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, summary, caption, label, span, a, em, strong, div, article, section, main, aside');
  const blockTags = new Set(['P','H1','H2','H3','H4','H5','H6','LI','TD','TH','BLOCKQUOTE','FIGCAPTION','DT','DD','SUMMARY','CAPTION','DIV','ARTICLE','SECTION','MAIN','ASIDE']);
  const toTranslate = [];
  const seen = new Set();

  for (const el of allElements) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
    if (el.offsetParent === null && el.tagName !== 'BODY') continue;
    if (el.querySelector('.zhi-translate-block') || el.closest('.zhi-translate-block')) continue;
    if (el.getAttribute('data-zhi-translate-source')) continue;

    const text = el.innerText?.trim();
    if (!text || text.length < 6) continue;

    const totalChars = text.length;
    const chineseChars = (text.match(/[\\u4e00-\\u9fff\\u3400-\\u4dbf]/g) || []).length;
    const chineseRatio = chineseChars / totalChars;
    if (chineseRatio > 0.4) continue;

    const englishWords = text.match(/[a-zA-Z]{2,}/g);
    if (!englishWords || englishWords.length < 2) continue;

    let hasBlockChild = false;
    for (const child of el.children) {
      if (blockTags.has(child.tagName) && child.innerText?.trim().length > 5) {
        hasBlockChild = true;
        break;
      }
    }
    if (hasBlockChild) continue;

    const textKey = text.slice(0, 100);
    if (seen.has(textKey)) continue;
    seen.add(textKey);

    const id = 'zhi-' + Date.now().toString(36) + '-' + toTranslate.length;
    el.setAttribute('data-zhi-translate-source', id);

    const block = document.createElement('div');
    block.className = 'zhi-translate-block';
    block.setAttribute('data-zhi-translate-id', id);
    block.innerHTML = '<span class="zhi-translate-loading-wrap"><span class="zhi-translate-dot"></span><span class="zhi-translate-dot"></span><span class="zhi-translate-dot"></span></span>';
    el.after(block);

    toTranslate.push({ id, text });
  }

  if (toTranslate.length === 0) {
    window.__zhiTranslateActive = false;
    document.getElementById('zhi-translate-style')?.remove();
  }

  return toTranslate;
})();
`

export const TRANSLATE_REMOVE_SCRIPT = `
(function() {
  document.querySelectorAll('.zhi-translate-block').forEach(el => el.remove());
  document.querySelectorAll('[data-zhi-translate-source]').forEach(el => el.removeAttribute('data-zhi-translate-source'));
  const style = document.getElementById('zhi-translate-style');
  if (style) style.remove();
  window.__zhiTranslateActive = false;
})();
`

export const TRANSLATE_BRIDGE_SCRIPT = `
window.__zhiTranslateAPI = (text) => {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const handler = (event) => {
      if (event.data && event.data.type === 'zhi-translate-response' && event.data.id === id) {
        window.removeEventListener('message', handler);
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.result);
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: 'zhi-translate-request', id: id, text: text }, '*');
  });
};
`

export function createTranslateApplyScript(id: string, translated: string): string {
  return `
    (function() {
      const block = document.querySelector('.zhi-translate-block[data-zhi-translate-id=${JSON.stringify(id)}]');
      if (!block) return;
      const inline = document.createElement('span');
      inline.className = 'zhi-translate-inline';
      inline.textContent = ${JSON.stringify(translated)};
      block.replaceChildren(inline);
      requestAnimationFrame(() => block.classList.add('visible'));
    })();
  `
}
```

## `src/main/index.ts` Translation Snippets

```ts
import { registerTranslateHandlers, translateText } from './translate'
import {
  TRANSLATE_PAGE_SCRIPT,
  TRANSLATE_REMOVE_SCRIPT,
  TRANSLATE_BRIDGE_SCRIPT,
  createTranslateApplyScript,
  TRANSLATE_SEPARATOR,
  type TranslatePageSegment
} from './translate-inject'
```

```ts
registerTranslateHandlers()
```

```ts
function normalizeTranslateSegments(value: unknown): TranslatePageSegment[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is TranslatePageSegment => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.text === 'string'
  })
}

function buildTranslateBatches(segments: TranslatePageSegment[]): TranslatePageSegment[][] {
  const batches: TranslatePageSegment[][] = []
  let currentBatch: TranslatePageSegment[] = []
  let currentLength = 0

  for (const segment of segments) {
    if (
      currentBatch.length >= 15 ||
      (currentBatch.length > 0 && currentLength + segment.text.length > 3000)
    ) {
      batches.push(currentBatch)
      currentBatch = []
      currentLength = 0
    }

    currentBatch.push(segment)
    currentLength += segment.text.length
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

function splitTranslatedBatch(translated: string): string[] {
  return translated.split(TRANSLATE_SEPARATOR).map((part) => part.trim())
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

```ts
ipcMain.handle('translate:page', async (event, enable: boolean) => {
  if (!validateSender(event)) return
  const activeView = tabManager.getActiveTabView()
  if (!activeView) return

  if (!enable) {
    await activeView.webContents.executeJavaScript(TRANSLATE_REMOVE_SCRIPT, true).catch(() => {
      /* page may be unavailable */
    })
    return
  }

  await activeView.webContents.executeJavaScript(TRANSLATE_BRIDGE_SCRIPT, true).catch(() => {
    /* bridge is optional for main-process translation */
  })
  const result = await activeView.webContents
    .executeJavaScript(TRANSLATE_PAGE_SCRIPT, true)
    .catch(() => [])
  const segments = normalizeTranslateSegments(result)

  const batches = buildTranslateBatches(segments)

  for (const batch of batches) {
    if (activeView.webContents.isDestroyed()) break
    const stillActive = await activeView.webContents
      .executeJavaScript('Boolean(window.__zhiTranslateActive)', true)
      .catch(() => false)
    if (!stillActive) break

    try {
      const combined = batch.map((segment) => segment.text).join(`\n${TRANSLATE_SEPARATOR}\n`)
      const translated = await translateText(combined, '简体中文')
      const parts = splitTranslatedBatch(translated)
      const shouldApply = await activeView.webContents
        .executeJavaScript('Boolean(window.__zhiTranslateActive)', true)
        .catch(() => false)
      if (!shouldApply) break

      for (let index = 0; index < batch.length; index++) {
        const segment = batch[index]
        await activeView.webContents.executeJavaScript(
          createTranslateApplyScript(segment.id, parts[index] || parts[0] || '翻译失败'),
          true
        )
      }
    } catch {
      for (const segment of batch) {
        await activeView.webContents
          .executeJavaScript(createTranslateApplyScript(segment.id, '翻译失败'), true)
          .catch(() => {
            /* page may be unavailable */
          })
      }
    }

    await delay(500)
  }
})
```

## `src/preload/index.ts`

```ts
translatePage: (enable: boolean): Promise<void> => ipcRenderer.invoke('translate:page', enable),
```

There is also a top-level message bridge in preload:

```ts
window.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'zhi-translate-request') {
    const { id, text } = event.data
    try {
      const response = (await ipcRenderer.invoke('translate:text', text, '简体中文')) as {
        success: boolean
        result: string
        error?: string
      }
      window.postMessage(
        {
          type: 'zhi-translate-response',
          id,
          result: response.success ? response.result : '',
          error: response.success ? null : response.error
        },
        '*'
      )
    } catch (e) {
      window.postMessage(
        { type: 'zhi-translate-response', id, result: '', error: String(e) },
        '*'
      )
    }
  }
})
```

Note: normal page `WebContentsView` currently does not use this preload. Main process translation is the active path.

## `src/preload/index.d.ts`

```ts
translatePage(enable: boolean): Promise<void>
```

## `src/renderer/src/App.tsx`

```tsx
const [isTranslating, setIsTranslating] = useState(false)

const handleToggleTranslate = useCallback(async () => {
  const newState = !isTranslating
  setIsTranslating(newState)
  try {
    await window.api.translatePage(newState)
    showToast(newState ? '沉浸式翻译已开启' : '沉浸式翻译已关闭')
  } catch {
    setIsTranslating(!newState)
    showToast('翻译失败', 'error')
  }
}, [isTranslating, showToast])
```

```tsx
<button
  className={`action-btn ${isTranslating ? 'active' : ''}`}
  onClick={() => handleToggleTranslate().catch(console.error)}
  title="沉浸式翻译"
  aria-pressed={isTranslating}
>
  译
</button>
```
