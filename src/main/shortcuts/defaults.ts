import { ShortcutItem } from './types'

function entry(
  id: string,
  label: string,
  category: string,
  defaultKey: string,
  scope: ShortcutItem['scope'] = 'app'
): ShortcutItem {
  return { id, label, category, defaultKey, currentKey: defaultKey, enabled: true, scope }
}

export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  // 标签页
  entry('tab:new', '新建标签页', '标签页', 'Ctrl+T'),
  entry('tab:close', '关闭标签页', '标签页', 'Ctrl+W'),
  entry('tab:restore', '恢复关闭的标签页', '标签页', 'Ctrl+Shift+T'),
  entry('tab:next', '切换到下一标签页', '标签页', 'Ctrl+Tab'),
  entry('tab:prev', '切换到上一标签页', '标签页', 'Ctrl+Shift+Tab'),
  entry('tab:switch:1', '切换到标签页 1', '标签页', 'Ctrl+1'),
  entry('tab:switch:2', '切换到标签页 2', '标签页', 'Ctrl+2'),
  entry('tab:switch:3', '切换到标签页 3', '标签页', 'Ctrl+3'),
  entry('tab:switch:4', '切换到标签页 4', '标签页', 'Ctrl+4'),
  entry('tab:switch:5', '切换到标签页 5', '标签页', 'Ctrl+5'),
  entry('tab:switch:6', '切换到标签页 6', '标签页', 'Ctrl+6'),
  entry('tab:switch:7', '切换到标签页 7', '标签页', 'Ctrl+7'),
  entry('tab:switch:8', '切换到标签页 8', '标签页', 'Ctrl+8'),
  entry('tab:switch:last', '切换到最后一个标签页', '标签页', 'Ctrl+9'),
  entry('tab:incognito-new', '新建隐身标签页', '标签页', 'Ctrl+Shift+N'),

  // 导航
  entry('nav:back', '后退', '导航', 'Alt+Left'),
  entry('nav:forward', '前进', '导航', 'Alt+Right'),
  entry('nav:reload', '刷新', '导航', 'Ctrl+R'),
  entry('nav:reload-alt', '刷新（备用）', '导航', 'F5'),
  entry('nav:hard-reload', '强制刷新', '导航', 'Ctrl+Shift+R'),
  entry('nav:stop', '停止加载', '导航', 'Escape'),
  entry('nav:home', '回到主页', '导航', 'Alt+Home'),

  // 页面操作
  entry('page:find', '查找', '页面操作', 'Ctrl+F'),
  entry('page:zoom-in', '放大', '页面操作', 'Ctrl+='),
  entry('page:zoom-out', '缩小', '页面操作', 'Ctrl+-'),
  entry('page:zoom-reset', '重置缩放', '页面操作', 'Ctrl+0'),
  entry('page:fullscreen', '全屏', '页面操作', 'F11'),
  entry('page:print', '打印', '页面操作', 'Ctrl+P'),
  entry('page:view-source', '查看源代码', '页面操作', 'Ctrl+U'),

  // 地址栏
  entry('address:focus', '聚焦地址栏', '地址栏', 'Ctrl+L'),
  entry('address:focus-alt', '聚焦地址栏（备用）', '地址栏', 'F6'),

  // 书签
  entry('bookmark:add', '添加书签', '书签', 'Ctrl+D'),
  entry('bookmark:manage', '打开书签管理器', '书签', 'Ctrl+Shift+O'),
  entry('bookmark:bar-toggle', '显示/隐藏书签栏', '书签', 'Ctrl+Shift+B'),

  // 开发者工具
  entry('devtools:toggle', '打开 DevTools', '开发者工具', 'F12'),
  entry('devtools:toggle-alt', '打开 DevTools（备用）', '开发者工具', 'Ctrl+Shift+I'),
  entry('devtools:console', '打开控制台', '开发者工具', 'Ctrl+Shift+J'),

  // 浏览器功能
  entry('browser:history', '打开历史', '浏览器功能', 'Ctrl+H'),
  entry('browser:downloads', '打开下载', '浏览器功能', 'Ctrl+J'),
  entry('browser:settings', '打开设置', '浏览器功能', 'Ctrl+,'),
  entry('browser:shortcuts', '打开快捷键页面', '浏览器功能', 'Ctrl+Shift+/'),

  // AI 与工具
  entry('ai:toggle', 'AI 助手', 'AI 与工具', 'Alt+I'),
  entry('screenshot:capture', '截图', 'AI 与工具', 'Alt+A', 'global'),
  entry('screenshot:pin', '贴图', 'AI 与工具', 'Alt+W', 'global'),
  entry('screenshot:long', '长截图', 'AI 与工具', 'Alt+L', 'global'),
  entry('command-palette:toggle', '命令面板', 'AI 与工具', 'Ctrl+K', 'global'),
  entry('quick-note:toggle', '快捷笔记', 'AI 与工具', 'Alt+N', 'global'),
  entry('tab:hibernate-others', '休眠其他标签', 'AI 与工具', 'Alt+H', 'global'),
  entry('translate:page', '翻译当前页', 'AI 与工具', 'Alt+T', 'global'),
  entry('reader:toggle', '阅读模式', 'AI 与工具', 'Alt+R', 'global'),
  entry('proxy:toggle', '代理开关', 'AI 与工具', 'Alt+P', 'global'),
  entry('darkmode:toggle', '暗色模式', 'AI 与工具', 'Alt+D', 'global')
]
