import type { ProductReference } from '@/lib/channels/types'

export type SseParsedEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'product'; product: ProductReference }
  | { type: 'unknown' }

export interface SseParser {
  push(value: Uint8Array): void
  flush(): void
}

export function createSseParser(onEvent: (event: SseParsedEvent) => void): SseParser {
  let buffer = ''
  const decoder = new TextDecoder()

  function drain(): void {
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).trim()
      buffer = buffer.slice(boundary + 2)
      if (line.startsWith('data: ')) {
        parseLine(line.slice('data: '.length).trim(), onEvent)
      }
      boundary = buffer.indexOf('\n\n')
    }
  }

  return {
    push(value) {
      buffer += decoder.decode(value, { stream: true })
      drain()
    },
    flush() {
      buffer += decoder.decode()
      drain()
    },
  }
}

function parseLine(payload: string, onEvent: (event: SseParsedEvent) => void): void {
  if (payload === '[DONE]') return
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>
    if (parsed.type === 'text-delta' && typeof parsed.delta === 'string') {
      onEvent({ type: 'text-delta', delta: parsed.delta })
      return
    }
    if (parsed.type === 'data' && isProductData(parsed.data)) {
      onEvent({ type: 'product', product: parsed.data.product })
      return
    }
    onEvent({ type: 'unknown' })
  } catch {
    onEvent({ type: 'unknown' })
  }
}

function isProductData(data: unknown): data is { type: 'product'; product: ProductReference } {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  if (record.type !== 'product' || !record.product) return false
  const product = record.product as Record<string, unknown>
  return typeof product.productId === 'string' && typeof product.name === 'string'
}
