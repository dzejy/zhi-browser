import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import './bookmarks.css'
import './bookmarks.elegant.css'

interface BookmarkItem {
  id: string
  title: string
  url: string
  favicon?: string
  addedAt: number
}

interface BookmarkFolder {
  id: string
  name: string
  expanded: boolean
  bookmarks: BookmarkItem[]
  children: BookmarkFolder[]
}

interface ContextMenuState {
  x: number
  y: number
  bookmark: BookmarkItem
}

interface EditState {
  bookmark: BookmarkItem
  folderId: string
}

const STORAGE_KEY = 'zhi-bookmarks'

const defaultFolders: BookmarkFolder[] = [
  {
    id: 'bar',
    name: '书签栏',
    expanded: true,
    bookmarks: [
      createBookmark('Zhi Browser 发布页', 'https://github.com'),
      createBookmark('Electron 文档', 'https://www.electronjs.org/docs/latest'),
      createBookmark('React 中文文档', 'https://zh-hans.react.dev')
    ],
    children: [
      {
        id: 'work',
        name: '工作资料',
        expanded: true,
        bookmarks: [
          createBookmark('MDN Web Docs', 'https://developer.mozilla.org/zh-CN'),
          createBookmark('TypeScript Handbook', 'https://www.typescriptlang.org/docs'),
          createBookmark('Vite 官方指南', 'https://vite.dev/guide'),
          createBookmark('Chromium Blog', 'https://blog.chromium.org')
        ],
        children: []
      }
    ]
  },
  {
    id: 'other',
    name: '其他书签',
    expanded: true,
    bookmarks: [
      createBookmark('知乎热榜', 'https://www.zhihu.com/hot'),
      createBookmark('哔哩哔哩', 'https://www.bilibili.com'),
      createBookmark('少数派', 'https://sspai.com'),
      createBookmark('Product Hunt', 'https://www.producthunt.com'),
      createBookmark('Dribbble', 'https://dribbble.com')
    ],
    children: []
  }
]

