import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent, WebContents, WebContentsView } from 'electron'
import type { AIMessage, AIResponse, AIStatus, ExtractedPageContent } from '../shared/aiTypes'
import type { AISearchMode, Preferences } from '../shared/preferences'
import { getPreferences } from './settings'
import { callAI, testAIConnection } from './aiProvider'
import { extractPageContent, extractSelection } from './pageExtractor'

interface AIIPCOptions {
  uiView: WebContentsView
  panelView: WebContentsView | null
  getActiveWebContents: () => WebContents | null
}

interface PageActionOptions {
  enableWebSearch?: boolean
}

const PROMPTS = {
  summarizePage:
    '你是浏览器内置 AI 助手。请用中文总结当前网页的核心要点，要求：1. 提炼关键信息 2. 结构清晰 3. 不编造网页中没有的内容 4. 尽量简短，让用户快速了解全文大意。',
  verifyPage:
    '你是一个严谨的事实核查助手。请审视当前网页内容，检查其中可能存在的事实错误、数据偏差、逻辑矛盾、过时信息或未经证实的说法。如果当前配置启用了联网搜索，请结合搜索到的公开资料进行核对；如果没有可用联网搜索，请明确说明只能基于当前网页和模型已有知识进行判断。用中文回答，结论要分清“确认错误”“存在疑点”“暂无法核实”。',
  searchPage:
    '你是一个联网信息搜索和补充助手。请基于当前网页的主题、关键词和核心观点，尽可能使用可用的联网搜索能力，寻找相关补充资料、其他视角、背景信息、争议观点和延伸阅读方向。如果当前配置没有可用联网搜索，请明确说明无法真正联网搜索，只能基于当前网页和模型已有知识做补充分析。用中文回答。',
  debatePage:
    '你是一个批判性思维助手。请主动站在当前网页观点的对立面，给出有力的反对意见。具体要求：1. 找出文中的逻辑漏洞 2. 指出被忽略的因素 3. 提供反面论据 4. 质疑隐含假设。语气可以犀利但要有理有据。用中文回答。',
  youAskPage:
    '你是浏览器内置 AI 助手。请基于当前网页内容，为用户生成一个可继续追问的问答式导览。先用简短语言说明这个网页主要讲什么，再给出 5 个用户可能想继续问的问题，并简要回答每个问题。网页中没有的信息不要编造。用中文回答。',
  explainPage: '你是浏览器内置 AI 助手。请用中文解释当前网页的主要内容，适合普通用户理解。',
  askPage:
    '你是浏览器内置 AI 助手。请只基于用户提供的网页内容回答问题。网页中没有的信息，请明确说网页中没有提到。',
  chat: '你是浏览器内置 AI 助手。请用中文自然回答用户的问题。',
  translateSelection: '请把下面选中的内容翻译成自然流畅的中文，保留必要术语。',
  explainSelection: '请用中文解释下面选中的内容，要求简洁清楚。',
  summarizeSelection: '请用中文总结下面选中的内容，提炼要点。'
}

export function registerAIIPC(options: AIIPCOptions): void {
  const { uiView, panelView, getActiveWebContents } = options

  const isValidSender = (event: IpcMainInvokeEvent): boolean => {
    return event.sender === uiView.webContents || event.sender === panelView?.webContents
  }

  ipcMain.handle('ai:get-status', (event): AIStatus | null => {
    if (!isValidSender(event)) return null
    const prefs = getPreferences()
    return {
      enabled: prefs.ai.enabled,
      configured: Boolean(prefs.ai.baseUrl && prefs.ai.apiKey && prefs.ai.model)
    }
  })

  ipcMain.handle(
    'ai:test-connection',
    async (event): Promise<{ success: boolean; error?: string } | null> => {
      if (!isValidSender(event)) return null
      const prefs = getPreferences()
      if (!prefs.ai.enabled) {
        return { success: false, error: 'AI 功能未启用' }
      }
      return testAIConnection(prefs)
    }
  )

  ipcMain.handle('ai:extract-current-page', async (event): Promise<ExtractedPageContent | null> => {
    if (!isValidSender(event)) return null
    const wc = getActiveWebContents()
    if (!wc) return null
    const prefs = getPreferences()
    return extractPageContent(wc, prefs.ai.maxInputChars)
  })

  ipcMain.handle('ai:extract-selection', async (event): Promise<string | null> => {
    if (!isValidSender(event)) return null
    const wc = getActiveWebContents()
    if (!wc) return ''
    return extractSelection(wc)
  })

  ipcMain.handle('ai:summarize-page', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handlePageAction(getActiveWebContents, PROMPTS.summarizePage)
  })

  ipcMain.handle('ai:verify-page', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handlePageAction(getActiveWebContents, PROMPTS.verifyPage, { enableWebSearch: true })
  })

  ipcMain.handle('ai:search-page', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handlePageAction(getActiveWebContents, PROMPTS.searchPage, { enableWebSearch: true })
  })

  ipcMain.handle('ai:debate-page', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handlePageAction(getActiveWebContents, PROMPTS.debatePage)
  })

  ipcMain.handle('ai:you-ask-page', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handlePageAction(getActiveWebContents, PROMPTS.youAskPage)
  })

  ipcMain.handle('ai:explain-page', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handlePageAction(getActiveWebContents, PROMPTS.explainPage)
  })

  ipcMain.handle('ai:ask-page', async (event, question: string): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    if (!question || typeof question !== 'string' || !question.trim()) {
      return { success: false, error: '问题不能为空' }
    }
    return handlePageQuestion(getActiveWebContents, question.trim())
  })

  ipcMain.handle('ai:chat', async (event, message: string): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    if (!message || typeof message !== 'string' || !message.trim()) {
      return { success: false, error: '消息不能为空' }
    }
    return handleChat(message.trim())
  })

  ipcMain.handle('ai:translate-selection', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handleSelectionAction(getActiveWebContents, PROMPTS.translateSelection)
  })

  ipcMain.handle('ai:explain-selection', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handleSelectionAction(getActiveWebContents, PROMPTS.explainSelection)
  })

  ipcMain.handle('ai:summarize-selection', async (event): Promise<AIResponse | null> => {
    if (!isValidSender(event)) return null
    return handleSelectionAction(getActiveWebContents, PROMPTS.summarizeSelection)
  })
}

