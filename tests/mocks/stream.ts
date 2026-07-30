import { vi } from 'vitest'

interface StreamTextResult {
  toTextStreamResponse: () => Response
  toDataStreamResponse: () => Response
}

interface StreamTextParams {
  model: unknown
  system: string
  messages: Array<{ role: string; content: string }>
  onFinish?: (result: { usage: unknown; text: string }) => Promise<void>
  maxTokens?: number
  temperature?: number
}

export function createMockStreamText(responseText?: string) {
  const text = responseText ?? 'Esta es una respuesta simulada del stream.'

  const mockResult: StreamTextResult = {
    toTextStreamResponse: vi.fn(() => {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(text))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }),
    toDataStreamResponse: vi.fn(() => new Response()),
  }

  const streamText = vi.fn()

  streamText.mockImplementation((params: StreamTextParams) => {
    const onFinish = params.onFinish
    if (onFinish) {
      setTimeout(() => {
        onFinish({
          usage: { promptTokens: 50, completionTokens: 20 },
          text,
        }).catch(() => {})
      }, 0)
    }
    return mockResult
  })

  return { streamText, mockResult }
}

export type MockStreamText = ReturnType<typeof createMockStreamText>
