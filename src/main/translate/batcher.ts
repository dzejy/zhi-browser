export interface TranslatePageSegment {
  id: string
  text: string
}

const MAX_BATCH_SEGMENTS = 12
const MAX_BATCH_CHARS = 2500

export function buildTranslateBatches(
  segments: TranslatePageSegment[]
): TranslatePageSegment[][] {
  const batches: TranslatePageSegment[][] = []
  let currentBatch: TranslatePageSegment[] = []
  let currentLength = 0

  for (const segment of segments) {
    if (
      currentBatch.length >= MAX_BATCH_SEGMENTS ||
      (currentBatch.length > 0 && currentLength + segment.text.length > MAX_BATCH_CHARS)
    ) {
      batches.push(currentBatch)
      currentBatch = []
      currentLength = 0
    }

    currentBatch.push(segment)
    currentLength += segment.text.length
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

export function buildBatchPrompt(batch: TranslatePageSegment[]): string {
  return batch.map((segment, index) => `[${index + 1}] ${segment.text}`).join('\n\n')
}

export function parseNumberedTranslation(response: string, count: number): string[] {
  const results = Array<string>(count).fill('')
  const pattern = /\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(response)) !== null) {
    const number = Number.parseInt(match[1], 10)
    const index = number - 1
    if (index >= 0 && index < count) {
      results[index] = match[2].trim()
    }
  }

  return results
}

export function normalizeTranslateSegments(value: unknown): TranslatePageSegment[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is TranslatePageSegment => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.text === 'string'
  })
}
