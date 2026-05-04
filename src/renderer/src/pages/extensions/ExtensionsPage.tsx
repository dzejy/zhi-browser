import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExtensionCard, type ExtensionInfo } from './ExtensionCard'
import { ExtensionDetail } from './ExtensionDetail'
import './extensions.css'

type ExtensionFilter = 'all' | 'enabled' | 'disabled'

export function ExtensionsPage(): React.JSX.Element {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ExtensionFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [webStoreInput, setWebStoreInput] = useState('')
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState('')

  const loadExtensions = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.api.extensionsGetAll()
      setExtensions(list || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadExtensions().catch(() => undefined)
  }, [loadExtensions])

  const filtered = useMemo(() => {
    if (filter === 'enabled') return extensions.filter((extension) => extension.enabled)
    if (filter === 'disabled') return extensions.filter((extension) => !extension.enabled)
    return extensions
  }, [extensions, filter])

  const selected = extensions.find((extension) => extension.id === selectedId) || null

  async function installLocal(): Promise<void> {
    setError('')
    try {
      const result = await window.api.extensionsInstallLocal()
      if (result) await loadExtensions()
    } catch (err) {
      setError(`安装失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function installWebStore(): Promise<void> {
    if (!webStoreInput.trim()) return
    setInstalling(true)
    setError('')
    try {
      await window.api.extensionsInstallWebStore(webStoreInput.trim())
      setWebStoreInput('')
      await loadExtensions()
    } catch (err) {
      setError(`安装失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setInstalling(false)
    }
  }

  async function toggleExtension(id: string, enabled: boolean): Promise<void> {
    setError('')
    try {
      if (enabled) await window.api.extensionsDisable(id)
      else await window.api.extensionsEnable(id)
      await loadExtensions()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function uninstallExtension(id: string): Promise<void> {
    setError('')
    try {
      await window.api.extensionsUninstall(id)
      if (selectedId === id) setSelectedId(null)
      await loadExtensions()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function reloadExtension(id: string): Promise<void> {
    setError('')
    try {
      await window.api.extensionsReload(id)
      await loadExtensions()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="ext-page">
      <header className="ext-header">
        <div>
          <span className="ext-eyebrow">内部页面</span>
          <h1>扩展程序</h1>
          <p>{extensions.length} 个已安装，底层由 Chromium 扩展加载器接管。</p>
        </div>
        <button className="ext-primary-btn" onClick={() => installLocal().catch(() => undefined)}>加载已解压的扩展</button>
      </header>

      <section className="ext-install-bar">
        <label className="ext-search">
          <span>⌕</span>
          <input
            value={webStoreInput}
            onChange={(event) => setWebStoreInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') installWebStore().catch(() => undefined)
            }}
            placeholder="粘贴 Chrome Web Store 链接或 32 位扩展 ID"
          />
        </label>
        <button className="ext-secondary-btn" disabled={installing || !webStoreInput.trim()} onClick={() => installWebStore().catch(() => undefined)}>
          {installing ? '安装中...' : '从商店安装'}
        </button>
      </section>

      {error && (
        <div className="ext-error">
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <nav className="ext-filters">
        {([
          ['all', '全部'],
          ['enabled', '已启用'],
          ['disabled', '已禁用']
        ] as Array<[ExtensionFilter, string]>).map(([value, label]) => (
          <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </nav>

      <div className="ext-body">
        <main className="ext-list">
          {loading ? (
            <div className="ext-empty"><div>⧉</div><p>加载中...</p></div>
          ) : filtered.length === 0 ? (
            <div className="ext-empty">
              <div>⧉</div>
              <p>暂无扩展</p>
              <span>加载本地扩展目录，或从 Chrome Web Store 安装。</span>
            </div>
          ) : (
            filtered.map((extension) => (
              <ExtensionCard
                key={extension.id}
                extension={extension}
                selected={selectedId === extension.id}
                onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
                onToggle={(id, enabled) => toggleExtension(id, enabled).catch(() => undefined)}
              />
            ))
          )}
        </main>

        {selected && (
          <ExtensionDetail
            extension={selected}
            onClose={() => setSelectedId(null)}
            onReload={(id) => reloadExtension(id).catch(() => undefined)}
            onUninstall={(id) => uninstallExtension(id).catch(() => undefined)}
          />
        )}
      </div>
    </div>
  )
}
