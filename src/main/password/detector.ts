export const PASSWORD_DETECTOR_SCRIPT = `
(() => {
  if (window.__zhiPasswordHookInstalled) return
  window.__zhiPasswordHookInstalled = true

  function findFields(form) {
    const pwd = form.querySelector('input[type="password"]')
    if (!pwd) return null
    let user = null
    const inputs = form.querySelectorAll('input')
    for (const i of inputs) {
      if (i === pwd) break
      const t = (i.type || '').toLowerCase()
      if (t === 'text' || t === 'email' || t === 'tel' || t === '') {
        user = i
      }
    }
    if (!user) {
      for (const i of inputs) {
        const t = (i.type || '').toLowerCase()
        if (t !== 'password' && t !== 'submit' && t !== 'button' && t !== 'hidden') {
          user = i
          break
        }
      }
    }
    return { user, pwd }
  }

  function notifySubmit(form) {
    const fields = findFields(form)
    if (!fields) return
    const username = (fields.user?.value || '').trim()
    const password = fields.pwd.value
    if (!password) return
    try {
      window.electronPasswordDetect &&
        window.electronPasswordDetect({
          username,
          password,
          url: location.href,
          title: document.title || location.hostname
        })
    } catch {}
  }

  document.addEventListener(
    'submit',
    (e) => {
      const t = e.target
      if (t && t.tagName === 'FORM') notifySubmit(t)
    },
    true
  )

  document.addEventListener(
    'click',
    (e) => {
      const t = e.target
      if (!t) return
      const tag = (t.tagName || '').toLowerCase()
      const role = (t.getAttribute && t.getAttribute('role')) || ''
      const isSubmit =
        (tag === 'button' && (t.type === 'submit' || !t.type)) ||
        (tag === 'input' && t.type === 'submit') ||
        role === 'button'
      if (!isSubmit) return
      const form = t.closest && t.closest('form')
      if (form) {
        setTimeout(() => notifySubmit(form), 50)
      } else {
        const pwd = document.querySelector('input[type="password"]')
        if (pwd) {
          const fakeForm = { querySelector: (s) => document.querySelector(s), querySelectorAll: (s) => document.querySelectorAll(s) }
          notifySubmit(fakeForm)
        }
      }
    },
    true
  )

  function tryAutoFillPrompt() {
    const pwd = document.querySelector('input[type="password"]')
    if (pwd) {
      try {
        window.electronPasswordCheck && window.electronPasswordCheck(location.href)
      } catch {}
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(tryAutoFillPrompt, 200)
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(tryAutoFillPrompt, 200))
  }
})()
`

export function buildAutofillScript(username: string, password: string): string {
  const u = JSON.stringify(username)
  const p = JSON.stringify(password)
  return `(() => {
  const pwd = document.querySelector('input[type="password"]')
  if (!pwd) return false
  let user = null
  let parent = pwd.closest('form') || document
  const inputs = parent.querySelectorAll('input')
  for (const i of inputs) {
    if (i === pwd) break
    const t = (i.type || '').toLowerCase()
    if (t === 'text' || t === 'email' || t === 'tel' || t === '') user = i
  }
  function setVal(el, v) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (user) setVal(user, ${u})
  setVal(pwd, ${p})
  return true
})()`
}
