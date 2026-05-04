import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './commands.css'

type CommandType = 'quick' | 'search' | 'system'
type CommandSource = 'builtin' | 'custom'
type CategoryId = 'all' | CommandType | 'custom'

interface CommandItem {
  id: string
  name: string
  description: string
  target: string
  type: CommandType
  source: CommandSource
  locked: boolean
}

interface CommandStore {
  builtins: CommandItem[]
  custom: CommandItem[]
}

interface DraftCommand {
  name: string
  description: string
  target: string
  type: CommandType
}

const STORAGE_KEY = 'zhi-commands'

const builtInCommands: CommandItem[] = [
  createBuiltin('gg', '谷歌搜索', 'https://www.google.com/search?q=%s', 'search'),
  createBuiltin('bd', '百度搜索', 'https://www.baidu.com/s?wd=%s', 'search'),
  createBuiltin('bi', '必应搜索', 'https://www.bing.com/search?q=%s', 'search'),
  createBuiltin('zh', '知乎搜索', 'https://www.zhihu.com/search?type=content&q=%s', 'search'),
  createBuiltin('bl', 'B站搜索', 'https://search.bilibili.com/all?keyword=%s', 'search'),
  createBuiltin('gh', 'GitHub', 'https://github.com', 'quick'),
  createBuiltin('ghs', 'GitHub 搜索', 'https://github.com/search?q=%s', 'search'),
  createBuiltin('bm', '书签页', 'zhi://bookmarks', 'system'),
  createBuiltin('hs', '历史记录', 'zhi://history', 'system'),
  createBuiltin('dl', '下载页', 'zhi://downloads', 'system'),
  createBuiltin('all', '超级菜单', 'zhi://all', 'system'),
  createBuiltin('st', '设置页', 'zhi://settings', 'system'),
  createBuiltin('kb', '快捷键页', 'zhi://shortcuts', 'system')
]

const categories: Array<{ id: CategoryId; label: string; hint: string }> = [
  { id: 'all', label: '全部命令', hint: '查看所有地址栏命令' },
  { id: 'quick', label: '快速导航', hint: '跳转到指定 URL' },
  { id: 'search', label: '搜索引擎', hint: '用 %s 替代搜索词' },
  { id: 'system', label: '系统页面', hint: '跳转到 zhi:// 内部页面' },
  { id: 'custom', label: '自定义命令', hint: '你创建的命令' }
]

function createBuiltin(name: string, description: string, target: string, type: CommandType): CommandItem {
  return {
    id: `builtin-${name}`,
    name,
    description,
    target,
    type,
    source: 'builtin',
    locked: true
  }
}

function createCustom(draft: DraftCommand): CommandItem {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: normalizeCommandName(draft.name),
    description: draft.description.trim(),
    target: draft.target.trim(),
    type: draft.type,
    source: 'custom',
    locked: false
  }
}

function normalizeCommandName(value: string): string {
  return value.replace(/^\/+/, '').replace(/\s+/g, '').trim().toLowerCase()
}

function mergeBuiltins(stored?: CommandItem[]): CommandItem[] {
  return builtInCommands.map((command) => {
    const existing = stored?.find((item) => item.name === command.name)
    return existing ? { ...command, description: existing.description || command.description } : command
  })
}

function loadCommands(): CommandStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { builtins: builtInCommands, custom: [] }
    const parsed = JSON.parse(raw) as Partial<CommandStore>
    return {
      builtins: mergeBuiltins(parsed.builtins),
      custom: Array.isArray(parsed.custom) ? parsed.custom : []
    }
  } catch {
    return { builtins: builtInCommands, custom: [] }
  }
}

