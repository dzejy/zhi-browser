import { Annotation } from './types'

export function drawNumber(ctx: CanvasRenderingContext2D, ann: Annotation): void {
  if (ann.points.length === 0 || ann.number == null) return
  const p = ann.points[0]
  const radius = Math.max(12, ann.strokeWidth * 5)
  ctx.save()
  ctx.fillStyle = ann.color
  ctx.beginPath()
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${radius}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(ann.number), p.x, p.y)
  ctx.restore()
}
