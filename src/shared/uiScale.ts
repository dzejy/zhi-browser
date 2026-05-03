// Global chrome-UI scale factor. The renderer applies this via `zoom` on the
// document root, and both renderer and main multiply chrome layout offsets
// (sidebar widths, chrome heights, rail widths) by it so that the embedded
// WebContentsView for page content stays aligned with the visually-zoomed UI.
export const UI_SCALE = 1.3
