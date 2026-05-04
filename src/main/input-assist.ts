import type { WebContents } from 'electron'

const INPUT_ASSIST_SCRIPT = `
(() => {
  if (window.__zhiInputAssistInstalled) return
  window.__zhiInputAssistInstalled = true

  const HOLDER_ID = '__zhi_input_assist_holder__'
  const STYLE_ID = '__zhi_input_assist_style__'
  let activeInput = null
  let revealMode = false
  let freezeHideUntil = 0

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = \`
      #\${HOLDER_ID} {
        position: fixed;
        z-index: 2147483647;
        display: none;
        gap: 4px;
        align-items: center;
      }
      #\${HOLDER_ID} button {
        width: 22px;
        height: 22px;
        border: 1px solid rgba(0, 0, 0, .18);
        border-radius: 6px;
        background: rgba(255, 255, 255, .92);
        color: rgba(40, 40, 45, .9);
        font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        cursor: pointer;
        padding: 0;
        user-select: none;
      }
      #\${HOLDER_ID} button:hover {
        background: rgba(245, 245, 248, .98);
      }
      #\${HOLDER_ID} button[hidden] {
        display: none !important;
      }
      @media (prefers-color-scheme: dark) {
        #\${HOLDER_ID} button {
          background: rgba(33, 35, 41, .96);
          color: rgba(236, 239, 245, .95);
          border-color: rgba(255, 255, 255, .16);
        }
        #\${HOLDER_ID} button:hover {
          background: rgba(50, 53, 62, .98);
        }
      }
    \`
    document.documentElement.appendChild(style)
  }

  function ensureHolder() {
    let holder = document.getElementById(HOLDER_ID)
    if (holder) return holder
    holder = document.createElement('div')
    holder.id = HOLDER_ID
    holder.setAttribute('aria-hidden', 'true')

    const revealBtn = document.createElement('button')
    revealBtn.type = 'button'
    revealBtn.title = '显示密码'
    revealBtn.textContent = '👁'
    revealBtn.addEventListener('mousedown', (e) => e.preventDefault())
    revealBtn.addEventListener('click', () => {
      if (!activeInput || activeInput.type !== 'password' && activeInput.type !== 'text') return
      revealMode = !revealMode
      try {
        activeInput.type = revealMode ? 'text' : 'password'
      } catch {}
      revealBtn.title = revealMode ? '隐藏密码' : '显示密码'
      revealBtn.textContent = revealMode ? '🙈' : '👁'
      sync()
      queueMicrotask(() => activeInput && activeInput.focus())
    })

    const clearBtn = document.createElement('button')
    clearBtn.type = 'button'
    clearBtn.title = '清空输入'
    clearBtn.textContent = '×'
    clearBtn.addEventListener('mousedown', (e) => e.preventDefault())
    clearBtn.addEventListener('click', () => {
      if (!activeInput) return
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      if (setter) {
        setter.call(activeInput, '')
      } else {
        activeInput.value = ''
      }
      activeInput.dispatchEvent(new Event('input', { bubbles: true }))
      activeInput.dispatchEvent(new Event('change', { bubbles: true }))
      sync()
      queueMicrotask(() => activeInput && activeInput.focus())
    })

    holder.appendChild(revealBtn)
    holder.appendChild(clearBtn)
    document.documentElement.appendChild(holder)
    return holder
  }

  function isSupportedInput(node) {
    if (!(node instanceof HTMLInputElement)) return false
    if (node.disabled || node.readOnly) return false
    const t = (node.type || 'text').toLowerCase()
    return t === 'text' || t === 'search' || t === 'email' || t === 'url' || t === 'password'
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect()
    if (r.width < 28 || r.height < 20) return false
    if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || '1') > 0
  }

  function place(holder, input) {
    const rect = input.getBoundingClientRect()
    const top = Math.max(2, rect.top + Math.max(1, (rect.height - 22) / 2))
    const right = window.innerWidth - rect.right + 6
    holder.style.top = top + 'px'
    holder.style.right = Math.max(2, right) + 'px'
  }

  function hideNow() {
    const holder = document.getElementById(HOLDER_ID)
    if (holder) holder.style.display = 'none'
  }

  function sync() {
    const holder = ensureHolder()
    if (!activeInput || !isSupportedInput(activeInput) || !isVisible(activeInput)) {
      holder.style.display = 'none'
      return
    }
    const revealBtn = holder.children[0]
    const clearBtn = holder.children[1]
    const t = (activeInput.type || 'text').toLowerCase()
    const canReveal = t === 'password' || (revealMode && t === 'text')
    revealBtn.hidden = !canReveal
    const hasValue = Boolean(activeInput.value && activeInput.value.length > 0)
    clearBtn.hidden = !hasValue
    if (revealBtn.hidden && clearBtn.hidden) {
      holder.style.display = 'none'
      return
    }
    place(holder, activeInput)
    holder.style.display = 'inline-flex'
  }

  function bindInput(input) {
    activeInput = input
    revealMode = false
    input.addEventListener('input', sync, { passive: true })
    input.addEventListener('keyup', sync, { passive: true })
    sync()
  }

  ensureStyle()
  ensureHolder()

  document.addEventListener('focusin', (e) => {
    const t = e.target
    if (!isSupportedInput(t)) return
    bindInput(t)
  }, true)

  document.addEventListener('focusout', () => {
    freezeHideUntil = Date.now() + 150
    setTimeout(() => {
      if (Date.now() < freezeHideUntil) return
      const ae = document.activeElement
      if (!isSupportedInput(ae)) {
        activeInput = null
        hideNow()
      }
    }, 140)
  }, true)

  window.addEventListener('scroll', sync, true)
  window.addEventListener('resize', sync)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hideNow()
    else sync()
  })
})()
`

export function bindInputAssist(wc: WebContents): void {
  const inject = (): void => {
    const url = wc.getURL()
    if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) return
    wc.executeJavaScript(INPUT_ASSIST_SCRIPT, true).catch(() => {})
  }
  wc.on('did-finish-load', inject)
  wc.on('did-frame-finish-load', (_event, isMainFrame) => {
    if (isMainFrame) inject()
  })
}

