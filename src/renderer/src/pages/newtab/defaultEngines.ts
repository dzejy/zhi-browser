export interface Engine {
  name: string
  url: string
}

export const DEFAULT_ENGINES: Engine[] = [
  { name: '百度', url: 'https://www.baidu.com/s?wd=' },
  { name: '秘塔AI', url: 'https://metaso.cn/?q=' },
  { name: 'Google', url: 'https://www.google.com/search?q=' },
  { name: '必应', url: 'https://www.bing.com/search?q=' },
  { name: 'Duck', url: 'https://duckduckgo.com/?q=' },
  { name: 'B站', url: 'https://search.bilibili.com/all?keyword=' },
  { name: '知乎', url: 'https://www.zhihu.com/search?type=content&q=' },
  { name: '百度AI', url: 'https://chat.baidu.com/search?word=' }
]
