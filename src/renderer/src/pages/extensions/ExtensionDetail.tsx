import type { ExtensionInfo } from './ExtensionCard'

interface ExtensionDetailProps {
  extension: ExtensionInfo
  onClose: () => void
  onReload: (id: string) => void
  onUninstall: (id: string) => void
}

function getSourceLabel(source: ExtensionInfo['source']): string {
  if (source === 'webstore') return 'Chrome Web Store'
  if (source === 'crx') return 'CRX 文件'
  return '本地加载'
}

export function ExtensionDetail({ extension, onClose, onReload, onUninstall }: ExtensionDetailProps): React.JSX.Element {
  return (
    <aside className="ext-detail">
      <div className="ext-detail-top">
        <div>
          <span className="ext-eyebrow">扩展详情</span>
          <h2>{extension.name}</h2>
        </div>
        <button className="ext-icon-btn" onClick={onClose}>×</button>
      </div>

      <div className="ext-detail-grid">
        <span>ID</span>
        <code>{extension.id}</code>
        <span>版本</span>
        <strong>{extension.version}</strong>
        <span>来源</span>
        <strong>{getSourceLabel(extension.source)}</strong>
        <span>路径</span>
        <code title={extension.path}>{extension.path}</code>
        <span>安装时间</span>
        <strong>{new Date(extension.installedAt).toLocaleString('zh-CN')}</strong>
        <span>弹窗</span>
        <strong>{extension.hasPopup ? '支持' : '无'}</strong>
        <span>选项页</span>
        <strong>{extension.hasOptions ? '支持' : '无'}</strong>
      </div>

      {extension.permissions.length > 0 && (
        <section className="ext-detail-section">
          <h3>权限</h3>
          <div className="ext-tags">
            {extension.permissions.map((permission) => <span key={permission}>{permission}</span>)}
          </div>
        </section>
      )}

      {extension.hostPermissions.length > 0 && (
        <section className="ext-detail-section">
          <h3>主机权限</h3>
          <div className="ext-tags">
            {extension.hostPermissions.map((permission) => <span key={permission}>{permission}</span>)}
          </div>
        </section>
      )}

      <div className="ext-detail-actions">
        <button className="ext-secondary-btn" onClick={() => onReload(extension.id)}>重新加载</button>
        <button className="ext-danger-btn" onClick={() => onUninstall(extension.id)}>卸载扩展</button>
      </div>
    </aside>
  )
}
