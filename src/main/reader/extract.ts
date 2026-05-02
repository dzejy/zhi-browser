import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

export interface ReaderArticle {
  title: string
  content: string
  textContent: string
  excerpt: string
  byline: string
  siteName: string
  length: number
}

export function extractArticle(html: string, url: string): ReaderArticle | null {
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()
  if (!article) return null
  return {
    title: article.title || '',
    content: article.content || '',
    textContent: article.textContent || '',
    excerpt: article.excerpt || '',
    byline: article.byline || '',
    siteName: article.siteName || '',
    length: article.length || 0
  }
}
