export function createReaderInjectScript(article: {
  title: string
  content: string
  byline: string
  siteName: string
}): string {
  const title = JSON.stringify(article.title)
  const content = JSON.stringify(article.content)
  const meta = JSON.stringify([article.byline, article.siteName].filter(Boolean).join(' · '))

  return `
    (function() {
      if (window.__zhiReaderActive) return
      window.__zhiReaderActive = true
      window.__zhiReaderOriginalHTML = document.documentElement.outerHTML

      document.documentElement.innerHTML = \`
        <head>
          <meta charset="utf-8">
          <title>\${${title}}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, "Noto Sans SC", "Microsoft YaHei", sans-serif;
              line-height: 1.8;
              color: #2c2c2c;
              background: #fafafa;
              padding: 60px 20px;
              max-width: 720px;
              margin: 0 auto;
            }
            .reader-header { margin-bottom: 40px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
            .reader-title { font-size: 28px; font-weight: 700; line-height: 1.3; margin-bottom: 12px; }
            .reader-meta { font-size: 14px; color: #888; }
            .reader-content { font-size: 17px; }
            .reader-content p { margin-bottom: 1.2em; }
            .reader-content h1, .reader-content h2, .reader-content h3 {
              margin-top: 1.5em; margin-bottom: 0.6em; font-weight: 600;
            }
            .reader-content img { max-width: 100%; height: auto; border-radius: 4px; margin: 16px 0; }
            .reader-content a { color: #4a9eff; text-decoration: none; }
            .reader-content a:hover { text-decoration: underline; }
            .reader-content blockquote {
              border-left: 3px solid #ddd; padding-left: 16px; margin: 16px 0; color: #555;
            }
            .reader-content pre, .reader-content code {
              font-family: "JetBrains Mono", "Fira Code", monospace;
              background: #f0f0f0; border-radius: 4px;
            }
            .reader-content pre { padding: 16px; overflow-x: auto; margin: 16px 0; }
            .reader-content code { padding: 2px 5px; font-size: 0.9em; }
            .reader-exit {
              position: fixed; top: 16px; right: 20px;
              background: #333; color: #fff; border: none; border-radius: 6px;
              padding: 8px 16px; font-size: 13px; cursor: pointer; z-index: 9999;
              opacity: 0.7; transition: opacity 0.2s;
            }
            .reader-exit:hover { opacity: 1; }
            @media (prefers-color-scheme: dark) {
              body { background: #1a1a1a; color: #e0e0e0; }
              .reader-header { border-bottom-color: #333; }
              .reader-content a { color: #6db3f8; }
              .reader-content blockquote { border-left-color: #444; color: #aaa; }
              .reader-content pre, .reader-content code { background: #2a2a2a; }
              .reader-exit { background: #555; }
            }
          </style>
        </head>
        <body>
          <button class="reader-exit" onclick="window.__zhiExitReader()">退出阅读</button>
          <article>
            <header class="reader-header">
              <h1 class="reader-title">\${${title}}</h1>
              <div class="reader-meta">\${${meta}}</div>
            </header>
            <main class="reader-content">\${${content}}</main>
          </article>
        </body>
      \`

      window.__zhiExitReader = function() {
        document.documentElement.innerHTML = window.__zhiReaderOriginalHTML
        window.__zhiReaderActive = false
        delete window.__zhiReaderOriginalHTML
        delete window.__zhiExitReader
      }
    })()
  `
}

export const READER_EXIT_SCRIPT = `
  (function() {
    if (window.__zhiExitReader) window.__zhiExitReader()
  })()
`
