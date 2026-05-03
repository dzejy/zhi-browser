import './assets/main.css'

import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const Screenshot = lazy(() => import('./screenshot/Screenshot'))
const PinImage = lazy(() => import('./screenshot/PinImage'))
const CommandPalette = lazy(() => import('./command-palette/CommandPalette'))
const QuickNote = lazy(() => import('./quick-note/QuickNote'))
const ShortcutSettings = lazy(() => import('./shortcuts/ShortcutSettings'))
const InternalSettingsPage = lazy(() => import('./settings/InternalSettingsPage'))

function getRoute(): string {
  const hash = window.location.hash || ''
  return hash.replace(/^#\/?/, '')
}

function Root(): React.JSX.Element {
  const route = getRoute()
  if (route === 'screenshot') {
    return (
      <Suspense fallback={<div />}>
        <Screenshot />
      </Suspense>
    )
  }
  if (route === 'pin-image') {
    return (
      <Suspense fallback={<div />}>
        <PinImage />
      </Suspense>
    )
  }
  if (route === 'command-palette') {
    return (
      <Suspense fallback={<div />}>
        <CommandPalette />
      </Suspense>
    )
  }
  if (route === 'quick-note') {
    return (
      <Suspense fallback={<div />}>
        <QuickNote />
      </Suspense>
    )
  }
  if (route === 'shortcuts') {
    return (
      <Suspense fallback={<div />}>
        <ShortcutSettings />
      </Suspense>
    )
  }
  if (route === 'settings-page') {
    return (
      <Suspense fallback={<div />}>
        <InternalSettingsPage />
      </Suspense>
    )
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
