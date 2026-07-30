import { vi } from 'vitest'

interface CompletionResponse {
  id: string
  choices: Array<{
    message: { content: string }
    finish_reason: string
    index: number
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface StreamChunk {
  choices: Array<{
    delta: { content?: string }
    index: number
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

function createMockCompletions(responseText?: string) {
  const text = responseText ?? 'Esta es una respuesta de prueba del asistente.'

  const completeResponse: CompletionResponse = {
    id: 'chatcmpl-test-001',
    choices: [
      {
        message: { content: text },
        finish_reason: 'stop',
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 20,
      total_tokens: 70,
    },
  }

  const streamChunks: StreamChunk[] = [
    ...text.split(' ').map((word, i, _arr) => ({
      choices: [
        {
          delta: { content: i === 0 ? word : ` ${word}` },
          index: 0,
          finish_reason: null,
        },
      ],
    })),
    {
      choices: [
        {
          delta: {},
          index: 0,
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 20,
        total_tokens: 70,
      },
    },
  ]

  const create = vi.fn()

  create.mockImplementation((params?: { stream?: boolean }) => {
    if (params?.stream) {
      return createMockAsyncIterable(streamChunks)
    }
    return Promise.resolve(completeResponse)
  })

  async function* createMockAsyncIterable(chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
    for (const chunk of chunks) {
      yield chunk
    }
  }

  return {
    chat: {
      completions: {
        create,
      },
    },
    create,
  }
}

export function createMockOpenAIClient(responseText?: string) {
  const completions = createMockCompletions(responseText)
  return {
    chat: completions.chat,
    completionsCreate: completions.create,
  }
}

export type MockOpenAIClient = ReturnType<typeof createMockOpenAIClient>
