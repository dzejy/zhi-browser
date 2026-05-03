import { WebContents } from 'electron'

export interface LongCaptureSlice {
  dataUrl: string
  scrollY: number
  height: number
}

export async function captureLongPage(wc: WebContents): Promise<LongCaptureSlice[]> {
  const slices: LongCaptureSlice[] = []

  const dims = (await wc.executeJavaScript(`(() => ({
    viewport: window.innerHeight,
    total: document.documentElement.scrollHeight
  }))()`)) as { viewport: number; total: number }

  const viewportH = Math.max(1, dims.viewport)
  const totalH = Math.max(viewportH, dims.total)
  const stepCount = Math.ceil(totalH / viewportH)

  await wc.executeJavaScript('window.scrollTo(0, 0)')
  await delay(150)

  for (let i = 0; i < stepCount; i++) {
    const targetY = Math.min(i * viewportH, totalH - viewportH)
    await wc.executeJavaScript(`window.scrollTo(0, ${targetY})`)
    await delay(180)
    const image = await wc.capturePage()
    slices.push({
      dataUrl: image.toDataURL(),
      scrollY: targetY,
      height: viewportH
    })
  }

  await wc.executeJavaScript('window.scrollTo(0, 0)')
  return slices
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
