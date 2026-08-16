import { describe, it, expect, vi } from 'vitest'
import { createSseParser, type SseParsedEvent } from '@/lib/chat/sse'

const encoder = new TextEncoder()

const product = {
  productId: 'prod-1',
  name: 'Clean Nails',
  price: 45,
  imageUrl: null,
  description: null,
  benefits: null,
}

describe('createSseParser', () => {
  it('acumula los text-delta y emite el evento product', () => {
    const parser = createSseParser((event) => collected.events.push(event))
    const collected = { events: [] as SseParsedEvent[] }

    parser.push(
      encoder.encode(
        [
          `data: ${JSON.stringify({ type: 'text-delta', delta: 'Te recomiendo ' })}\n\n`,
          `data: ${JSON.stringify({ type: 'text-delta', delta: 'Clean Nails.' })}\n\n`,
          `data: ${JSON.stringify({ type: 'data', data: { type: 'product', product } })}\n\n`,
          'data: [DONE]\n\n',
        ].join('')
      )
    )
    parser.flush()

    expect(collected.events).toEqual([
      { type: 'text-delta', delta: 'Te recomiendo ' },
      { type: 'text-delta', delta: 'Clean Nails.' },
      { type: 'product', product },
    ])
  })

  it('emite el evento media para un data part de media condicional', () => {
    const parser = createSseParser((event) => collected.events.push(event))
    const collected = { events: [] as SseParsedEvent[] }
    const media = {
      imageUrl: 'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/img.jpg',
      mediaType: 'image',
    }

    parser.push(
      encoder.encode(
        [
          `data: ${JSON.stringify({ type: 'text-delta', delta: 'Aquí tienes la foto:' })}\n\n`,
          `data: ${JSON.stringify({ type: 'data', data: { type: 'media', media } })}\n\n`,
          'data: [DONE]\n\n',
        ].join('')
      )
    )
    parser.flush()

    expect(collected.events).toEqual([
      { type: 'text-delta', delta: 'Aquí tienes la foto:' },
      { type: 'media', media },
    ])
  })

  it('emite unknown para un media part sin forma valida', () => {
    const onEvent = vi.fn()
    const parser = createSseParser(onEvent)

    parser.push(
      encoder.encode(
        `data: ${JSON.stringify({ type: 'data', data: { type: 'media', media: { imageUrl: 123 } } })}\n\n`
      )
    )
    parser.flush()

    expect(onEvent).toHaveBeenCalledWith({ type: 'unknown' })
  })

  it('soporta eventos divididos entre chunks', () => {
    const parser = createSseParser((event) => collected.events.push(event))
    const collected = { events: [] as SseParsedEvent[] }
    const chunk =
      `data: ${JSON.stringify({ type: 'text-delta', delta: 'Hola, ' })}\n\n` +
      `data: ${JSON.stringify({ type: 'text-delta', delta: 'mundo' })}\n\n`

    parser.push(encoder.encode(chunk.slice(0, 30)))
    parser.push(encoder.encode(chunk.slice(30)))
    parser.flush()

    expect(collected.events).toEqual([
      { type: 'text-delta', delta: 'Hola, ' },
      { type: 'text-delta', delta: 'mundo' },
    ])
  })

  it('ignora el centinela [DONE] y líneas que no son data', () => {
    const parser = createSseParser((event) => collected.events.push(event))
    const collected = { events: [] as SseParsedEvent[] }

    parser.push(encoder.encode('data: [DONE]\n\n'))
    parser.push(encoder.encode(': keepalive\n\n'))
    parser.push(encoder.encode('event: ping\n\n'))
    parser.flush()

    expect(collected.events).toEqual([])
  })

  it('emite unknown para payloads sin product ni text-delta y JSON inválido', () => {
    const onEvent = vi.fn()
    const parser = createSseParser(onEvent)

    parser.push(
      encoder.encode(
        [
          `data: ${JSON.stringify({ type: 'data', data: { type: 'other' } })}\n\n`,
          'data: no-es-json\n\n',
        ].join('')
      )
    )
    parser.flush()

    expect(onEvent).toHaveBeenCalledWith({ type: 'unknown' })
    expect(onEvent).toHaveBeenCalledTimes(2)
  })

  it('flush no emite eventos espurios tras un stream completo', () => {
    const onEvent = vi.fn()
    const parser = createSseParser(onEvent)

    parser.push(encoder.encode(`data: ${JSON.stringify({ type: 'text-delta', delta: 'Completo' })}\n\n`))
    parser.push(encoder.encode('data: [DONE]\n\n'))
    parser.flush()

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({ type: 'text-delta', delta: 'Completo' })
  })
})
