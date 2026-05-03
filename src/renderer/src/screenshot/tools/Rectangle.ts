import { Annotation } from './types'

export function drawRectangle(ctx: CanvasRenderingContext2D, ann: Annotation): void {
  if (ann.points.length < 2) return
  const [a, b] = [ann.points[0], ann.points[ann.points.length - 1]]
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x)
  const h = Math.abs(b.y - a.y)
  ctx.save()
  ctx.strokeStyle = ann.color
  ctx.lineWidth = ann.strokeWidth
  ctx.strokeRect(x, y, w, h)
  ctx.restore()
}
