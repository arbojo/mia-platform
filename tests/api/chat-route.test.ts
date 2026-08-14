import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const { MockRuntimeError } = vi.hoisted(() => {
  class MockRuntimeError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode = 500
    ) {
      super(message)
      this.name = 'RuntimeError'
    }
  }
  return { MockRuntimeError }
})

vi.mock('@/lib/runtime/runtime', () => ({
  processStreaming: vi.fn(),
  RuntimeError: MockRuntimeError,
}))

import { POST } from '@/app/api/chat/route'
import { createClient } from '@/lib/supabase/server'
import { processStreaming } from '@/lib/runtime/runtime'

const ASSISTANT_ID = 'a0000000-0000-4000-8000-000000000001'
const USER_ID = 'e0000000-0000-4000-8000-000000000005'

const product = {
  productId: 'prod-1',
  name: 'Clean Nails',
  price: 45,
  imageUrl: null,
  description: null,
  benefits: null,
}

const sseBody = [
  `data: ${JSON.stringify({ type: 'text-delta', delta: 'Te recomiendo ' })}\n\n`,
  `data: ${JSON.stringify({ type: 'text-delta', delta: 'Clean Nails.' })}\n\n`,
  `data: ${JSON.stringify({ type: 'data', data: { type: 'product', product } })}\n\n`,
  'data: [DONE]\n\n',
].join('')

function mockServerClient(overrides: { ownerId?: string | null; assistantMissing?: boolean } = {}) {
  const assistant = overrides.assistantMissing
    ? null
    : { id: ASSISTANT_ID, business_id: 'biz-1', businesses: { id: 'biz-1', owner_id: overrides.ownerId ?? USER_ID } }
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: assistant, error: null })),
  }
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser },
    from: vi.fn(() => chain),
  } as never)
  return { getUser }
}

function postRequest() {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '¿qué me recomiendas?' }],
      assistantId: ASSISTANT_ID,
      requestType: 'training',
    }),
  })
}

function mockStreamingResult() {
  vi.mocked(processStreaming).mockResolvedValue({
    toTextStreamResponse: () => new Response('texto plano'),
    toStructuredStreamResponse: () =>
      new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } }),
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/chat', () => {
  it('responde 401 sin usuario autenticado', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never)

    const res = await POST(postRequest())

    expect(res.status).toBe(401)
  })

  it('responde 400 con body inválido', async () => {
    mockServerClient()
    const res = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      })
    )

    expect(res.status).toBe(400)
  })

  it('responde 403 cuando el negocio no pertenece al usuario', async () => {
    mockServerClient({ ownerId: 'otro-usuario' })
    mockStreamingResult()

    const res = await POST(postRequest())

    expect(res.status).toBe(403)
  })

  it('responde el stream estructurado con text-delta y el data part product', async () => {
    mockServerClient()
    mockStreamingResult()

    const res = await POST(postRequest())

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const body = await res.text()
    expect(body).toContain('"type":"text-delta"')
    expect(body).toContain('"type":"product"')
    expect(body).toContain('"productId":"prod-1"')
    expect(body).toContain('"name":"Clean Nails"')
    expect(body).toContain('data: [DONE]')
  })

  it('propaga errores RuntimeError con su código y status', async () => {
    mockServerClient()
    vi.mocked(processStreaming).mockRejectedValue(new MockRuntimeError('Conversación cerrada', 'CONVERSATION_CLOSED', 410))

    const res = await POST(postRequest())

    expect(res.status).toBe(410)
    const data = await res.json()
    expect(data).toEqual({ error: 'Conversación cerrada', code: 'CONVERSATION_CLOSED' })
  })

  it('devuelve 500 ante errores inesperados', async () => {
    mockServerClient()
    vi.mocked(processStreaming).mockRejectedValue(new Error('boom'))

    const res = await POST(postRequest())

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Internal server error')
  })
})
