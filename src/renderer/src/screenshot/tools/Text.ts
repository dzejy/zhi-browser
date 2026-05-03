import { Annotation } from './types'

export function drawText(ctx: CanvasRenderingContext2D, ann: Annotation): void {
  if (!ann.text || ann.points.length === 0) return
  const p = ann.points[0]
  const fontSize = Math.max(14, ann.strokeWidth * 5)
  ctx.save()
  ctx.fillStyle = ann.color
  ctx.font = `${fontSize}px sans-serif`
  ctx.textBaseline = 'top'
  const lines = ann.text.split('\n')
  lines.forEach((line, i) => {
    ctx.fillText(line, p.x, p.y + i * (fontSize + 4))
  })
  ctx.restore()
}
