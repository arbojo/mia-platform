import type { ProductReference } from '@/lib/channels/types'

export interface MediaStreamReference {
  imageUrl: string
  mediaType: 'image' | 'testimonial'
}

export interface StructuredStreamOptions {
  textStream: AsyncIterable<string>
  product?: ProductReference | null
  media?: MediaStreamReference | null
}

export function buildStructuredStreamResponse({
  textStream,
  product,
  media,
}: StructuredStreamOptions): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of textStream) {
          controller.enqueue(encoder.encode(sseEvent({ type: 'text-delta', delta })))
        }
        if (product) {
          controller.enqueue(
            encoder.encode(sseEvent({ type: 'data', data: { type: 'product', product } }))
          )
        }
        if (media) {
          controller.enqueue(
            encoder.encode(sseEvent({ type: 'data', data: { type: 'media', media } }))
          )
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (error) {
        controller.error(error)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

function sseEvent(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}
