import fs from 'fs'
import path from 'path'
import { app, net } from 'electron'
import AdmZip from 'adm-zip'

const EXTENSIONS_DIR = path.join(app.getPath('userData'), 'extensions')

export class ExtensionInstaller {
  constructor() {
    if (!fs.existsSync(EXTENSIONS_DIR)) {
      fs.mkdirSync(EXTENSIONS_DIR, { recursive: true })
    }
  }

  getExtensionsDir(): string {
    return EXTENSIONS_DIR
  }

  parseWebStoreUrl(url: string): string | null {
    const trimmed = url.trim()
    const match1 = trimmed.match(/chromewebstore\.google\.com\/detail\/[^/]+\/([a-z]{32})/)
    if (match1) return match1[1]

    const match2 = trimmed.match(/chrome\.google\.com\/webstore\/detail\/[^/]+\/([a-z]{32})/)
    if (match2) return match2[1]

    if (/^[a-z]{32}$/.test(trimmed)) return trimmed
    return null
  }

  async downloadCrx(extensionId: string): Promise<string> {
    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`
    const crxPath = path.join(EXTENSIONS_DIR, `${extensionId}.crx`)
    const buffer = await this.downloadBuffer(crxUrl, 0)
    fs.writeFileSync(crxPath, buffer)
    return crxPath
  }

  async unpackCrx(crxPath: string, extensionId: string): Promise<string> {
    const outputDir = path.join(EXTENSIONS_DIR, extensionId)

    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
    fs.mkdirSync(outputDir, { recursive: true })

    const buffer = fs.readFileSync(crxPath)
    const magic = buffer.toString('utf-8', 0, 4)
    if (magic !== 'Cr24') {
      throw new Error('不是有效的 CRX 文件')
    }

    const version = buffer.readUInt32LE(4)
    let zipStart = 0
    if (version === 2) {
      const publicKeyLength = buffer.readUInt32LE(8)
      const signatureLength = buffer.readUInt32LE(12)
      zipStart = 16 + publicKeyLength + signatureLength
    } else if (version === 3) {
      const headerLength = buffer.readUInt32LE(8)
      zipStart = 12 + headerLength
    } else {
      throw new Error(`不支持的 CRX 版本：${version}`)
    }

    const zipPath = path.join(EXTENSIONS_DIR, `${extensionId}.zip`)
    fs.writeFileSync(zipPath, buffer.subarray(zipStart))

    const zip = new AdmZip(zipPath)
    zip.extractAllTo(outputDir, true)

    fs.rmSync(crxPath, { force: true })
    fs.rmSync(zipPath, { force: true })
    return outputDir
  }

  getLocalExtensionPath(sourcePath: string): string {
    return sourcePath
  }

  private downloadBuffer(url: string, redirectCount: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (redirectCount > 5) {
        reject(new Error('CRX 下载重定向次数过多'))
        return
      }

      const request = net.request(url)
      request.on('response', (response) => {
        const location = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location

        if (response.statusCode >= 300 && response.statusCode < 400 && location) {
          this.downloadBuffer(location, redirectCount + 1).then(resolve).catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          reject(new Error(`下载失败：HTTP ${response.statusCode}`))
          return
        }

        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => resolve(Buffer.concat(chunks)))
      })
      request.on('error', reject)
      request.end()
    })
  }
}
