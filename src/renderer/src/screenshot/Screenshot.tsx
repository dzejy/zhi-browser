import { useEffect, useRef, useState, useCallback } from 'react'
import { Annotation, Point, ToolType } from './tools/types'
import { drawRectangle } from './tools/Rectangle'
import { drawArrow } from './tools/Arrow'
import { drawText } from './tools/Text'
import { drawMosaic } from './tools/Mosaic'
import { drawNumber } from './tools/NumberTag'
import './styles.css'
import './styles.elegant.css'

const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#fff', '#000']

interface SourceData {
  dataUrl: string
  width: number
  height: number
  scaleFactor: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export default function Screenshot(): React.JSX.Element {
  const [source, setSource] = useState<SourceData | null>(null)
  const [phase, setPhase] = useState<'select' | 'annotate'>('select')
  const [rect, setRect] = useState<Rect | null>(null)
  const [tool, setTool] = useState<ToolType>('select')
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth] = useState(3)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [drawing, setDrawing] = useState<Annotation | null>(null)
  const [startPt, setStartPt] = useState<Point | null>(null)
  const [editingText, setEditingText] = useState<{ x: number; y: number; value: string } | null>(
    null
  )

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const applySource = (data: SourceData): void => {
      setSource(data)
      const img = new Image()
      img.onload = (): void => {
        imgRef.current = img
      }
      img.src = data.dataUrl
    }
    const off = window.api.onScreenshotSource(applySource)
    window.api
      .screenshotGetSource()
      .then((data) => {
        if (data) applySource(data)
      })
      .catch(() => {})
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        window.api.screenshotCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      off?.()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !rect) return
    canvas.width = rect.w
    canvas.height = rect.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, rect.w, rect.h)
    if (imgRef.current) {
      ctx.drawImage(
        imgRef.current,
        rect.x * (source?.scaleFactor ?? 1),
        rect.y * (source?.scaleFactor ?? 1),
        rect.w * (source?.scaleFactor ?? 1),
        rect.h * (source?.scaleFactor ?? 1),
        0,
        0,
        rect.w,
        rect.h
      )
    }
    const all = drawing ? [...annotations, drawing] : annotations
    for (const ann of all) {
      switch (ann.type) {
        case 'rectangle':
          drawRectangle(ctx, ann)
          break
        case 'arrow':
          drawArrow(ctx, ann)
          break
        case 'text':
          drawText(ctx, ann)
          break
        case 'mosaic':
          if (imgRef.current) drawMosaic(ctx, imgRef.current, ann)
          break
        case 'number':
          drawNumber(ctx, ann)
          break
      }
    }
  }, [rect, annotations, drawing, source])

  useEffect(() => {
    if (phase === 'annotate') renderCanvas()
  }, [phase, renderCanvas])

  const onMouseDown = (e: React.MouseEvent): void => {
    if (phase === 'select') {
      setStartPt({ x: e.clientX, y: e.clientY })
      setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 })
      return
    }
    if (!rect) return
    const localX = e.clientX - rect.x
    const localY = e.clientY - rect.y
    if (tool === 'text') {
      setEditingText({ x: e.clientX, y: e.clientY, value: '' })
      return
    }
    if (tool === 'number') {
      const next = annotations.filter((a) => a.type === 'number').length + 1
      setAnnotations((prev) => [
        ...prev,
        {
          type: 'number',
          color,
          strokeWidth,
          points: [{ x: localX, y: localY }],
          number: next
        }
      ])
      return
    }
    if (tool === 'select') return
    setDrawing({
      type: tool,
      color,
      strokeWidth,
      points: [{ x: localX, y: localY }]
    })
  }

  const onMouseMove = (e: React.MouseEvent): void => {
    if (phase === 'select' && startPt) {
      const x = Math.min(e.clientX, startPt.x)
      const y = Math.min(e.clientY, startPt.y)
      const w = Math.abs(e.clientX - startPt.x)
      const h = Math.abs(e.clientY - startPt.y)
      setRect({ x, y, w, h })
      return
    }
    if (drawing && rect) {
      const localX = e.clientX - rect.x
      const localY = e.clientY - rect.y
      setDrawing({ ...drawing, points: [...drawing.points, { x: localX, y: localY }] })
    }
  }

  const onMouseUp = (): void => {
    if (phase === 'select') {
      if (rect && rect.w > 5 && rect.h > 5) {
        setPhase('annotate')
      } else {
        setRect(null)
      }
      setStartPt(null)
      return
    }
    if (drawing) {
      setAnnotations((prev) => [...prev, drawing])
      setDrawing(null)
    }
  }

  const undo = (): void => {
    setAnnotations((prev) => prev.slice(0, -1))
  }

  const finishWith = (action: 'copy' | 'save' | 'pin'): void => {
    if (!rect || !canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    window.api.screenshotComplete({
      action,
      dataUrl,
      rect: { x: rect.x, y: rect.y, width: rect.w, height: rect.h }
    })
  }

  const submitText = (): void => {
    if (!editingText || !rect) {
      setEditingText(null)
      return
    }
    if (editingText.value.trim()) {
      setAnnotations((prev) => [
        ...prev,
        {
          type: 'text',
          color,
          strokeWidth,
          points: [{ x: editingText.x - rect.x, y: editingText.y - rect.y }],
          text: editingText.value
        }
      ])
    }
    setEditingText(null)
  }

  return (
    <div
      className="shot-root"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {source && (
        <div
          className="shot-bg"
          style={{ backgroundImage: `url(${source.dataUrl})` }}
        />
      )}
      {phase === 'select' && rect && (
        <div
          className="shot-selection"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        />
      )}
      {phase === 'annotate' && rect && (
        <>
          <div className="shot-mask" />
          <canvas
            ref={canvasRef}
            className="shot-canvas"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
          <div
            className="shot-toolbar"
            style={{
              left: Math.max(8, rect.x),
              top: Math.min(window.innerHeight - 50, rect.y + rect.h + 8)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {(
              [
                ['select', '↖'],
                ['rectangle', '▭'],
                ['arrow', '➤'],
                ['text', 'T'],
                ['mosaic', '▦'],
                ['number', '①']
              ] as Array<[ToolType, string]>
            ).map(([t, label]) => (
              <button
                key={t}
                className={`shot-tool-btn ${tool === t ? 'active' : ''}`}
                onClick={() => setTool(t)}
              >
                {label}
              </button>
            ))}
            <div className="shot-color-row">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`shot-color ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <button className="shot-tool-btn" onClick={undo} title="撤销">
              ↶
            </button>
            <button className="shot-action-btn" onClick={() => finishWith('copy')}>
              复制
            </button>
            <button className="shot-action-btn" onClick={() => finishWith('save')}>
              保存
            </button>
            <button className="shot-action-btn" onClick={() => finishWith('pin')}>
              贴图
            </button>
            <button
              className="shot-action-btn cancel"
              onClick={() => window.api.screenshotCancel()}
            >
              取消
            </button>
          </div>
          {editingText && (
            <textarea
              className="shot-text-input"
              autoFocus
              style={{ left: editingText.x, top: editingText.y, color }}
              value={editingText.value}
              onChange={(e) => setEditingText({ ...editingText, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitText()
                } else if (e.key === 'Escape') {
                  setEditingText(null)
                }
              }}
              onBlur={submitText}
              onMouseDown={(e) => e.stopPropagation()}
            />
          )}
        </>
      )}
    </div>
  )
}