function saveCommands(store: CommandStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function getTypeLabel(type: CommandType): string {
  if (type === 'quick') return '快速导航'
  if (type === 'search') return '搜索引擎'
  return '系统页面'
}

function commandMatches(command: CommandItem, keyword: string): boolean {
  return (
    command.name.toLowerCase().includes(keyword) ||
    command.description.toLowerCase().includes(keyword) ||
    command.target.toLowerCase().includes(keyword)
  )
}

export function CommandsPage(): React.JSX.Element {
  const [store, setStore] = useState<CommandStore>(() => loadCommands())
  const [category, setCategory] = useState<CategoryId>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<CommandItem | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [draft, setDraft] = useState<DraftCommand>({ name: '', description: '', target: '', type: 'quick' })
  const [error, setError] = useState('')

  useEffect(() => saveCommands(store), [store])

  const commands = useMemo(() => [...store.builtins, ...store.custom], [store])
  const filteredCommands = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return commands.filter((command) => {
      const categoryMatched =
        category === 'all' ||
        (category === 'custom' ? command.source === 'custom' : command.type === category)
      return categoryMatched && (!keyword || commandMatches(command, keyword))
    })
  }, [category, commands, query])

  function openCreateDialog(): void {
    setEditing(null)
    setDraft({ name: '', description: '', target: '', type: category === 'search' || category === 'system' || category === 'quick' ? category : 'quick' })
    setError('')
    setShowDialog(true)
  }

  function openEditDialog(command: CommandItem): void {
    setEditing(command)
    setDraft({ name: command.name, description: command.description, target: command.target, type: command.type })
    setError('')
    setShowDialog(true)
  }

  function deleteCommand(command: CommandItem): void {
    if (command.locked) return
    setStore((current) => ({ ...current, custom: current.custom.filter((item) => item.id !== command.id) }))
  }

  function saveDraft(): void {
    const name = normalizeCommandName(draft.name)
    const target = draft.target.trim()
    const description = draft.description.trim()
    if (!name || !description || !target) {
      setError('请完整填写命令名、描述和目标 URL')
      return
    }
    if (draft.type === 'search' && !target.includes('%s')) {
      setError('搜索引擎命令的目标 URL 需要包含 %s')
      return
    }
    const duplicate = commands.find((command) => command.name === name && command.id !== editing?.id)
    if (duplicate) {
      setError(`/${name} 已存在，请换一个命令名`)
      return
    }

    if (editing?.locked) {
      setStore((current) => ({
        ...current,
        builtins: current.builtins.map((command) =>
          command.id === editing.id ? { ...command, description } : command
        )
      }))
    } else if (editing) {
      setStore((current) => ({
        ...current,
        custom: current.custom.map((command) =>
          command.id === editing.id ? { ...command, name, description, target, type: draft.type } : command
        )
      }))
    } else {
      setStore((current) => ({ ...current, custom: [createCustom({ ...draft, name, description, target }), ...current.custom] }))
    }
    setShowDialog(false)
  }

  return (
    <div className="commands-page">
      <aside className="commands-sidebar">
        <div className="commands-sidebar-header">
          <span className="commands-eyebrow">地址栏指令</span>
          <h1>命令 DIY</h1>
          <p>输入 /命令名 快速跳转或执行搜索。</p>
        </div>
        <nav className="commands-nav">
          {categories.map((item) => (
            <button key={item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="commands-main">
        <header className="commands-topbar">
          <div>
            <span className="commands-eyebrow">{categories.find((item) => item.id === category)?.label}</span>
            <h2>自定义地址栏命令</h2>
          </div>
          <div className="commands-actions">
            <label className="commands-search">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索命令、描述或目标" />
            </label>
            <button className="commands-primary-btn" onClick={openCreateDialog}>新建命令</button>
          </div>
        </header>

        <section className="commands-list">
          {filteredCommands.length === 0 ? (
            <div className="commands-empty">
              <div>/</div>
              <p>{query ? '没有匹配的命令' : '暂无命令'}</p>
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <article key={command.id} className="commands-card" style={{ '--delay': `${index * 30}ms` } as CSSProperties}>
                <div className="commands-card-body">
                  <div className="commands-card-head">
                    <code>/{command.name}</code>
                    {command.locked && <span className="commands-lock">🔒</span>}
                    <span className="commands-tag">{command.source === 'custom' ? '自定义命令' : getTypeLabel(command.type)}</span>
                  </div>
                  <strong>{command.description}</strong>
                  <span>{command.target}</span>
                </div>
                <div className="commands-card-actions">
                  <button onClick={() => openEditDialog(command)}>编辑</button>
                  {!command.locked && <button className="danger" onClick={() => deleteCommand(command)}>删除</button>}
                </div>
              </article>
            ))
          )}
        </section>
      </main>

      {showDialog && (
        <div className="commands-modal-backdrop" onClick={() => setShowDialog(false)}>
          <div className="commands-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{editing ? '编辑命令' : '新建命令'}</h3>
            {editing?.locked && <p className="commands-dialog-hint">内置命令已锁定，只能编辑描述。</p>}
            <label>
              命令名
              <div className="commands-name-input">
                <span>/</span>
                <input
                  value={draft.name}
                  disabled={Boolean(editing?.locked)}
                  onChange={(event) => setDraft({ ...draft, name: normalizeCommandName(event.target.value) })}
                  placeholder="例如 gg"
                />
              </div>
            </label>
            <label>
              描述
              <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="这条命令会做什么" />
            </label>
            <label>
              类型
              <select value={draft.type} disabled={Boolean(editing?.locked)} onChange={(event) => setDraft({ ...draft, type: event.target.value as CommandType })}>
                <option value="quick">快速导航</option>
                <option value="search">搜索引擎</option>
                <option value="system">系统页面</option>
              </select>
            </label>
            <label>
              目标 URL
              <input
                value={draft.target}
                disabled={Boolean(editing?.locked)}
                onChange={(event) => setDraft({ ...draft, target: event.target.value })}
                placeholder={draft.type === 'search' ? 'https://example.com/search?q=%s' : 'https://example.com'}
              />
            </label>
            {error && <div className="commands-error">{error}</div>}
            <div className="commands-modal-actions">
              <button className="commands-secondary-btn" onClick={() => setShowDialog(false)}>取消</button>
              <button className="commands-primary-btn" onClick={saveDraft}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
