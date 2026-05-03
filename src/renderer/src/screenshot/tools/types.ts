export type ToolType =
  | 'select'
  | 'rectangle'
  | 'arrow'
  | 'text'
  | 'mosaic'
  | 'number'

export interface Point {
  x: number
  y: number
}

export interface Annotation {
  type: ToolType
  color: string
  strokeWidth: number
  points: Point[]
  text?: string
  number?: number
}
