export interface ExtensionInfo {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  path: string
  url: string
  icons: Record<string, string>
  hasPopup: boolean
  hasOptions: boolean
  permissions: string[]
  hostPermissions: string[]
  installedAt: number
  source: 'local' | 'crx' | 'webstore'
}

interface ExtensionCardProps {
  extension: ExtensionInfo
  selected: boolean
  onSelect: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
}

function getIconPath(extension: ExtensionInfo): string {
  return extension.icons['128'] || extension.icons['48'] || extension.icons['32'] || extension.icons['16'] || ''
}

function getSourceLabel(source: ExtensionInfo['source']): string {
  if (source === 'webstore') return '商店'
  if (source === 'crx') return 'CRX'
  return '本地'
}

export function ExtensionCard({ extension, selected, onSelect, onToggle }: ExtensionCardProps): React.JSX.Element {
  const iconPath = getIconPath(extension)
  return (
    <article
      className={`ext-card ${selected ? 'is-selected' : ''} ${!extension.enabled ? 'is-disabled' : ''}`}
      onClick={() => onSelect(extension.id)}
    >
      <div className="ext-card-icon">
        {iconPath ? (
          <img src={`${extension.url}${iconPath}`} alt="" onError={(event) => (event.currentTarget.style.display = 'none')} />
        ) : (
          <span>{extension.name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="ext-card-body">
        <div className="ext-card-title-row">
          <strong>{extension.name}</strong>
          <em>v{extension.version}</em>
          <span>{getSourceLabel(extension.source)}</span>
        </div>
        <p>{extension.description || '无描述'}</p>
      </div>
      <label className="ext-switch" onClick={(event) => event.stopPropagation()}>
        <input type="checkbox" checked={extension.enabled} onChange={() => onToggle(extension.id, extension.enabled)} />
        <span />
      </label>
    </article>
  )
}
