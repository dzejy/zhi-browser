export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIRequest {
  messages: AIMessage[]
  temperature?: number
  stream?: boolean
}

export interface AIResponse {
  success: boolean
  text?: string
  error?: string
}

export interface AIStatus {
  enabled: boolean
  configured: boolean
}

export interface ExtractedPageContent {
  title: string
  url: string
  text: string
  selection: string
  excerpt: string
}

export type AISelectionAction = 'explain-selection' | 'translate-selection' | 'summarize-selection'
