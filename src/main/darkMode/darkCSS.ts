import {
  DARK_BG_CARD,
  DARK_BG_COLOR,
  DARK_BG_DEEP,
  DARK_BG_INPUT,
  DARK_BG_RAISED,
  DARK_BG_SIDEBAR,
  DARK_BORDER,
  DARK_LINK,
  DARK_LINK_VISITED,
  DARK_TEXT,
  DARK_TEXT_HEADING,
  DARK_TEXT_MUTED
} from './constants'

// Lightweight CSS injected at navigation start to mask the Chromium white-frame
// before the page paints. Replaced (or removed for already-dark sites) on dom-ready.
export const DARK_MODE_INSTANT_CSS = `
:root {
  color-scheme: dark !important;
}

html,
body {
  background-color: ${DARK_BG_COLOR} !important;
  color-scheme: dark !important;
}
`

// Layered force CSS for sites that don't ship their own dark theme.
// Goal: keep the page's structural hierarchy readable, not flatten everything to one shade.
export const DARK_MODE_FORCE_CSS = `
:root {
  color-scheme: dark !important;
}

html,
body {
  background-color: ${DARK_BG_COLOR} !important;
  color-scheme: dark !important;
  color: ${DARK_TEXT} !important;
}

main,
article,
[role="main"],
.content,
#content,
.main,
#main {
  background-color: ${DARK_BG_RAISED} !important;
}

aside,
nav,
[role="complementary"],
[role="navigation"],
.sidebar,
.side-bar,
#sidebar {
  background-color: ${DARK_BG_SIDEBAR} !important;
}

header,
footer,
[role="banner"],
[role="contentinfo"],
.header,
.footer,
#header,
#footer {
  background-color: ${DARK_BG_DEEP} !important;
}

[class*="card"],
[class*="Card"],
[class*="modal"],
[class*="Modal"],
[class*="dialog"],
[class*="Dialog"],
[class*="popup"],
[class*="Popup"],
[class*="dropdown"],
[class*="Dropdown"],
[class*="popover"],
[class*="Popover"],
[class*="tooltip"],
[class*="Tooltip"],
[role="dialog"],
[role="menu"],
[role="tooltip"] {
  background-color: ${DARK_BG_CARD} !important;
  border-color: ${DARK_BORDER} !important;
}

h1, h2, h3, h4, h5, h6 {
  color: ${DARK_TEXT_HEADING} !important;
}

p, li, td, th, span, label, blockquote, dt, dd {
  color: ${DARK_TEXT} !important;
}

small,
caption,
figcaption,
[class*="muted"],
[class*="Muted"],
[class*="secondary"],
[class*="Secondary"],
[class*="hint"],
[class*="Hint"] {
  color: ${DARK_TEXT_MUTED} !important;
}

input,
textarea,
select {
  background-color: ${DARK_BG_INPUT} !important;
  color: ${DARK_TEXT} !important;
  border-color: ${DARK_BORDER} !important;
}

button {
  color: ${DARK_TEXT} !important;
  border-color: ${DARK_BORDER} !important;
}

a {
  color: ${DARK_LINK} !important;
}
a:visited {
  color: ${DARK_LINK_VISITED} !important;
}

img,
video,
canvas,
svg,
picture,
[style*="background-image"] {
  filter: none !important;
}
`

export const DARK_MODE_PRELOAD_CSS = `
html:not([data-theme="light"]):not(.light) {
  background-color: ${DARK_BG_COLOR};
}
`
