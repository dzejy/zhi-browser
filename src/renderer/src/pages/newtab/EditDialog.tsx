import React, { useState, useEffect } from 'react'
import type { Engine } from './defaultEngines'
import { DEFAULT_ENGINES } from './defaultEngines'

interface EditDialogProps {
  type: 'none' | 'link' | 'category' | 'engines'
  isOpen: boolean
  onClose: () => void
  // For links/categories
  initialName?: string
  initialUrl?: string
  onSaveLink?: (name: string, url: string) => void
  onSaveCategory?: (name: string) => void
  onResetLink?: () => void
  // For engines
  engines?: Engine[]
  onSaveEngines?: (engines: Engine[]) => void
  onResetEngines?: () => void
}

export const EditDialog: React.FC<EditDialogProps> = ({
  type,
  isOpen,
  onClose,
  initialName = '',
  initialUrl = '',
  onSaveLink,
  onSaveCategory,
  onResetLink,
  engines = [],
  onSaveEngines,
  onResetEngines
}) => {
  const [name, setName] = useState(initialName)
  const [url, setUrl] = useState(initialUrl)
  const [tempEngines, setTempEngines] = useState<Engine[]>([])

  useEffect(() => {
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        if (type === 'engines') {
          setTempEngines(JSON.parse(JSON.stringify(engines)));
        } else {
          setName(initialName);
          setUrl(initialUrl);
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isOpen, type, initialName, initialUrl, engines]);

  if (!isOpen || type === 'none') return null

  return (
    <div
      className="dialog-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {type !== 'engines' ? (
        <div className="edit-dialog" style={{ display: 'block' }}>
          <h4>{type === 'category' ? '编辑分类名称' : '编辑链接'}</h4>
          <div className="edit-field">
            <span>名称</span>
            <input
              type="text"
              placeholder="输入名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {type === 'link' && (
            <div className="edit-field">
              <span>网址</span>
              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}
          <div className="edit-hint">数据保存在本地浏览器，清除浏览器数据会丢失。</div>
          <div className="dialog-actions">
            <button className="btn-reset" onClick={onResetLink}>
              恢复默认
            </button>
            <button className="btn-cancel" onClick={onClose}>
              取消
            </button>
            <button
              className="btn-save"
              onClick={() => {
                if (type === 'category' && onSaveCategory) onSaveCategory(name)
                if (type === 'link' && onSaveLink) onSaveLink(name, url)
              }}
            >
              确定
            </button>
          </div>
        </div>
      ) : (
        <div className="edit-dialog engine-manage-dialog" style={{ display: 'block' }}>
          <h4>管理搜索引擎</h4>
          <div>
            {tempEngines.map((eng, i) => (
              <div key={i} className="engine-list-item">
                <input
                  type="text"
                  className="name"
                  value={eng.name}
                  placeholder="名称"
                  onChange={(e) => {
                    const newArr = [...tempEngines]
                    newArr[i].name = e.target.value
                    setTempEngines(newArr)
                  }}
                />
                <input
                  type="text"
                  className="url"
                  value={eng.url}
                  placeholder="搜索URL (含参数)"
                  onChange={(e) => {
                    const newArr = [...tempEngines]
                    newArr[i].url = e.target.value
                    setTempEngines(newArr)
                  }}
                />
                <button
                  className="del-btn"
                  title="删除"
                  onClick={() => {
                    const newArr = [...tempEngines]
                    newArr.splice(i, 1)
                    setTempEngines(newArr)
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            className="add-engine-btn"
            onClick={() => setTempEngines([...tempEngines, { name: '', url: '' }])}
          >
            + 添加搜索引擎
          </button>
          <div className="edit-hint" style={{ marginTop: '20px' }}>
            注意：最多显示前8个搜索引擎，其余的将被隐藏。
          </div>
          <div className="dialog-actions">
            <button
              className="btn-reset"
              onClick={() => {
                const defaults = JSON.parse(JSON.stringify(DEFAULT_ENGINES))
                setTempEngines(defaults)
                onResetEngines?.()
              }}
            >
              恢复默认
            </button>
            <button className="btn-cancel" onClick={onClose}>
              取消
            </button>
            <button
              className="btn-save"
              onClick={() => {
                if (onSaveEngines) {
                  const filtered = tempEngines.filter(
                    (e) => e.name.trim() !== '' && e.url.trim() !== ''
                  )
                  onSaveEngines(filtered)
                }
              }}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
