# Zhi Browser 当前网页暗色模式实现总结

本文档仅整理当前暗色模式相关代码，方便审核和讨论。源代码文件未在本文档生成过程中修改。

## 涉及文件

- `src/main/dark-mode.ts`
  - 定义暗色模式注入 CSS。
  - 通过 `webContents.insertCSS` / `removeInsertedCSS` 管理网页暗色 CSS。
  - 用 `Map<webContents.id, cssKey>` 保存每个页面的 CSS key。

- `src/main/tabs.ts`
  - 每个 tab 创建一个网页 `WebContentsView`。
  - 每个 tab 额外创建一个 `darkModeOverlay: View` 黑色遮罩。
  - 导航开始时显示遮罩并注入暗色 CSS。
  - `dom-ready` / `did-stop-loading` 后检测暗色 CSS 是否生效，生效后隐藏遮罩。

- `src/main/index.ts`
  - 注册 `darkMode:toggle` 和 `darkMode:get` IPC。
  - 切换偏好设置 `webDarkMode`。
  - 对所有已打开 tab 注入或移除暗色 CSS。

- `src/shared/preferences.ts`
  - `Preferences` 增加 `webDarkMode: boolean`。
  - 默认值是 `false`。
  - 迁移/清洗偏好时保证该字段为 boolean。

- `src/main/settings.ts`
  - 允许 `updateSettings` / `updatePreferences` 更新 `webDarkMode`。

- `src/preload/index.ts` / `src/preload/index.d.ts`
  - 暴露 `toggleDarkMode()` 和 `getDarkMode()` 给渲染进程。

- `src/renderer/src/App.tsx`
  - 主界面维护 `webDarkMode` state。
  - 工具栏有网页暗色模式按钮。
  - 设置面板中也有网页暗色模式开关。

## 当前主流程

### 开启暗色模式

1. 用户点击工具栏按钮或设置开关。
2. Renderer 调用 `window.api.toggleDarkMode()`。
3. Preload 转发到主进程 IPC：`darkMode:toggle`。
4. 主进程读取当前活动 tab 是否已注入暗色 CSS：
   - 如果当前活动 tab 未注入，则新状态为开启。
   - 如果当前活动 tab 已注入，则新状态为关闭。
5. 主进程写入 preferences：`webDarkMode = newState`。
6. 主进程遍历所有已打开 tab：
   - 开启时：设置 view 背景为 `#111111`，调用 `injectDarkMode(view.webContents)`。
   - 关闭时：设置 view 背景为 `#ffffff`，调用 `removeDarkMode(view.webContents)`。

### 新页面加载时

1. 创建 tab 时，根据 `prefs.webDarkMode` 设置网页 view 底色：
   - 暗色开启：`#111111`
   - 暗色关闭：`#ffffff`
2. 每个 tab 同时创建一个黑色 `darkModeOverlay`。
3. 在以下场景调用 `prepareDarkModeForNavigation(tab)`：
   - 新 tab 初次 `loadURL` 前。
   - 地址栏导航 `loadUrl` 前。
   - 后退前。
   - 前进前。
   - 刷新前。
   - `did-start-loading`。
   - `did-start-navigation` 主 frame。
   - `dom-ready`。
4. `prepareDarkModeForNavigation` 在暗色开启时：
   - 将网页 view 背景设为 `#111111`。
   - 显示黑色遮罩 `darkModeOverlay.setVisible(true)`。
   - 调用 `injectDarkMode(webContents)`。
5. 在 `dom-ready` 和 `did-stop-loading` 调用 `revealAfterDarkModeNavigation(tab)`。
6. `revealAfterDarkModeNavigation` 会：
   - 再次调用 `injectDarkMode(webContents)`。
   - 执行 `isDarkModeApplied(tab)` 检查 `document.documentElement` 的 computed `filter` 是否已生效。
   - 如果检测通过，隐藏遮罩：`darkModeOverlay.setVisible(false)`。

## `src/main/dark-mode.ts`

```ts
import { WebContents } from 'electron'

const DARK_MODE_CSS = `
  html,
  body {
    background: #fff !important;
    color-scheme: light !important;
  }

  html {
    filter: invert(0.9) hue-rotate(180deg) !important;
  }

  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -2147483647;
    pointer-events: none;
    background: #fff !important;
  }

  body,
  body > div,
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
    background-color: #fff !important;
  }

  img, video, canvas, svg, picture,
  [style*="background-image"],
  .emoji, .avatar {
    filter: invert(1) hue-rotate(180deg) !important;
  }
  iframe {
    filter: invert(1) hue-rotate(180deg) !important;
  }
