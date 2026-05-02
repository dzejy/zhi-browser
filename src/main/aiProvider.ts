import { net } from 'electron'
import type { Preferences } from '../shared/preferences'
import type { AIMessage, AIResponse } from '../shared/aiTypes'

export interface AICallOptions {
  extraBody?: Record<string, unknown>
  webSearchEnabled?: boolean
}

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim()
  while (url.endsWith('/')) {
    url = url.slice(0, -1)
  }

  const lower = url.toLowerCase()
  if (lower.endsWith('/chat/completions')) return url
  if (lower.endsWith('/v1')) return `${url}/chat/completions`

  try {
    const parsed = new URL(url)
    if (!parsed.pathname || parsed.pathname === '/') {
      return `${url}/v1/chat/completions`
    }
  } catch {
    // Let net.fetch surface the invalid URL as a request error.
  }

  return `${url}/chat/completions`
}

function redactSecret(value: string, secret: string): string {
  if (!secret) return value
  return value.split(secret).join('***')
}

export async function callAI(
  prefs: Preferences,
  messages: AIMessage[],
  options: AICallOptions = {}
): Promise<AIResponse> {
  const { baseUrl, apiKey, model, temperature } = prefs.ai

  if (!baseUrl || !apiKey || !model) {
    return { success: false, error: 'AI 配置不完整，请检查 Base URL、API Key 和模型名称' }
  }

  const endpoint = normalizeBaseUrl(baseUrl)
  const requestBody = {
    model,
    messages,
    temperature: temperature ?? 0.3,
    stream: false,
    ...(options.extraBody ?? {})
  }
  const body = JSON.stringify(requestBody)

  try {
    const response = await net.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body
    })

    if (!response.ok) {
      const statusText = response.statusText || '未知错误'
      let detail = ''
      try {
        const errBody = (await response.json()) as {
          error?: { message?: string }
          message?: string
        }
        if (errBody?.error?.message) {
          detail = redactSecret(errBody.error.message, apiKey)
        } else if (errBody?.message) {
          detail = redactSecret(errBody.message, apiKey)
        }
      } catch {
        try {
          detail = redactSecret(await response.text(), apiKey)
        } catch {
          // Some providers return empty or unreadable errors.
        }
      }

      const searchHint = options.webSearchEnabled
        ? '当前 Provider 不支持所选联网搜索模式，请在 AI 设置中切换搜索模式或更换 API。'
        : ''
      const errorText = `AI 请求失败 (${response.status} ${statusText})${detail ? `：${detail}` : ''}`
      return {
        success: false,
        error: searchHint ? `${searchHint}\n${errorText}` : errorText
      }
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string; annotations?: unknown; citations?: unknown }
      }>
      citations?: unknown
      grounding_metadata?: unknown
      groundingMetadata?: unknown
    }

    const message = data?.choices?.[0]?.message
    const text = message?.content
    if (typeof text !== 'string') {
      return { success: false, error: 'AI 返回格式异常，未获取到文本内容' }
    }

    return { success: true, text: appendReferences(text, data) }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '未知网络错误'
    return { success: false, error: `AI 请求异常：${redactSecret(msg, apiKey)}` }
  }
}

export async function testAIConnection(
  prefs: Preferences
): Promise<{ success: boolean; error?: string }> {
  const result = await callAI(prefs, [{ role: 'user', content: '请回复“连接成功”' }])
  if (result.success) return { success: true }
  return { success: false, error: result.error }
}

function appendReferences(text: string, response: unknown): string {
  const urls = extractReferenceUrls(response)
  if (urls.length === 0) return text
  const existing = new Set<string>()
  const uniqueUrls = urls.filter((url) => {
    if (existing.has(url)) return false
    existing.add(url)
    return true
  })
  if (uniqueUrls.length === 0) return text
  return `${text}\n\n参考来源：\n${uniqueUrls.map((url, index) => `${index + 1}. ${url}`).join('\n')}`
}

function extractReferenceUrls(value: unknown, depth = 0): string[] {
  if (depth > 8 || value === null || value === undefined) return []
  if (typeof value === 'string') {
    return isReferenceUrl(value) ? [value] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractReferenceUrls(item, depth + 1))
  }
  if (typeof value !== 'object') return []

  const urls: string[] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (
      typeof child === 'string' &&
      (lowerKey === 'url' ||
        lowerKey === 'uri' ||
        lowerKey === 'link' ||
        lowerKey === 'source_url') &&
      isReferenceUrl(child)
    ) {
      urls.push(child)
      continue
    }
    urls.push(...extractReferenceUrls(child, depth + 1))
  }
  return urls
}

function isReferenceUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value)
}
