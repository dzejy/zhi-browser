import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare global {
  interface WebviewNavigationEvent extends Event {
    url: string
    isMainFrame?: boolean
  }

  interface BrowserWebviewElement extends HTMLElement {
    canGoBack(): boolean
    canGoForward(): boolean
    goBack(): void
    goForward(): void
    reload(): void
    stop(): void
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<BrowserWebviewElement>, BrowserWebviewElement> & {
        src?: string
        partition?: string
      }
    }
  }
}

export {}
