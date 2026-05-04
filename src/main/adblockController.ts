import type { Session } from 'electron'
import type { AdBlockBlockRecord, AdBlockState } from '../shared/types'
import type { DeepPartial, Preferences } from '../shared/preferences'
import { BUILTIN_ADBLOCK_RULES, matchesAdRule } from './adblockRules'

interface AdBlockControllerOptions {
  session: Session
  getPreferences: () => Preferences
  updatePreferences: (partial: DeepPartial<Preferences>) => Preferences
  sendToUI: (channel: string, payload: unknown) => void
  ignoredWebContentsIds?: number[]
}

export class AdBlockController {
  private readonly session: Session
  private readonly getPrefs: () => Preferences
  private readonly updatePrefs: (partial: DeepPartial<Preferences>) => Preferences
  private readonly sendToUI: (channel: string, payload: unknown) => void
  private readonly ignoredWebContentsIds: number[]
  private listenerRegistered = false
  private blockedCountBuffer = 0
  private blockedHistoryBuffer: AdBlockBlockRecord[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: AdBlockControllerOptions) {
    this.session = options.session
    this.getPrefs = options.getPreferences
    this.updatePrefs = options.updatePreferences
    this.sendToUI = options.sendToUI
    this.ignoredWebContentsIds = options.ignoredWebContentsIds || []
  }

  start(): void {
    if (this.listenerRegistered) return
    this.listenerRegistered = true

    this.session.webRequest.onBeforeRequest((details, callback) => {
      try {
        if (
          typeof details.webContentsId === 'number' &&
          this.ignoredWebContentsIds.includes(details.webContentsId)
        ) {
          callback({ cancel: false })
          return
        }
        const prefs = this.getPrefs()
        if (!prefs.adblock.enabled) {
          callback({ cancel: false })
          return
        }

        if (!details.url.startsWith('http://') && !details.url.startsWith('https://')) {
          callback({ cancel: false })
          return
        }

        if (this.isRequestFromWhitelistedSite(details, prefs.adblock.whitelist)) {
          callback({ cancel: false })
          return
        }

        const matched = matchesAdRule(details.url, details.resourceType, BUILTIN_ADBLOCK_RULES)
        if (matched) {
          this.recordBlockedRequest(details)
          callback({ cancel: true })
          return
        }

        callback({ cancel: false })
      } catch {
        callback({ cancel: false })
      }
    })
  }

  stop(): void {
    if (!this.listenerRegistered) return
    this.session.webRequest.onBeforeRequest(null)
    this.listenerRegistered = false
  }

  getState(): AdBlockState {
    const prefs = this.getPrefs()
    return {
      enabled: prefs.adblock.enabled,
      whitelist: [...prefs.adblock.whitelist],
      blockedCount: prefs.adblock.blockedCount
    }
  }

  setEnabled(enabled: boolean): AdBlockState {
    this.updatePrefs({ adblock: { enabled } })
    const state = this.getState()
    this.notifyUI(state)
    return state
  }

  addWhitelist(hostname: string): AdBlockState {
    const normalized = this.normalizeHostname(hostname)
    if (!normalized) return this.getState()
    const prefs = this.getPrefs()
    const whitelist = [...prefs.adblock.whitelist]
    if (!whitelist.includes(normalized)) {
      whitelist.push(normalized)
      this.updatePrefs({ adblock: { whitelist } })
    }
    const state = this.getState()
    this.notifyUI(state)
    return state
  }

  removeWhitelist(hostname: string): AdBlockState {
    const normalized = this.normalizeHostname(hostname)
    if (!normalized) return this.getState()
    const whitelist = this.getPrefs().adblock.whitelist.filter((entry) => entry !== normalized)
    this.updatePrefs({ adblock: { whitelist } })
    const state = this.getState()
    this.notifyUI(state)
    return state
  }

  clearBlockedCount(): AdBlockState {
    this.blockedCountBuffer = 0
    this.updatePrefs({ adblock: { blockedCount: 0 } })
    const state = this.getState()
    this.notifyUI(state)
    return state
  }

  getBlockHistory(): AdBlockBlockRecord[] {
    return [...(this.getPrefs().adblock.blockHistory || [])]
  }

  clearBlockHistory(): AdBlockBlockRecord[] {
    this.blockedHistoryBuffer = []
    this.updatePrefs({ adblock: { blockHistory: [] } })
    return []
  }

  isWhitelisted(url: string): boolean {
    try {
      return this.hostnameInList(new URL(url).hostname, this.getPrefs().adblock.whitelist)
    } catch {
      return false
    }
  }

  private isRequestFromWhitelistedSite(
    details: Electron.OnBeforeRequestListenerDetails,
    whitelist: string[]
  ): boolean {
    try {
      const requestHostname = new URL(details.url).hostname
      if (this.hostnameInList(requestHostname, whitelist)) return true

      if (details.referrer) {
        const referrerHostname = new URL(details.referrer).hostname
        if (this.hostnameInList(referrerHostname, whitelist)) return true
      }

      return false
    } catch {
      return false
    }
  }

  private hostnameInList(hostname: string, whitelist: string[]): boolean {
    return whitelist.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`))
  }

  private recordBlockedRequest(details: Electron.OnBeforeRequestListenerDetails): void {
    this.blockedCountBuffer++
    const record = this.createBlockRecord(details)
    if (record) {
      this.blockedHistoryBuffer.unshift(record)
      this.blockedHistoryBuffer = this.blockedHistoryBuffer.slice(0, 50)
    }
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      const prefs = this.getPrefs()
      const blockedCount = prefs.adblock.blockedCount + this.blockedCountBuffer
      const blockHistory = [
        ...this.blockedHistoryBuffer,
        ...(prefs.adblock.blockHistory || [])
      ].slice(0, 200)
      this.blockedCountBuffer = 0
      this.blockedHistoryBuffer = []
      this.updatePrefs({ adblock: { blockedCount, blockHistory } })
      this.notifyUI(this.getState())
    }, 500)
  }

  private createBlockRecord(
    details: Electron.OnBeforeRequestListenerDetails
  ): AdBlockBlockRecord | null {
    try {
      const requestUrl = new URL(details.url)
      const pageUrl = details.referrer || (details as { initiator?: string }).initiator || ''
      let pageHostname = ''
      if (pageUrl) {
        try {
          pageHostname = new URL(pageUrl).hostname
        } catch {
          pageHostname = ''
        }
      }
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url: details.url,
        hostname: requestUrl.hostname,
        resourceType: details.resourceType,
        pageUrl,
        pageHostname,
        blockedAt: Date.now()
      }
    } catch {
      return null
    }
  }

  private notifyUI(state: AdBlockState): void {
    this.sendToUI('adblock:state-changed', state)
  }

  private normalizeHostname(input: string): string {
    let hostname = input.trim().toLowerCase()
    if (hostname.startsWith('http://')) hostname = hostname.slice(7)
    if (hostname.startsWith('https://')) hostname = hostname.slice(8)
    const slashIdx = hostname.indexOf('/')
    if (slashIdx >= 0) hostname = hostname.slice(0, slashIdx)
    const colonIdx = hostname.indexOf(':')
    if (colonIdx >= 0) hostname = hostname.slice(0, colonIdx)
    if (!hostname || hostname.includes(' ') || !hostname.includes('.')) return ''
    return hostname
  }
}