`

const darkModeKeys = new Map<number, string>()

export async function injectDarkMode(webContents: WebContents): Promise<void> {
  if (webContents.isDestroyed()) return
  const oldKey = darkModeKeys.get(webContents.id)
  try {
    const key = await webContents.insertCSS(DARK_MODE_CSS, { cssOrigin: 'user' })
    darkModeKeys.set(webContents.id, key)
    if (oldKey && oldKey !== key) {
      await webContents.removeInsertedCSS(oldKey).catch(() => {
        // Ignore stale keys after navigation.
      })
    }
  } catch {
    // webContents may be navigating or destroyed.
  }
}

export async function removeDarkMode(webContents: WebContents): Promise<void> {
  const key = darkModeKeys.get(webContents.id)
  if (key) {
    try {
      await webContents.removeInsertedCSS(key)
    } catch {
      // Ignore stale keys after navigation.
    }
    darkModeKeys.delete(webContents.id)
  }
}

export function isDarkModeInjected(webContents: WebContents): boolean {
  return darkModeKeys.has(webContents.id)
}

export function cleanupDarkMode(webContents: WebContents): void {
  darkModeKeys.delete(webContents.id)
}
```

## `src/main/tabs.ts` 关键结构

### import

```ts
import { WebContentsView, BaseWindow, Menu, MenuItemConstructorOptions, clipboard, View } from 'electron'
import { injectDarkMode, cleanupDarkMode } from './dark-mode'
```

### tab 数据结构

```ts
interface ManagedTab {
  id: string
  view: WebContentsView
  darkModeOverlay: View
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: LoadError | null
  isPinned: boolean
  zoomFactor: number
  isNewTab: boolean
  isAudible: boolean
  isMuted: boolean
  wwwFallbackAttempted: boolean
}
```

### 创建 tab 时创建遮罩

```ts
const view = new WebContentsView({
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
})
view.setBackgroundColor(prefs.webDarkMode ? '#111111' : '#ffffff')

const darkModeOverlay = new View()
darkModeOverlay.setBackgroundColor('#111111')
darkModeOverlay.setVisible(false)
view.addChildView(darkModeOverlay)

const tab: ManagedTab = {
  id,
  view,
  darkModeOverlay,
  url: targetUrl || 'about:blank',
  ...
}
```

### 布局时同步遮罩尺寸

```ts
updateLayout(): void {
  const { width, height } = this.win.getContentBounds()
  const uiHeight = Math.max(0, Math.min(this.uiViewHeight, height))
  this.uiView.setBounds({ x: 0, y: 0, width, height: uiHeight })

  const activeTab = this.tabs.get(this.activeTabId)
  if (activeTab) {
    const pageHeight = Math.max(0, height - this.pageTop)
    activeTab.view.setBounds({
      x: 0,
      y: this.pageTop,
      width,
      height: pageHeight
    })
    activeTab.darkModeOverlay.setBounds({ x: 0, y: 0, width, height: pageHeight })
  }
}
```

### 导航生命周期

```ts
wc.on('did-start-loading', () => {
  this.prepareDarkModeForNavigation(tab)
  tab.isLoading = true
  tab.isNewTab = false
  this.uiView.webContents.send('browser:hover-url', '')
  this.updatePageHoverUrl(tab, '')
  this.pushState()
})

wc.on('did-stop-loading', () => {
  tab.isLoading = false
  tab.canGoBack = wc.navigationHistory.canGoBack()
  tab.canGoForward = wc.navigationHistory.canGoForward()
  this.revealAfterDarkModeNavigation(tab)
  this.pushState()
})

wc.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
  if (!isMainFrame) return
  this.prepareDarkModeForNavigation(tab)
})

wc.on('dom-ready', () => {
  this.prepareDarkModeForNavigation(tab)
  this.revealAfterDarkModeNavigation(tab)
})

wc.on('destroyed', () => {
  cleanupDarkMode(wc)
})
```

### 遮罩显示和隐藏逻辑

