import type { Input } from 'electron'

const MODIFIER_ALIASES: Record<string, 'ctrl' | 'shift' | 'alt' | 'meta'> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  cmdorctrl: 'ctrl',
  commandorcontrol: 'ctrl',
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  super: 'meta',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  shift: 'shift'
}

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  ins: 'insert',
  del: 'delete',
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
  down: 'arrowdown',
  pageup: 'pageup',
  pagedown: 'pagedown',
  pgup: 'pageup',
  pgdn: 'pagedown',
  space: ' ',
  spacebar: ' ',
  plus: '+',
  add: '+',
  minus: '-',
  subtract: '-'
}

const CODE_TO_LITERAL: Record<string, string> = {
  Slash: '/',
  Backquote: '`',
  Backslash: '\\',
  Period: '.',
  Comma: ',',
  Quote: "'",
  Semicolon: ';',
  Equal: '=',
  Minus: '-',
  BracketLeft: '[',
  BracketRight: ']',
  IntlBackslash: '\\'
}

export interface ParsedAccelerator {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

function normalizeKeyToken(token: string): string {
  const lower = token.toLowerCase()
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower]
  return lower
}

export function parseAccelerator(accel: string): ParsedAccelerator | null {
  if (!accel || typeof accel !== 'string') return null
  // Special case: lone '+' means the plus key with no modifiers (rare)
  // Normal split by '+'; allow trailing '+' to mean the plus key
  const trimmed = accel.trim()
  if (!trimmed) return null

  // Split but preserve trailing '+' as a key part
  const parts: string[] = []
  let buf = ''
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === '+') {
      if (buf) {
        parts.push(buf)
        buf = ''
      } else if (i === trimmed.length - 1) {
        // trailing '+' alone — it's the literal '+' key
        parts.push('+')
      } else if (i > 0 && trimmed[i - 1] === '+') {
        // double '+' — treat the second as the literal
        parts.push('+')
      }
    } else {
      buf += ch
    }
  }
  if (buf) parts.push(buf)

  let ctrl = false
  let shift = false
  let alt = false
  let meta = false
  let key = ''
  for (const raw of parts) {
    const lower = raw.toLowerCase().trim()
    if (!lower) continue
    const mod = MODIFIER_ALIASES[lower]
    if (mod === 'ctrl') ctrl = true
    else if (mod === 'shift') shift = true
    else if (mod === 'alt') alt = true
    else if (mod === 'meta') meta = true
    else key = normalizeKeyToken(raw)
  }
  if (!key) return null
  return { ctrl, shift, alt, meta, key }
}

export function inputKeyCandidates(input: Input): string[] {
  const out: string[] = []
  const k = input.key.toLowerCase()
  out.push(k)
  // KEY_ALIASES values may already match (e.g. 'arrowleft')
  if (input.code && CODE_TO_LITERAL[input.code]) {
    const lit = CODE_TO_LITERAL[input.code].toLowerCase()
    if (!out.includes(lit)) out.push(lit)
  }
  // Map digit codes (Digit1..Digit9, Numpad1..Numpad9) to '1'..'9'
  if (input.code) {
    const digitMatch = /^(?:Digit|Numpad)([0-9])$/.exec(input.code)
    if (digitMatch && !out.includes(digitMatch[1])) out.push(digitMatch[1])
    const fnMatch = /^F([1-9]|1[0-9]|2[0-4])$/.exec(input.code)
    if (fnMatch) {
      const fn = `f${fnMatch[1]}`
      if (!out.includes(fn)) out.push(fn)
    }
    const letterMatch = /^Key([A-Z])$/.exec(input.code)
    if (letterMatch) {
      const letter = letterMatch[1].toLowerCase()
      if (!out.includes(letter)) out.push(letter)
    }
  }
  return out
}

export function matchInputToAccelerator(input: Input, accel: string): boolean {
  const parsed = parseAccelerator(accel)
  if (!parsed) return false
  const ctrlPressed = !!(input.control || input.meta) // treat Ctrl/Cmd as same on cross-platform
  if (parsed.ctrl !== ctrlPressed) return false
  if (parsed.alt !== !!input.alt) return false
  if (parsed.shift !== !!input.shift) return false
  // Meta: only enforce explicit meta-without-ctrl combos; for cross-platform we already folded meta into ctrl
  // (so don't separately check meta)
  const candidates = inputKeyCandidates(input)
  if (candidates.includes(parsed.key)) return true
  // Allow '+' / '=' interchangeable for zoom shortcuts
  if (parsed.key === '+' && (candidates.includes('=') || candidates.includes('+'))) return true
  if (parsed.key === '=' && (candidates.includes('=') || candidates.includes('+'))) return true
  return false
}

export function formatAcceleratorFromEvent(e: {
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  key: string
  code?: string
}): string | null {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  // Reject pure modifier presses
  const k = e.key
  if (
    k === 'Control' ||
    k === 'Shift' ||
    k === 'Alt' ||
    k === 'Meta' ||
    k === 'Hyper' ||
    k === 'Super' ||
    k === 'CapsLock' ||
    k === 'Dead'
  ) {
    return null
  }

  let label = k
  // Use input.code-derived literal for symbol keys when shift is held (to keep '/' instead of '?')
  if (e.code && CODE_TO_LITERAL[e.code]) {
    label = CODE_TO_LITERAL[e.code]
  } else if (e.code) {
    const digitMatch = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)
    if (digitMatch) label = digitMatch[1]
    const fnMatch = /^F([1-9]|1[0-9]|2[0-4])$/.exec(e.code)
    if (fnMatch) label = `F${fnMatch[1]}`
    const letterMatch = /^Key([A-Z])$/.exec(e.code)
    if (letterMatch) label = letterMatch[1]
  }

  // Normalize a few well-known names
  const friendly: Record<string, string> = {
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    Escape: 'Escape',
    Tab: 'Tab',
    Enter: 'Enter',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ' ': 'Space'
  }
  if (friendly[label]) label = friendly[label]
  if (label.length === 1) label = label.toUpperCase()

  parts.push(label)
  return parts.join('+')
}
