# Zhi Browser

**Zhi Browser** is a personal AI-assisted desktop browser project built with Electron, React, TypeScript, Electron Vite, and WebContentsView.

Current stable version: **1.0.0S Stable**

Zhi Browser is designed as a private personal browser shell with built-in AI tools for webpage reading, summarization, verification, search, and counter-argument analysis. The project keeps a traditional horizontal tab layout while gradually adding AI-assisted browsing workflows and a more polished desktop-app experience.

---

## Download

The official Windows installer is available from the GitHub Releases page.

Latest stable installer:

**Zhi Browser Setup 1.0.0S.exe**

This is the recommended version for normal installation and use.

The `win-unpacked` build is mainly used for local testing and development. Normal users should download the `Setup.exe` installer from Releases.

---

## Current Version: 1.0.0S Stable

`1.0.0S` is the first stable packaged version of Zhi Browser.

The letter **S** means **Stable**. This version is used as the stable baseline before the next visual polish branch.

This version includes the main usable browser foundation:

- Multi-tab browsing
- Horizontal tab layout
- Address bar navigation
- Browser toolbar
- WebContentsView-based page rendering
- Electron BaseWindow architecture
- Settings center
- Independent AI settings page
- AI sidebar
- AI webpage tools
- History panel
- Bookmarks panel
- Downloads panel
- ADB-related entry
- Dark visual style
- Custom red Zhi “Z” icon
- Windows NSIS installer package

The project is currently about **70% complete** as a personal daily-use browser prototype.

---

## Main Features

### Browser Core

Zhi Browser provides the basic foundation of a desktop browser:

- Multi-tab browsing
- Horizontal tab bar
- Address bar navigation
- Back, forward, and refresh controls
- Side panels
- Persistent settings foundation
- Dark desktop-style user interface
- Electron + WebContentsView rendering structure

The project uses the Electron `BaseWindow + WebContentsView` route rather than the older `<webview>` route.

---

### AI Workflow

Zhi Browser includes a built-in AI sidebar and several webpage-oriented AI tools.

The AI workflow is designed around the current webpage instead of acting only as a generic chat box.

Current AI actions include:

| Feature Name | Purpose |
| --- | --- |
| 省流版本 | Summarize the current webpage |
| 丁真一下 | Verify facts and check possible errors |
| 全网通缉 | Search for related information and external context |
| 大司马模式 | Generate counter-arguments and expose weak logic |

The goal is to make AI part of the browsing workflow:

1. Open a webpage.
2. Call the AI sidebar.
3. Use AI to summarize, verify, search, or challenge the page.
4. Continue reading with more context and better judgment.

---

### Settings and Panels

Zhi Browser currently includes:

- General settings
- Independent AI settings page
- AI sidebar
- History panel
- Bookmarks panel
- Downloads panel
- ADB-related entry
- Search engine configuration foundation
- API / model configuration foundation

AI settings have been separated from the general settings page so future AI providers, API keys, model choices, and search-related options can be managed more clearly.

---

## Visual Direction

Zhi Browser uses a dark, compact, desktop-app style interface.

The current visual direction is inspired by modern browsers such as Arc and Zen, but Zhi Browser keeps its own horizontal tab layout instead of switching to a vertical sidebar model.

The 1.0.0S version focuses on stability and core usability.

The next branch will focus on visual polishing and product feel.

---

## Version Plan

### 1.0.0S Stable

Status: released / ready for GitHub Release

Purpose: stable baseline before further visual polish

Installer file:

**Zhi Browser Setup 1.0.0S.exe**

This version should be treated as the current stable packaged version.

---

### 1.0.0-B Visual Polish

Status: next branch

Purpose: visual refinement version based on 1.0.0S

The letter **B** means **Beauty / Visual Polish**.

Planned focus:

- Stronger product feel
- Cleaner panels
- Better micro-interactions
- More polished AI sidebar
- Better browser chrome visual consistency
- More comfortable daily-use interface
- Further Arc / Zen-inspired refinement while keeping the horizontal tab layout

The 1.0.0-B branch should be developed from the stable 1.0.0S baseline.

---

## Tech Stack

- Electron
- Electron Vite
- React
- TypeScript
- CSS
- WebContentsView
- Electron Builder
- NSIS Windows installer

---

## Packaging

Windows packaging is handled through Electron Builder and NSIS.

The official Windows installer is generated under:

`dist/Zhi Browser Setup 1.0.0.exe`

For GitHub Release, the installer is renamed and published as:

`Zhi Browser Setup 1.0.0S.exe`

The app icon and installer artwork are stored under:

- `build/icon.ico`
- `build/icon.png`
- `build/installerHeader.bmp`
- `build/installerSidebar.bmp`

The official Zhi Browser icon is the red **Z** logo.

---

## Project Status

Zhi Browser has completed its main foundation stage.

Current status:

- Core browser features landed
- AI sidebar landed
- AI settings page landed
- Webpage AI workflow landed
- Dark UI foundation landed
- P10 accepted
- Windows installer generated
- 1.0.0S stable release prepared
- 1.0.0-B visual polish branch planned

The project will continue from the stable 1.0.0S baseline.

---

## Notes

This is a personal AI-assisted browser project.

The current goal is not to compete with full commercial browsers, but to build a usable, customizable, AI-enhanced personal browser with a clear development path.

1.0.0S is the first stable milestone.

1.0.0-B will focus on making the browser look and feel more polished.
