import { net } from 'electron'
import fs from 'fs'
import path from 'path'
import { ChunkInfo } from './types'

// 探测文件信息
export async function probeFile(
  url: string,
  headers?: Record<string, string>
): Promise<{
  totalSize: number
  supportsRange: boolean
  filename: string
  contentType: string
}> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'HEAD',
      url
    })

    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        request.setHeader(key, value)
      }
    }

    request.on('response', (response) => {
      const totalSize = parseInt((response.headers['content-length'] as string) || '0', 10)
      const acceptRanges = response.headers['accept-ranges']
      const supportsRange = acceptRanges === 'bytes' || totalSize > 0
      const contentType = (response.headers['content-type'] as string) || ''

      // 从 Content-Disposition 或 URL 提取文件名
      let filename = ''
      const disposition = response.headers['content-disposition'] as string
      if (disposition) {
        const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)
        if (match) {
          filename = decodeURIComponent(match[1].replace(/"/g, ''))
        }
      }
      if (!filename) {
        const urlPath = new URL(url).pathname
        filename = path.basename(urlPath) || 'download'
      }

      resolve({ totalSize, supportsRange, filename, contentType })
    })

    request.on('error', (error) => {
      reject(error)
    })

    request.end()
  })
}

// 分割任务为多个 chunk
export function createChunks(totalSize: number, threads: number, tempDir: string): ChunkInfo[] {
  const chunkSize = Math.ceil(totalSize / threads)
  const chunks: ChunkInfo[] = []

  for (let i = 0; i < threads; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize - 1, totalSize - 1)
    chunks.push({
      index: i,
      start,
      end,
      downloaded: 0,
      status: 'pending',
      tempPath: path.join(tempDir, `chunk_${i}.tmp`)
    })
  }

  return chunks
}

// 下载单个 chunk
export function downloadChunk(
  url: string,
  chunk: ChunkInfo,
  headers: Record<string, string>,
  onProgress: (downloaded: number) => void,
  abortSignal: { aborted: boolean }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startByte = chunk.start + chunk.downloaded
    const endByte = chunk.end

    if (startByte > endByte) {
      chunk.status = 'completed'
      resolve()
      return
    }

    const request = net.request({ method: 'GET', url })

    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value)
    }
    request.setHeader('Range', `bytes=${startByte}-${endByte}`)

    const writeStream = fs.createWriteStream(chunk.tempPath, {
      flags: chunk.downloaded > 0 ? 'a' : 'w'
    })

    request.on('response', (response) => {
      if (response.statusCode !== 206 && response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      response.on('data', (data: Buffer) => {
        if (abortSignal.aborted) {
          request.abort()
          writeStream.close()
          chunk.status = 'paused'
          resolve()
          return
        }

        writeStream.write(data)
        chunk.downloaded += data.length
        onProgress(data.length)
      })

      response.on('end', () => {
        writeStream.close()
        chunk.status = 'completed'
        resolve()
      })

      response.on('error', (err) => {
        writeStream.close()
        chunk.status = 'error'
        reject(err)
      })
    })

    request.on('error', (err) => {
      writeStream.close()
      chunk.status = 'error'
      reject(err)
    })

    request.end()
  })
}

// 单线程下载（不支持 Range 的回退方案）
export function downloadSingleThread(
  url: string,
  savePath: string,
  headers: Record<string, string>,
  onProgress: (downloaded: number, total: number) => void,
  abortSignal: { aborted: boolean }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'GET', url })

    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value)
    }

    const writeStream = fs.createWriteStream(savePath)
    let downloaded = 0

    request.on('response', (response) => {
      const total = parseInt((response.headers['content-length'] as string) || '0', 10)

      response.on('data', (data: Buffer) => {
        if (abortSignal.aborted) {
          request.abort()
          writeStream.close()
          resolve()
          return
        }

        writeStream.write(data)
        downloaded += data.length
        onProgress(downloaded, total)
      })

      response.on('end', () => {
        writeStream.close()
        resolve()
      })

      response.on('error', (err) => {
        writeStream.close()
        reject(err)
      })
    })

    request.on('error', (err) => {
      writeStream.close()
      reject(err)
    })

    request.end()
  })
}

// 合并所有 chunk 到最终文件
export async function mergeChunks(chunks: ChunkInfo[], savePath: string): Promise<void> {
  const writeStream = fs.createWriteStream(savePath)

  for (const chunk of chunks.sort((a, b) => a.index - b.index)) {
    if (!fs.existsSync(chunk.tempPath)) {
      throw new Error(`分片文件不存在: ${chunk.tempPath}`)
    }

    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(chunk.tempPath)
      readStream.pipe(writeStream, { end: false })
      readStream.on('end', resolve)
      readStream.on('error', reject)
    })
  }

  writeStream.close()

  // 清理临时文件
  for (const chunk of chunks) {
    try {
      if (fs.existsSync(chunk.tempPath)) {
        fs.unlinkSync(chunk.tempPath)
      }
    } catch {
      // ignore
    }
  }
}
