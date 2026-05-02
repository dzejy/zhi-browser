import type { AIMessage } from '../../shared/aiTypes'
import { getPreferences } from '../settings'
import { callAI } from '../aiProvider'

export async function translateText(text: string, targetLang: string): Promise<string> {
  const prefs = getPreferences()
  if (!prefs.ai.enabled) {
    throw new Error('AI 功能未启用')
  }

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `你是专业翻译引擎。将以下编号段落翻译为${targetLang}。
规则：
1. 每段翻译前必须保留原编号格式如 [1]、[2]、[3]
2. 只输出译文，不要任何解释、注释或额外内容
3. 翻译段落数量必须与原文一致
4. 翻译要自然流畅`
    },
    { role: 'user', content: text }
  ]

  const result = await callAI(prefs, messages)
  if (!result.success) {
    throw new Error(result.error || '翻译失败')
  }
  return result.text?.trim() || ''
}
