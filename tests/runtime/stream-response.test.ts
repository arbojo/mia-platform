import { describe, it, expect } from 'vitest'
import { buildStructuredStreamResponse } from '@/lib/runtime/stream-response'

function mockTextStream(deltas: string[]): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const delta of deltas) yield delta
    },
  }
}

async function readEvents(response: Response): Promise<{
  events: Array<Record<string, unknown>>
  raw: string
}> {
  const raw = await response.text()
  const events = raw
    .split('\n\n')
    .filter((line) => line.startsWith('data: '))
    .filter((line) => line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice('data: '.length)) as Record<string, unknown>)
  return { events, raw }
}

const product = {
  productId: 'prod-1',
  name: 'Clean Nails',
  price: 45,
  imageUrl: 'https://example.com/cn.jpg',
  description: 'Tratamiento de uñas',
  benefits: 'Duradero, natural',
}

describe('buildStructuredStreamResponse', () => {
  it('emite un text-delta por cada delta y cierra con [DONE]', async () => {
    const response = buildStructuredStreamResponse({
      textStream: mockTextStream(['Hola, ', 'te recomiendo ', 'Clean Nails.']),
      product: null,
    })

    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const { events, raw } = await readEvents(response)

    expect(events).toEqual([
      { type: 'text-delta', delta: 'Hola, ' },
      { type: 'text-delta', delta: 'te recomiendo ' },
      { type: 'text-delta', delta: 'Clean Nails.' },
    ])
    expect(raw).toContain('data: [DONE]')
  })

  it('incluye el data part product al final cuando hay producto', async () => {
    const response = buildStructuredStreamResponse({
      textStream: mockTextStream(['Te muestro:']),
      product,
    })

    const { events } = await readEvents(response)

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'text-delta', delta: 'Te muestro:' })
    expect(events[1]).toEqual({ type: 'data', data: { type: 'product', product } })
  })

  it('omite el data part product cuando el producto es null', async () => {
    const response = buildStructuredStreamResponse({
      textStream: mockTextStream(['Solo texto.']),
      product: null,
    })

    const { events } = await readEvents(response)

    expect(events).toEqual([{ type: 'text-delta', delta: 'Solo texto.' }])
  })

  it('incluye el data part media cuando hay media condicional', async () => {
    const media = {
      imageUrl: 'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/img.jpg',
      mediaType: 'image' as const,
    }
    const response = buildStructuredStreamResponse({
      textStream: mockTextStream(['Aquí tienes:']),
      media,
    })

    const { events } = await readEvents(response)

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'text-delta', delta: 'Aquí tienes:' })
    expect(events[1]).toEqual({ type: 'data', data: { type: 'media', media } })
  })

  it('omite el data part media cuando media es null', async () => {
    const response = buildStructuredStreamResponse({
      textStream: mockTextStream(['Solo texto.']),
      product: null,
      media: null,
    })

    const { events } = await readEvents(response)

    expect(events).toEqual([{ type: 'text-delta', delta: 'Solo texto.' }])
  })
})