function createBookmark(title: string, url: string): BookmarkItem {
  const host = url.replace(/^https?:\/\//, '').split('/')[0]
  return {
    id: `${host}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    url,
    favicon: `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`,
    addedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 14)
  }
}

function loadFolders(): BookmarkFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultFolders
    const parsed = JSON.parse(raw) as BookmarkFolder[]
    return Array.isArray(parsed) ? parsed : defaultFolders
  } catch {
    return defaultFolders
  }
}

function saveFolders(folders: BookmarkFolder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
}

function countBookmarks(folder: BookmarkFolder): number {
  return folder.bookmarks.length + folder.children.reduce((sum, child) => sum + countBookmarks(child), 0)
}

function findFolder(folders: BookmarkFolder[], id: string): BookmarkFolder | null {
  for (const folder of folders) {
    if (folder.id === id) return folder
    const child = findFolder(folder.children, id)
    if (child) return child
  }
  return null
}

function findBookmarkFolderId(folders: BookmarkFolder[], bookmarkId: string): string {
  for (const folder of folders) {
    if (folder.bookmarks.some((bookmark) => bookmark.id === bookmarkId)) return folder.id
    const child = findBookmarkFolderId(folder.children, bookmarkId)
    if (child) return child
  }
  return ''
}

function mapFolders(
  folders: BookmarkFolder[],
  mapper: (folder: BookmarkFolder) => BookmarkFolder
): BookmarkFolder[] {
  return folders.map((folder) => mapper({ ...folder, children: mapFolders(folder.children, mapper) }))
}

function removeBookmark(folders: BookmarkFolder[], id: string): BookmarkFolder[] {
  return mapFolders(folders, (folder) => ({
    ...folder,
    bookmarks: folder.bookmarks.filter((bookmark) => bookmark.id !== id)
  }))
}

function collectBookmarks(folder: BookmarkFolder): BookmarkItem[] {
  return [...folder.bookmarks, ...folder.children.flatMap((child) => collectBookmarks(child))]
}

function flattenFolders(folders: BookmarkFolder[], depth = 0): Array<{ id: string; name: string; depth: number }> {
  return folders.flatMap((folder) => [
    { id: folder.id, name: folder.name, depth },
    ...flattenFolders(folder.children, depth + 1)
  ])
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function BookmarksPage(): React.JSX.Element {
  const [folders, setFolders] = useState<BookmarkFolder[]>(() => loadFolders())
  const [selectedFolderId, setSelectedFolderId] = useState('bar')
  const [query, setQuery] = useState('')
  const [collapsedTree, setCollapsedTree] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [draft, setDraft] = useState({ title: '', url: '', folderId: 'bar' })
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => saveFolders(folders), [folders])

  useEffect(() => {
    function closeMenu(event: globalThis.MouseEvent): void {
      if (!menuRef.current?.contains(event.target as Node)) setContextMenu(null)
    }
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const selectedFolder = findFolder(folders, selectedFolderId) || folders[0]
  const folderOptions = useMemo(() => flattenFolders(folders), [folders])
  const bookmarks = useMemo(() => {
    const source = selectedFolder ? collectBookmarks(selectedFolder) : []
    const keyword = query.trim().toLowerCase()
    if (!keyword) return source
    return source.filter(
      (bookmark) =>
        bookmark.title.toLowerCase().includes(keyword) || bookmark.url.toLowerCase().includes(keyword)
    )
  }, [query, selectedFolder])

  function updateFolders(next: BookmarkFolder[]): void {
    setFolders(next)
  }

  function toggleFolder(folderId: string, event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation()
    updateFolders(
      mapFolders(folders, (folder) =>
        folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder
      )
    )
  }

  function createFolder(): void {
    const name = `新建文件夹 ${folderOptions.length + 1}`
    const nextFolder: BookmarkFolder = {
      id: `folder-${Date.now()}`,
      name,
      expanded: true,
      bookmarks: [],
      children: []
    }
    updateFolders(
      mapFolders(folders, (folder) =>
        folder.id === selectedFolderId ? { ...folder, expanded: true, children: [...folder.children, nextFolder] } : folder
      )
    )
    setSelectedFolderId(nextFolder.id)
  }

  function openBookmark(bookmark: BookmarkItem, newTab = false): void {
    window.api?.openUrl?.(bookmark.url, newTab)
  }

  function editBookmark(bookmark: BookmarkItem): void {
    const folderId = findBookmarkFolderId(folders, bookmark.id) || selectedFolderId
    setEditState({ bookmark, folderId })
    setDraft({ title: bookmark.title, url: bookmark.url, folderId })
    setContextMenu(null)
  }

  function deleteBookmark(id: string): void {
    updateFolders(removeBookmark(folders, id))
    setContextMenu(null)
  }

  function saveEdit(): void {
    if (!editState || !draft.title.trim() || !draft.url.trim()) return
    const updated: BookmarkItem = {
      ...editState.bookmark,
      title: draft.title.trim(),
      url: draft.url.trim(),
      favicon: `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(draft.url.trim())}`
    }
    let next = removeBookmark(folders, editState.bookmark.id)
    next = mapFolders(next, (folder) =>
      folder.id === draft.folderId ? { ...folder, bookmarks: [updated, ...folder.bookmarks] } : folder
    )
    updateFolders(next)
    setSelectedFolderId(draft.folderId)
    setEditState(null)
  }

  function openContextMenu(bookmark: BookmarkItem, event: MouseEvent<HTMLDivElement>): void {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, bookmark })
  }

  function copyLink(url: string): void {
    window.api?.copyToClipboard?.(url)
    setContextMenu(null)
  }

  return (
    <div className="bookmarks-page">
      <aside className={`bookmarks-sidebar ${collapsedTree ? 'is-collapsed' : ''}`}>
        <div className="bookmarks-sidebar-header">
          <div>
            <span className="bookmarks-eyebrow">内部页面</span>
            <h1>书签管理</h1>
          </div>
          <button className="bookmarks-icon-btn" onClick={() => setCollapsedTree((value) => !value)} title="收起侧栏">
            {collapsedTree ? '›' : '‹'}
          </button>
        </div>

        {!collapsedTree && (
          <>
            <div className="bookmarks-folder-tree">
              {folders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  activeId={selectedFolderId}
                  depth={0}
                  onSelect={setSelectedFolderId}
                  onToggle={toggleFolder}
                />
              ))}
            </div>
            <button className="bookmarks-secondary-btn bookmarks-new-folder" onClick={createFolder}>
              新建文件夹
            </button>
          </>
        )}
      </aside>

      <main className="bookmarks-main">
        <header className="bookmarks-topbar">
          <div>
            <span className="bookmarks-eyebrow">{selectedFolder?.name || '书签'}</span>
            <h2>收藏的星图</h2>
          </div>
          <label className="bookmarks-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或 URL" />
          </label>
        </header>

        <section className="bookmarks-list" aria-label="书签列表">
          {bookmarks.length === 0 ? (
            <div className="bookmarks-empty">
              <div>☆</div>
              <p>{query ? '没有匹配的书签' : '暂无书签'}</p>
            </div>
          ) : (
            bookmarks.map((bookmark, index) => (
              <div
                key={bookmark.id}
                className="bookmarks-item"
                style={{ '--delay': `${index * 30}ms` } as CSSProperties}
                onDoubleClick={() => openBookmark(bookmark)}
                onContextMenu={(event) => openContextMenu(bookmark, event)}
              >
                <div className="bookmarks-favicon">
                  <span>🌐</span>
                  {bookmark.favicon && <img src={bookmark.favicon} alt="" onError={(event) => (event.currentTarget.style.display = 'none')} />}
                </div>
                <div className="bookmarks-info">
                  <strong>{bookmark.title}</strong>
                  <span>{bookmark.url}</span>
                </div>
                <time>{formatDate(bookmark.addedAt)}</time>
                <div className="bookmarks-actions">
                  <button onClick={() => editBookmark(bookmark)}>编辑</button>
                  <button onClick={() => deleteBookmark(bookmark.id)} className="danger">删除</button>
                  <button onClick={() => openBookmark(bookmark, true)}>新标签页打开</button>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {contextMenu && (
        <div ref={menuRef} className="bookmarks-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => editBookmark(contextMenu.bookmark)}>编辑</button>
          <button onClick={() => deleteBookmark(contextMenu.bookmark.id)}>删除</button>
          <button onClick={() => editBookmark(contextMenu.bookmark)}>移动到文件夹</button>
          <button onClick={() => copyLink(contextMenu.bookmark.url)}>复制链接</button>
          <button onClick={() => openBookmark(contextMenu.bookmark, true)}>在新标签页打开</button>
        </div>
      )}

      {editState && (
        <div className="bookmarks-modal-backdrop" onClick={() => setEditState(null)}>
          <div className="bookmarks-modal" onClick={(event) => event.stopPropagation()}>
            <h3>编辑书签</h3>
            <label>
              名称
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label>
              URL
              <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} />
            </label>
            <label>
              所属文件夹
              <select value={draft.folderId} onChange={(event) => setDraft({ ...draft, folderId: event.target.value })}>
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {'　'.repeat(folder.depth)}{folder.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="bookmarks-modal-actions">
              <button className="bookmarks-secondary-btn" onClick={() => setEditState(null)}>取消</button>
              <button className="bookmarks-primary-btn" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FolderNode({
  folder,
  activeId,
  depth,
  onSelect,
  onToggle
}: {
  folder: BookmarkFolder
  activeId: string
  depth: number
  onSelect: (id: string) => void
  onToggle: (id: string, event: MouseEvent<HTMLButtonElement>) => void
}): React.JSX.Element {
  const hasChildren = folder.children.length > 0
  return (
    <div>
      <div
        className={`bookmarks-folder ${activeId === folder.id ? 'active' : ''}`}
        style={{ '--depth': depth } as CSSProperties}
        onClick={() => onSelect(folder.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(folder.id)
        }}
      >
        <button className={`bookmarks-folder-toggle ${folder.expanded ? 'open' : ''}`} onClick={(event) => onToggle(folder.id, event)} disabled={!hasChildren}>
          ▸
        </button>
        <span>📁</span>
        <strong>{folder.name}</strong>
        <em>{countBookmarks(folder)}</em>
      </div>
      {hasChildren && folder.expanded && (
        <div className="bookmarks-folder-children">
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              activeId={activeId}
              depth={depth + 1}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
