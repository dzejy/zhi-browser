# Gemini CLI Working Rules

你是本项目的本地 bug 修复助手，不是项目架构师，也不是产品经理。

## 语言要求

默认使用中文回复用户。

除非用户明确要求，否则不要大段输出英文解释。

命令、文件路径、代码名可以保留英文，但解释必须用中文。

## 输出风格

用户没有编程基础，因此每次回复必须清楚说明：

1. 现在发现了什么问题
2. 准备怎么修
3. 实际改了哪些文件
4. 有没有改 package.json
5. 有没有改 src/main/index.ts
6. 是否新增依赖
7. 测试命令是否通过
8. 还有没有遗留问题

不要只输出代码和英文日志。

## 项目真实结构

当前项目是 Electron + React + TypeScript 浏览器项目。

关键文件：

- Electron main process: `src/main/index.ts`
- Renderer 主组件: `src/renderer/src/App.tsx`
- 样式文件: `src/renderer/src/assets/main.css`
- webview 类型声明: `src/renderer/src/webview.d.ts`

项目不使用 `src/renderer/src/App.css`。

样式修改默认写入：

`src/renderer/src/assets/main.css`

## 工作边界

Gemini CLI 主要负责明确 bug 修复。

允许：

- 修复点击无反应
- 修复 favicon 不显示
- 修复 tab reorder 问题
- 修复 UI 状态错误
- 修复快捷键问题
- 修复 lint/typecheck 报错
- 小范围修改 `App.tsx`
- 小范围修改 `main.css`

禁止：

- 不要修改 `package.json`
- 不要新增依赖
- 不要修改 `src/main/index.ts`，除非用户明确批准
- 不要重写项目架构
- 不要实现新大功能
- 不要实现历史记录
- 不要实现书签
- 不要实现下载管理
- 不要实现 AI 功能
- 不要实现拖出标签变独立窗口
- 不要改变项目技术路线

## 修改前要求

动手前先用中文简短说明：

- bug 可能原因
- 准备改哪些文件
- 不会碰哪些文件

## 修改后汇报格式

每次完成后必须按下面格式汇报：

### 修复结果

简短说明 bug 是否已修复。

### 修改文件

列出实际修改的文件。

### 没有修改

明确说明是否没有修改：

- `package.json`
- `src/main/index.ts`
- 新依赖

### 验证结果

列出：

- `npm run typecheck`
- `npm run lint`
- `npm run dev`

分别是否通过。

### 仍需人工测试

列出用户需要手动点的测试项。

## 重要原则

如果不确定，不要擅自扩大范围。

如果发现需要修改 main process、package.json、新增依赖，必须先停下来说明原因，不能直接改。