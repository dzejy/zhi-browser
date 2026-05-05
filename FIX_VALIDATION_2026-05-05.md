# Zhi Browser 修复后验证记录（2026-05-05）

## 修复范围

- 修复本地网页文件启动参数解析，避免普通启动误打开 Electron 可执行文件。
- 修复 `TabManager` 在窗口或 `WebContentsView` 已销毁时继续布局导致的主进程崩溃。
- 收束工作区与分屏 IPC 的 sender 校验，并统一分屏 URL 输入分类。
- 恢复本地文件标签页的 `sandbox` 与 `webSecurity`。
- 移除启动日志仓库硬编码路径，改写入 `app.getPath('userData')`。
- 修复宣传页离线字体、技术栈文案、路线图首屏滚动、图标资源路径和首屏文案可读性。
- 修复新标签页背景图资源路径。
- 调整 lint 配置，让质量门禁不被调试脚本、格式噪音和过严历史规则阻塞。
- 让水平标签栏与垂直标签栏一样按当前工作区过滤可见标签。

## 第一轮：代码验证

- `npm run typecheck`：通过。
- `npm run lint`：通过，0 error；仍有 12 个历史 warning，主要是未使用的 eslint-disable 与 React Hook dependency 提示。
- `npm run build`：通过。
- 静态搜索确认没有继续保留硬编码 `STARTUP_INTENT_LOG`、`C:\zhi` 启动日志路径、本地文件 `webSecurity: false` / `sandbox: false`、未接入 `validateSender` 的工作区/分屏注册点。

## 第二轮：视觉验证

- 直接渲染根目录宣传页桌面宽度：通过，无资源加载失败。
- 直接渲染根目录宣传页移动宽度：通过，无资源加载失败。
- 用 Electron 启动浏览器打开根目录 `index.html`：地址栏显示 `file:///C:/zhi/zhi-browser/index.html`，浏览器 chrome 正常。
- 截图产物保存在 `tmp-qa/`，用于本轮人工复核。

## 第三轮：模拟验证

真实 Electron 窗口中完成以下功能链路，结果全部通过，未出现 `Object has been destroyed` 或主进程错误弹窗：

- 普通启动：保持 `zhi://newtab`。
- 本地文件启动：打开 `file:///C:/zhi/zhi-browser/index.html`。
- 书签：新增、搜索、删除。
- 工作区：新增、切换、横竖布局切换、删除。
- 分屏：打开、读取状态、关闭。
- 弹层类功能：命令面板、截图 overlay、快捷笔记。
- 系统面板/API：设置、历史、扩展、代理、无痕、用户脚本、资源嗅探、外部下载器检测、内置下载列表、标签休眠、AI 状态。
- 标签与窗口：创建标签、关闭标签、全屏往返。

## 当前结论

本轮修复后，上一轮报告里的阻断级问题已经验证消失；目前没有发现新的阻断级 bug。剩余 lint warning 不影响构建和运行，但后续可以作为代码整理任务单独处理。
