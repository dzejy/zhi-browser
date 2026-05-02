export interface UserScriptMeta {
  name: string
  namespace: string
  version: string
  description: string
  author: string
  match: string[]
  include: string[]
  exclude: string[]
  grant: string[]
  runAt: 'document-start' | 'document-end' | 'document-idle'
  require: string[]
  resource: Record<string, string>
  icon: string
  homepage: string
  downloadURL: string
  updateURL: string
  noframes: boolean
}

export interface UserScript {
  id: string
  meta: UserScriptMeta
  code: string
  enabled: boolean
  installTime: number
  updateTime: number
}

export function parseMetadata(code: string): UserScriptMeta {
  const meta: UserScriptMeta = {
    name: 'Unnamed Script',
    namespace: '',
    version: '0.0.0',
    description: '',
    author: '',
    match: [],
    include: [],
    exclude: [],
    grant: [],
    runAt: 'document-idle',
    require: [],
    resource: {},
    icon: '',
    homepage: '',
    downloadURL: '',
    updateURL: '',
    noframes: false
  }

  const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)
  if (!headerMatch) return meta

  const header = headerMatch[1]
  const lines = header.split('\n')

  for (const line of lines) {
    const match = line.match(/\/\/\s*@(\S+)\s+(.*)/)
    if (!match) {
      const noValMatch = line.match(/\/\/\s*@(\S+)\s*$/)
      if (noValMatch) {
        const key = noValMatch[1].trim()
        if (key === 'noframes') meta.noframes = true
      }
      continue
    }

    const key = match[1].trim()
    const value = match[2].trim()

    switch (key) {
      case 'name':
        meta.name = value
        break
      case 'namespace':
        meta.namespace = value
        break
      case 'version':
        meta.version = value
        break
      case 'description':
        meta.description = value
        break
      case 'author':
        meta.author = value
        break
      case 'match':
        meta.match.push(value)
        break
      case 'include':
        meta.include.push(value)
        break
      case 'exclude':
        meta.exclude.push(value)
        break
      case 'grant':
        meta.grant.push(value)
        break
      case 'run-at':
        if (value === 'document-start' || value === 'document-end' || value === 'document-idle') {
          meta.runAt = value
        }
        break
      case 'require':
        meta.require.push(value)
        break
      case 'resource': {
        const parts = value.split(/\s+/)
        if (parts.length >= 2) {
          meta.resource[parts[0]] = parts.slice(1).join(' ')
        }
        break
      }
      case 'icon':
        meta.icon = value
        break
      case 'homepage':
      case 'homepageURL':
        meta.homepage = value
        break
      case 'downloadURL':
        meta.downloadURL = value
        break
      case 'updateURL':
        meta.updateURL = value
        break
      case 'noframes':
        meta.noframes = true
        break
    }
  }

  return meta
}

export function generateScriptId(meta: UserScriptMeta): string {
  const base = `${meta.namespace}/${meta.name}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  return base || `script_${Date.now()}`
}
