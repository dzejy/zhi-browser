import { Annotation } from './types'

export function drawMosaic(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLCanvasElement,
  ann: Annotation,
  blockSize = 12
): void {
  if (ann.points.length === 0) return
  const radius = Math.max(8, ann.strokeWidth * 4)
  ctx.save()
  for (const p of ann.points) {
    const x0 = Math.floor((p.x - radius) / blockSize) * blockSize
    const y0 = Math.floor((p.y - radius) / blockSize) * blockSize
    const cells = Math.ceil((radius * 2) / blockSize) + 1
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const sx = x0 + i * blockSize
        const sy = y0 + j * blockSize
        try {
          ctx.drawImage(source, sx, sy, blockSize, blockSize, sx, sy, blockSize, blockSize)
          const sample = ctx.getImageData(sx, sy, 1, 1).data
          ctx.fillStyle = `rgb(${sample[0]}, ${sample[1]}, ${sample[2]})`
          ctx.fillRect(sx, sy, blockSize, blockSize)
        } catch {}
      }
    }
  }
  ctx.restore()
}