function hasUsableAIConfig(): AIResponse | null {
  const prefs = getPreferences()
  if (!prefs.ai.enabled) {
    return { success: false, error: 'AI 功能未启用' }
  }
  if (!prefs.ai.baseUrl || !prefs.ai.apiKey || !prefs.ai.model) {
    return { success: false, error: '请先完成 AI Provider 配置' }
  }
  return null
}

async function handlePageAction(
  getActiveWebContents: () => WebContents | null,
  systemPrompt: string,
  options: PageActionOptions = {}
): Promise<AIResponse> {
  const configError = hasUsableAIConfig()
  if (configError) return configError

  const wc = getActiveWebContents()
  if (!wc) {
    return { success: false, error: '无法获取当前页面' }
  }

  const prefs = getPreferences()
  const page = await extractPageContent(wc, prefs.ai.maxInputChars)
  if (!page.text || page.text.length < 10) {
    return { success: false, error: '当前页面没有可提取的正文内容' }
  }

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `页面标题：${page.title}\n页面网址：${page.url}\n\n页面正文：\n${page.text}`
    }
  ]

  const searchMode = getAISearchMode(prefs.ai)
  const shouldUseWebSearch = Boolean(options.enableWebSearch && supportsWebSearch(searchMode))
  return callAI(prefs, messages, {
    extraBody: shouldUseWebSearch ? buildSearchTools(searchMode) : undefined,
    webSearchEnabled: shouldUseWebSearch
  })
}

async function handlePageQuestion(
  getActiveWebContents: () => WebContents | null,
  question: string
): Promise<AIResponse> {
  const configError = hasUsableAIConfig()
  if (configError) return configError

  const wc = getActiveWebContents()
  if (!wc) {
    return { success: false, error: '无法获取当前页面' }
  }

  const prefs = getPreferences()
  const page = await extractPageContent(wc, prefs.ai.maxInputChars)

  const messages: AIMessage[] = [
    { role: 'system', content: PROMPTS.askPage },
    {
      role: 'user',
      content: page.text
        ? `页面标题：${page.title}\n页面网址：${page.url}\n\n页面正文：\n${page.text}\n\n我的问题：${question}`
        : `当前网页无正文内容。\n页面标题：${page.title}\n页面网址：${page.url}\n\n我的问题：${question}`
    }
  ]

  return callAI(prefs, messages)
}

async function handleChat(message: string): Promise<AIResponse> {
  const configError = hasUsableAIConfig()
  if (configError) return configError

  const prefs = getPreferences()
  const messages: AIMessage[] = [
    { role: 'system', content: PROMPTS.chat },
    { role: 'user', content: message }
  ]

  return callAI(prefs, messages)
}

async function handleSelectionAction(
  getActiveWebContents: () => WebContents | null,
  systemPrompt: string
): Promise<AIResponse> {
  const configError = hasUsableAIConfig()
  if (configError) return configError

  const wc = getActiveWebContents()
  if (!wc) {
    return { success: false, error: '无法获取当前页面' }
  }

  const selection = await extractSelection(wc)
  if (!selection) {
    return { success: false, error: '请先在网页中选中文字' }
  }

  const prefs = getPreferences()
  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: selection }
  ]

  return callAI(prefs, messages)
}

function getAISearchMode(aiPrefs: Preferences['ai']): AISearchMode {
  if (isDeepSeekProvider(aiPrefs)) return 'none'

  const searchMode = aiPrefs.searchMode ?? 'none'
  if (
    searchMode === 'xiaomi_web_search' ||
    searchMode === 'gemini_google_search' ||
    searchMode === 'none'
  ) {
    return searchMode
  }
  return 'none'
}

function supportsWebSearch(searchMode: AISearchMode): boolean {
  return searchMode === 'xiaomi_web_search' || searchMode === 'gemini_google_search'
}

function buildSearchTools(searchMode: AISearchMode): Record<string, unknown> {
  if (searchMode === 'xiaomi_web_search') {
    return {
      tools: [
        {
          type: 'web_search',
          force_search: true,
          max_keyword: 5,
          limit: 5
        }
      ]
    }
  }

  if (searchMode === 'gemini_google_search') {
    return {
      tools: [
        {
          google_search: {}
        }
      ]
    }
  }

  return {}
}

function isDeepSeekProvider(aiPrefs: Preferences['ai']): boolean {
  return [aiPrefs.providerName, aiPrefs.baseUrl, aiPrefs.model].some((value) =>
    value.toLowerCase().includes('deepseek')
  )
}