```ts
private prepareDarkModeForNavigation(tab: ManagedTab): void {
  const enabled = getPreferences().webDarkMode
  tab.view.setBackgroundColor(enabled ? '#111111' : '#ffffff')
  if (enabled) {
    tab.darkModeOverlay.setVisible(true)
    injectDarkMode(tab.view.webContents).catch(() => {
      /* page may reject user CSS while navigating */
    })
  } else {
    tab.darkModeOverlay.setVisible(false)
  }
}

private revealAfterDarkModeNavigation(tab: ManagedTab): void {
  const enabled = getPreferences().webDarkMode
  if (enabled) {
    injectDarkMode(tab.view.webContents)
      .catch(() => {
        /* page may reject user CSS while navigating */
      })
      .then(() => this.isDarkModeApplied(tab))
      .then((applied) => {
        if (applied) {
          tab.darkModeOverlay.setVisible(false)
        }
      })
      .catch(() => {
        /* keep the overlay until a later navigation event can verify dark mode */
      })
  } else {
    tab.darkModeOverlay.setVisible(false)
  }
}

private async isDarkModeApplied(tab: ManagedTab): Promise<boolean> {
  if (tab.view.webContents.isDestroyed()) return false
  return tab.view.webContents
    .executeJavaScript(
      `
        (() => {
          const root = document.documentElement
          if (!root || document.readyState === 'loading') return false
          const filter = window.getComputedStyle(root).filter
          return Boolean(filter && filter !== 'none')
        })()
      `,
      true
    )
    .catch(() => false)
}
```

## `src/main/index.ts` 暗色模式 IPC

```ts
ipcMain.handle('darkMode:toggle', async (event) => {
  if (!validateSender(event)) return false
  const prefs = getPreferences()
  const activeView = tabManager.getActiveTabView()
  const newState = activeView ? !isDarkModeInjected(activeView.webContents) : !prefs.webDarkMode
  updatePreferences({ webDarkMode: newState })
  win.setBackgroundColor(newState ? '#111111' : '#1f2127')

  const views = tabManager.getAllTabViews()
  for (const view of views) {
    view.setBackgroundColor(newState ? '#111111' : '#ffffff')
    if (newState) {
      await injectDarkMode(view.webContents).catch(() => {
        /* page may reject user CSS while navigating */
      })
    } else {
      await removeDarkMode(view.webContents)
    }
  }

  const updated = getSettings()
  sendToUi('browser:settings', updated)
  sendToPanel('browser:settings', updated)
  return newState
})

ipcMain.handle('darkMode:get', (event) => {
  if (!validateSender(event)) return false
  return getPreferences().webDarkMode
})
```

## Renderer / Preload 接口

### `src/preload/index.ts`

```ts
toggleDarkMode: (): Promise<boolean> => ipcRenderer.invoke('darkMode:toggle'),
getDarkMode: (): Promise<boolean> => ipcRenderer.invoke('darkMode:get'),
```

### `src/preload/index.d.ts`

```ts
toggleDarkMode(): Promise<boolean>
getDarkMode(): Promise<boolean>
```

### `src/renderer/src/App.tsx`

主窗口：

```tsx
const [webDarkMode, setWebDarkMode] = useState(false)

const handleToggleDarkMode = useCallback(async () => {
  const newState = await window.api.toggleDarkMode()
  setWebDarkMode(newState)
}, [])
```

按钮：

```tsx
<button
  className={`action-btn ${webDarkMode ? 'active' : ''}`}
  onClick={() => handleToggleDarkMode().catch(console.error)}
  title="网页暗色模式"
  aria-pressed={webDarkMode}
>
  🌙
</button>
```

Panel-only 设置页也维护同名 `webDarkMode` state，并在设置面板里提供开关。

## 当前已知问题

用户反馈：即使有 `darkModeOverlay`，某些网页打开/新窗口加载时仍然会出现白色闪烁。

当前实现中的可疑点：

1. `darkModeOverlay` 是 `WebContentsView` 的子 `View`，可能无法早于父 `WebContentsView` 第一帧完成合成。
2. 遮罩只在 tab 已创建并进入导航生命周期后显示，可能晚于 Chromium 初始白色 frame。
3. `insertCSS` 本身仍然依赖页面加载时机，`computedStyle(filter)` 检测只能证明 CSS 已生效，不能阻止更早的第一帧。
4. 主窗口背景和 tab view 背景已设为深色，但网页 renderer 的第一帧仍可能直接画白色。
5. 如果真正要完全消除白闪，可能需要在更高层级放一个覆盖整个网页区域的 top-level overlay view，而不是作为页面 view 的 child view，或在 webContents 创建/attach 前就先显示一个独立遮罩层。
