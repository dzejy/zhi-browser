import React from 'react'

interface SettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  isEditMode: boolean
  onEditModeChange: (val: boolean) => void
  snowMode: string
  onSnowModeChange: (val: string) => void
  snowPaused: boolean
  onSnowPausedChange: (val: boolean) => void
  onResetAll: () => void
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  isEditMode,
  onEditModeChange,
  snowMode,
  onSnowModeChange,
  snowPaused,
  onSnowPausedChange,
  onResetAll
}) => {
  return (
    <>
      <div className={`drawer-overlay ${isOpen ? 'show' : ''}`} onClick={onClose} />
      <div className={`settings-drawer ${isOpen ? 'show' : ''}`}>
        <div className="drawer-header">
          <h3>设置</h3>
          <button className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="drawer-section">
          <label>
            编辑模式
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={isEditMode}
                onChange={(e) => onEditModeChange(e.target.checked)}
              />
              <div className="toggle-track"></div>
              <div className="toggle-thumb"></div>
            </div>
          </label>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0 0' }}>
            开启后可编辑分类名称和链接
          </p>
        </div>
        <div className="drawer-section">
          <label>
            积雪模式
            <select
              className="mode-select"
              value={snowMode}
              onChange={(e) => onSnowModeChange(e.target.value)}
            >
              <option value="extreme">狂暴积雪 (持续堆积)</option>
              <option value="normal">普通积雪 (自动融化)</option>
              <option value="off">关闭积雪</option>
            </select>
          </label>
        </div>
        <div className="drawer-section">
          <label>
            暂停雪花
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={snowPaused}
                onChange={(e) => onSnowPausedChange(e.target.checked)}
              />
              <div className="toggle-track"></div>
              <div className="toggle-thumb"></div>
            </div>
          </label>
        </div>
        <div className="drawer-section">
          <button className="drawer-btn danger" style={{ marginTop: '12px' }} onClick={onResetAll}>
            恢复所有默认链接
          </button>
        </div>
      </div>
    </>
  )
}
