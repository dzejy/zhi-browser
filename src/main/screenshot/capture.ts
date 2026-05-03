import { desktopCapturer, nativeImage, screen, WebContents } from 'electron'
import { ScreenshotData } from './types'

function isNearlyBlack(image: Electron.NativeImage): boolean {
  try {
    const sample = image.resize({ width: 64, height: 64 }).toBitmap()
    if (sample.length === 0) return true
    let total = 0
    for (let i = 0; i < sample.length; i += 4) {
      total += sample[i] + sample[i + 1] + sample[i + 2]
    }
    return total / (sample.length / 4) < 6
  } catch {
    return false
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('capture-timeout')), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function captureActivePage(wc?: WebContents | null): Promise<ScreenshotData | null> {
  if (!wc || wc.isDestroyed()) return null
  try {
    const image = await withTimeout(wc.capturePage(), 1500)
    if (image.isEmpty()) return null
    const display = screen.getPrimaryDisplay()
    const size = image.getSize()
    const scaleFactor = Math.max(1, size.width / Math.max(1, display.size.width))
    return {
      dataUrl: image.toDataURL(),
      width: Math.round(size.width / scaleFactor),
      height: Math.round(size.height / scaleFactor),
      scaleFactor
    }
  } catch {
    return null
  }
}

export async function captureFullScreen(wc?: WebContents | null): Promise<ScreenshotData | null> {
  const activePage = await captureActivePage(wc)
  if (activePage) {
    const activeImage = nativeImage.createFromDataURL(activePage.dataUrl)
    if (!activeImage.isEmpty() && !isNearlyBlack(activeImage)) return activePage
  }

  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size
  const scaleFactor = display.scaleFactor

  try {
    const sources = await withTimeout(
      desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(width * scaleFactor),
          height: Math.round(height * scaleFactor)
        }
      }),
      1500
    )
    if (sources.length === 0) return null
    const source =
      sources.find((item) => item.display_id === String(display.id)) ||
      sources.find((item) => item.id.includes(String(display.id))) ||
      sources[0]
    const image = nativeImage.createFromDataURL(source.thumbnail.toDataURL())
    if (image.isEmpty() || isNearlyBlack(image)) {
      if (activePage) return activePage
    }
    return {
      dataUrl: source.thumbnail.toDataURL(),
      width,
      height,
      scaleFactor
    }
  } catch {
    return captureActivePage(wc)
  }
}
