import { DARK_BG_COLOR } from './constants'

export const DARK_MODE_BASE_CSS = `
html,
body {
  background-color: ${DARK_BG_COLOR} !important;
  color-scheme: dark !important;
}

:root {
  color-scheme: dark !important;
}
`

export const DARK_MODE_FORCE_CSS = `
${DARK_MODE_BASE_CSS}

body,
main,
article,
section,
aside,
header,
footer,
nav,
[class*="page"],
[class*="Page"],
[class*="wrap"],
[class*="Wrap"],
[class*="container"],
[class*="Container"],
[class*="layout"],
[class*="Layout"],
[class*="content"],
[class*="Content"],
[id*="page"],
[id*="wrap"],
[id*="container"],
[id*="layout"],
[id*="content"] {
  background-color: ${DARK_BG_COLOR} !important;
  color: #e0e0e0 !important;
}

input,
textarea,
select,
button {
  background-color: #242424 !important;
  color: #e0e0e0 !important;
  border-color: #3a3a3a !important;
}

a {
  color: #8ab4f8 !important;
}

body :where(p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, label, strong, em, small):not(a) {
  color: #e0e0e0 !important;
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
