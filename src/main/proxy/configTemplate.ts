import YAML from 'yaml'

export function generateConfig(options: {
  mixedPort: number
  apiPort: number
  secret: string
  subscriptionContent: string
}): string {
  let content = options.subscriptionContent
  const trimmed = content.trimStart()

  if (
    !trimmed.startsWith('port') &&
    !trimmed.startsWith('mixed-port') &&
    !trimmed.startsWith('proxies')
  ) {
    try {
      content = Buffer.from(content, 'base64').toString('utf-8')
    } catch {
      // Keep raw content when it is not base64.
    }
  }

  let config: Record<string, unknown>
  try {
    config = YAML.parse(content) || {}
  } catch {
    throw new Error('无法解析订阅内容')
  }

  config['mixed-port'] = options.mixedPort
  config['external-controller'] = `127.0.0.1:${options.apiPort}`
  config['secret'] = options.secret
  config['mode'] = 'rule'
  config['log-level'] = 'warning'
  config['allow-lan'] = false

  if (!config['dns']) {
    config['dns'] = {
      enable: true,
      'enhanced-mode': 'fake-ip',
      nameserver: ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
      fallback: ['https://dns.google/dns-query', 'https://cloudflare-dns.com/dns-query'],
      'fallback-filter': {
        geoip: true,
        'geoip-code': 'CN'
      }
    }
  }

  return YAML.stringify(config)
}
