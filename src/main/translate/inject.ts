export const TRANSLATE_PAGE_SCRIPT = `
(function zhiTranslateCollect() {
  if (window.__zhiTranslateActive) return [];
  window.__zhiTranslateActive = true;

  const style = document.createElement('style');
  style.id = 'zhi-translate-style';
  style.textContent = \`
    .zhi-translate-block {
      margin: 4px 0 8px 0;
      padding: 0 0 0 10px;
      background: transparent;
      border-left: 2px solid rgba(99, 102, 241, 0.45);
      font-size: inherit;
      line-height: inherit;
      font-family: inherit;
      color: inherit;
      opacity: 0.72;
      transition: opacity 0.2s ease, border-color 0.2s ease;
    }
    .zhi-translate-block.visible {
      opacity: 0.72;
    }
    .zhi-translate-block:hover {
      opacity: 0.95;
      border-left-color: rgba(99, 102, 241, 0.8);
    }
    .zhi-translate-inline {
      display: block;
      font-size: 0.94em;
      margin-top: 2px;
    }
    .zhi-translate-loading-wrap {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 4px 0;
      opacity: 0.48;
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

  const textBlockSelector = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd, summary, caption';
  const allElements = document.querySelectorAll(textBlockSelector);
  const toTranslate = [];
  const seen = new Set();

  for (const el of allElements) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
    if (el.offsetParent === null) continue;
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

    const hasTextBlockChild = Array.from(el.querySelectorAll(textBlockSelector)).some(
      child => child.innerText?.trim().length > 5
    );
    if (hasTextBlockChild) continue;

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
