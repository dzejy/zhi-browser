let apiPort = 19090
let secret = 'zhi-browser-proxy'

export function setApiConfig(port: number, sec: string): void {
  apiPort = port
  secret = sec
}

async function apiRequest(method: string, requestPath: string, body?: unknown): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    }

    if (body !== undefined) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`http://127.0.0.1:${apiPort}${requestPath}`, options)
    if (!response.ok) return null

    const text = await response.text()
    if (!text) return {}

    return JSON.parse(text)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function getProxies(): Promise<Record<string, unknown>> {
  const data = (await apiRequest('GET', '/proxies')) as {
    proxies?: Record<string, unknown>
  } | null
  if (!data?.proxies) return {}

  const filtered: Record<string, unknown> = {}
  const skipNames = ['DIRECT', 'REJECT', 'GLOBAL', 'COMPATIBLE']

  for (const [name, info] of Object.entries(data.proxies)) {
    if (!skipNames.includes(name)) {
      filtered[name] = info
    }
  }

  return filtered
}

export async function switchProxy(group: string, nodeName: string): Promise<boolean> {
  const result = await apiRequest('PUT', `/proxies/${encodeURIComponent(group)}`, {
    name: nodeName
  })
  return result !== null
}

export async function testGroupDelay(
  group: string,
  url?: string,
  timeout?: number
): Promise<Record<string, number>> {
  const testUrl = url || 'https://www.google.com/generate_204'
  const testTimeout = timeout || 3000
  const data = await apiRequest(
    'GET',
    `/group/${encodeURIComponent(group)}/delay?url=${encodeURIComponent(testUrl)}&timeout=${testTimeout}`
  )
  return (data as Record<string, number>) || {}
}

export async function testNodeDelay(nodeName: string): Promise<number> {
  const data = (await apiRequest(
    'GET',
    `/proxies/${encodeURIComponent(nodeName)}/delay?url=${encodeURIComponent(
      'https://www.google.com/generate_204'
    )}&timeout=3000`
  )) as { delay?: number } | null
  return data?.delay ?? -1
}

export async function getTraffic(): Promise<{ up: number; down: number }> {
  const data = (await apiRequest('GET', '/traffic')) as { up?: number; down?: number } | null
  return { up: data?.up ?? 0, down: data?.down ?? 0 }
}

export async function reloadConfig(configPath: string): Promise<boolean> {
  const result = await apiRequest('PUT', '/configs', { path: configPath })
  return result !== null
}
