# Zhi Browser

**Zhi Browser** 是一个个人 AI 辅助浏览器项目，基于 Electron、React、TypeScript、Electron Vite 和 WebContentsView 开发。

当前版本：**1.0.0S Simple 简洁版**

Zhi Browser 的目标是做一个真正适合个人使用的 AI 浏览器壳。它保留传统横向标签页和正常浏览器操作习惯，同时把 AI 总结、验证、搜索、反驳这些网页阅读能力接进浏览器内部。

---

## 下载

请在 GitHub Releases 页面下载最新版 Windows 安装包。

当前推荐下载：

**Zhi Browser Setup 1.0.0S.exe**

这是当前的 1.0.0S Simple 简洁版安装包，适合正常安装使用。

`win-unpacked` 目录主要用于本地测试和开发调试，普通使用只需要下载 `Setup.exe` 安装包。

---

## 当前版本：1.0.0S Simple 简洁版

`1.0.0S` 是 Zhi Browser 第一个正式打包发布的版本。

版本含义：

- **S = Simple / 简洁版**
- 当前版本作为后续美化前的简洁基线
- 下一阶段版本是 **1.0.0-B Beautiful 美化版**

当前版本已经完成主要可用基础：

- 多标签页浏览
- 横向标签栏布局
- 地址栏导航
- 浏览器工具栏
- WebContentsView 页面渲染
- Electron BaseWindow 架构路线
- 设置中心
- 独立 AI 设置页面
- AI 侧边栏
- AI 网页功能按钮
- 历史记录面板
- 书签面板
- 下载面板
- ADB 相关入口
- 深色界面基础风格
- 红色 Z 官方图标
- Windows NSIS 安装包

目前项目整体完成度约 **70%**，已经具备个人日常使用和继续迭代的基础。

---

## 核心功能

### 浏览器基础能力

Zhi Browser 当前已经具备一个桌面浏览器的基础结构：

- 多标签页
- 横向标签栏
- 地址栏输入与跳转
- 后退 / 前进 / 刷新
- 侧边面板
- 设置持久化基础
- 深色桌面应用界面
- Electron + WebContentsView 渲染结构

项目采用 **Electron + BaseWindow + WebContentsView** 路线，不再继续使用早期失败的 `<webview>` 路线。

### AI 网页工作流

Zhi Browser 内置 AI 侧边栏，并围绕“当前网页”设计了几个固定 AI 功能。

AI 不是单纯的聊天框，而是直接服务于浏览网页时的阅读、判断和分析。

当前 AI 功能包括：

| 功能名称 | 作用 |
| --- | --- |
| 省流版本 | 总结当前网页内容 |
| 丁真一下 | 验证网页事实，检查可能的错误 |
| 全网通缉 | 围绕当前网页主题搜索相关信息和补充材料 |
| 大司马模式 | 站在反方角度反驳网页观点，找逻辑漏洞 |

目标使用流程：

1. 打开一个网页。
2. 呼出 AI 侧边栏。
3. 选择总结、验证、搜索或反驳。
4. 用 AI 帮助理解网页，而不是只被动阅读。

### 设置与面板

当前已经包含：

- 普通设置页面
- 独立 AI 设置页面
- AI 侧边栏
- 历史记录面板
- 书签面板
- 下载面板
- ADB 相关入口
- 搜索引擎配置基础
- API / 模型配置基础

AI 设置已经从普通设置中拆分出来，方便后续继续扩展 API Key、模型选择、联网搜索、提示词模板等功能。

---

## 视觉方向

Zhi Browser 当前采用深色、紧凑、桌面应用风格的界面。

当前 1.0.0S Simple 简洁版重点是：先把浏览器核心功能和基础 AI 工作流跑通，保持界面简洁、稳定、可用。

下一阶段会进入 1.0.0-B Beautiful 美化版，重点提升整体质感、交互细节和日常使用舒适度。

视觉方向会参考 Arc Browser 和 Zen Browser 的一些质感，但不会改成它们那种竖向 sidebar 浏览器。Zhi Browser 会继续保持自己的横向标签页形态。

---

## 版本规划

### 1.0.0S Simple 简洁版

状态：已完成 / 准备发布到 GitHub Release

定位：后续美化前的简洁基线

安装包名称：

**Zhi Browser Setup 1.0.0S.exe**

这个版本作为当前可下载版本保存。

### 1.0.0-B Beautiful 美化版

状态：下一阶段分支

定位：基于 1.0.0S Simple 简洁版继续美化

版本含义：

- **B = Beautiful / 美化版**

计划重点：

- 提升整体产品感
- 精修顶部浏览器区域
- 精修标签栏
- 精修侧边面板
- 精修 AI 侧边栏
- 优化按钮和交互动效
- 统一视觉层级
- 继续保持横向标签页，不转竖向 sidebar

`1.0.0-B` 会从 `1.0.0S` 简洁基线继续开发。

---

## 技术栈

- Electron
- Electron Vite
- React
- TypeScript
- CSS
- WebContentsView
- Electron Builder
- NSIS Windows 安装器

---

## 打包说明

Windows 安装包通过 Electron Builder + NSIS 生成。

本地正式打包命令：

`npx electron-builder --config .\\electron-builder.yml --win nsis --x64 --publish never`

安装包生成位置：

`dist/Zhi Browser Setup 1.0.0.exe`

GitHub Release 发布时使用的文件名：

`Zhi Browser Setup 1.0.0S.exe`

官方图标和安装器图片位于：

- `build/icon.ico`
- `build/icon.png`
- `build/installerHeader.bmp`
- `build/installerSidebar.bmp`

Zhi Browser 官方图标是红色 **Z** 标志。

---

## 项目状态

当前状态：

- 浏览器核心功能已落地
- AI 侧边栏已落地
- AI 设置独立化已落地
- 网页 AI 工作流已落地
- 深色 UI 基础已落地
- P10 已验收
- Windows 安装包已生成
- 1.0.0S Simple 简洁版准备发布
- 1.0.0-B Beautiful 美化版准备开分支

Zhi Browser 已经完成主要基础阶段，后续会从 1.0.0S Simple 简洁版继续推进。

---

## 说明

这是一个个人 AI 辅助浏览器项目。

当前目标是构建一个可用、可控、可继续迭代的个人浏览器，而不是直接对标完整商业浏览器。

`1.0.0S` 是第一个 Simple 简洁版里程碑。

`1.0.0-B` 将作为 Beautiful 美化版，重点提升视觉完成度和日常使用体验。
