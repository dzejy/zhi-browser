# Zhi Browser

**Zhi Browser** 是一个面向个人长期自用的 Windows AI 浏览器项目，基于 **Electron + React + TypeScript + WebContentsView** 构建。

当前版本：**Zhi Browser 3.2.0**

项目主页：

https://zzhi.tech

GitHub Release 下载页：

https://github.com/dzejy/zhi-browser/releases

---

## 1. 项目定位

Zhi Browser 不是一个普通的 WebView 外壳，而是一个长期迭代的个人 AI 浏览器。

它的目标是：

- 保持轻量、干净、可控的浏览器外观
- 保留完整的多标签浏览体验
- 将 AI 功能深度绑定到网页内容
- 支持阅读、下载、脚本、资源嗅探、侧边栏网页等高级浏览器能力
- 作为个人日常使用、网页分析、资料整理和 AI 辅助阅读工具

---

## 2. 当前版本：3.2.0

Zhi Browser 3.2.0 是 3.1.0 之后的小版本更新，重点是主页与发布体验调整。

### 3.2.0 更新内容

- 更新默认主页配置
- 将浏览器首页指向新的 Zhi Browser 官网入口
- 配合 `zzhi.tech` 域名完成主页访问体验调整
- 保留 3.1.0 已有的 AI 浏览器能力
- 保留多标签、阅读模式、资源嗅探、用户脚本、外部下载器、侧边栏网页面板、鼠标手势、分屏浏览等完整功能
- 更新 Windows 安装包版本号为 `3.2.0`

---

## 3. 下载

Windows 用户请在 GitHub Release 页面下载最新版安装包：

`Zhi Browser Setup 3.2.0.exe`

Release 页面：

https://github.com/dzejy/zhi-browser/releases

---

## 4. 核心功能

### 多标签浏览

Zhi Browser 支持完整的多标签浏览体验，包括：

- 新建标签页
- 关闭标签页
- 标签页切换
- 标签页标题显示
- favicon 显示
- 标签页拖拽排序
- 中键关闭标签
- 快捷键操作

常用快捷键：

```text
Ctrl + T        新建标签页
Ctrl + W        关闭当前标签页
Ctrl + L        聚焦地址栏
Ctrl + R        刷新页面
Ctrl + Tab      切换标签页
```

---

### AI 浏览器能力

Zhi Browser 内置 AI 侧边栏，并围绕当前网页提供快捷 AI 操作。

当前 AI 快捷功能包括：

- **省流版本**：总结当前网页内容
- **丁真一下**：检查网页内容是否存在事实错误
- **全网通缉**：围绕当前网页主题进行联网搜索与补充
- **大司马模式**：站在反方角度分析网页中的逻辑漏洞和忽略因素

AI 功能支持：

- 当前网页内容提取
- 选中文本交互
- AI 侧边栏对话
- AI Provider 配置
- OpenAI-compatible API 接入
- 快捷键呼出 AI 面板

---

### 用户脚本引擎

Zhi Browser 内置类 Tampermonkey 的用户脚本能力。

可用于：

- 网页增强
- 自动化操作
- 页面样式修改
- 特定网站功能扩展
- 个人脚本管理

---

### 阅读模式

阅读模式用于清理网页中的干扰元素，使文章阅读更加干净。

适合：

- 新闻文章
- 博客内容
- 文档页面
- 长文本网页

---

### 资源嗅探

资源嗅探功能可以帮助发现网页中的媒体资源和下载资源。

适合：

- 检测页面图片资源
- 检测视频 / 音频资源
- 辅助外部下载器调用
- 分析网页加载内容

---

### 外部下载器对接

Zhi Browser 支持与外部下载器配合使用。

设计目标是更方便地调用：

- IDM
- FDM
- NDM
- 其他本地下载工具

---

### 侧边栏网页面板

Zhi Browser 支持侧边栏网页面板，可用于固定常用网页或工具页面。

适合放置：

- AI 聊天页面
- 翻译工具
- 搜索页面
- 文档页面
- 常用站点

---

### 鼠标手势

鼠标手势用于提高浏览效率。

可用于：

- 后退
- 前进
- 刷新
- 关闭标签页
- 新建标签页

---

### 分屏浏览

分屏浏览用于同时查看两个网页，提高对比阅读和资料整理效率。

适合：

- 一边看资料，一边看 AI
- 一边读网页，一边查文档
- 两个网页内容对照
- 学习、写作、开发辅助

---

## 5. 技术栈

Zhi Browser 使用以下技术构建：

- Electron
- React
- TypeScript
- WebContentsView
- electron-vite
- CSS 自定义暗色 UI
- Node.js / npm

项目采用 Electron 主进程与 React 渲染进程分离的结构。

---

## 6. 架构方向

Zhi Browser 当前主线采用：

```text
Electron + BaseWindow + WebContentsView
```

该路线用于替代早期 `<webview>` 方案。

核心目标：

- 更强的浏览器页面控制能力
- 更稳定的多标签管理
- 更接近真实浏览器的窗口结构
- 更适合长期扩展 AI、下载、代理、脚本、侧边栏等能力

---

## 7. 版本演进

### 2.0.0

Zhi Browser 2.0.0 是高级浏览器工具能力扩展阶段。

主要新增：

- 用户脚本引擎
- 阅读模式
- 资源嗅探
- 外部下载器对接
- 标签页预览
- 侧边栏网页面板
- 鼠标手势
- 分屏浏览

---

### 3.0.0

Zhi Browser 3.0.0 是个人浏览器完整体阶段。

主要补齐：

- 下载能力
- 代理能力
- 历史记录
- 书签
- 密码管理
- 无痕模式
- 搜索入口
- 全屏入口
- 页面按钮自定义

---

### 3.1.0

Zhi Browser 3.1.0 进一步完善视觉、AI 与日常使用体验，使浏览器更适合长期自用。

---

### 3.2.0

Zhi Browser 3.2.0 主要完成主页与官网入口调整。

重点：

- 默认主页更新
- 官网域名 `zzhi.tech` 接入
- 发布包更新为 `3.2.0`
- 继续保留完整 AI 浏览器能力和高级浏览器功能

---

## 8. 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

打包 Windows 安装包：

```bash
npm run build:win
```

打包产物一般位于：

```text
dist/
```

例如：

```text
dist/Zhi Browser Setup 3.2.0.exe
```

---

## 9. 发布流程

常规发布步骤：

```bash
npm version x.x.x --no-git-tag-version
npm run build:win
git add .
git commit -m "release: Zhi Browser x.x.x"
git push
git tag vx.x.x
git push origin vx.x.x
gh release create vx.x.x "./dist/Zhi Browser Setup x.x.x.exe" --title "Zhi Browser x.x.x" --notes-file "./RELEASE_x.x.x.md"
```

---

## 10. 项目说明

Zhi Browser 是个人长期自用浏览器项目，目前重点不是追求大规模商业化，而是追求：

- 自己顺手
- 功能完整
- UI 干净
- AI 深度接入
- 可持续维护
- 可继续扩展

这个项目会继续围绕个人浏览器、AI 网页理解、自动化脚本、下载增强、网页工作流等方向演进。

---

## 11. License

Personal project.

当前项目主要用于个人学习、研究和自用。
