import { Annotation } from './types'

export function drawArrow(ctx: CanvasRenderingContext2D, ann: Annotation): void {
  if (ann.points.length < 2) return
  const a = ann.points[0]
  const b = ann.points[ann.points.length - 1]
  const headLen = Math.max(10, ann.strokeWidth * 4)
  const angle = Math.atan2(b.y - a.y, b.x - a.x)

  ctx.save()
  ctx.strokeStyle = ann.color
  ctx.fillStyle = ann.color
  ctx.lineWidth = ann.strokeWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(b.x, b.y)
  ctx.lineTo(
    b.x - headLen * Math.cos(angle - Math.PI / 6),
    b.y - headLen * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    b.x - headLen * Math.cos(angle + Math.PI / 6),
    b.y - headLen * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
