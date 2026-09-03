import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/channels/adapters/widget', () => ({
  WidgetAdapter: class {
    receiveMessage = vi.fn(async () => ({
      externalId: 'external-1',
      customerExternalId: 'customer-1',
      customerName: 'Juan',
    }))
  },
}))

vi.mock('@/lib/channels/identity', () => ({
  resolveCustomer: vi.fn(),
}))

vi.mock('@/lib/conversation/resolver', () => ({
  resolveConversation: vi.fn(),
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

import { POST } from '@/app/api/widget/chat/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { processStreaming } from '@/lib/runtime/runtime'
import { resolveConversation } from '@/lib/conversation/resolver'
import { resolveCustomer } from '@/lib/channels/identity'

const ASSISTANT_ID = 'a0000000-0000-4000-8000-000000000001'
const CUSTOMER_ID = 'c0000000-0000-4000-8000-000000000002'

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
  `data: ${JSON.stringify({ type: 'data', data: { type: 'product', product } })}\n\n`,
  'data: [DONE]\n\n',
].join('')

function mockAdminClient(assistant: unknown) {
  const assistantChain = {
    select: vi.fn(() => assistantChain),
    eq: vi.fn(() => assistantChain),
    single: vi.fn(() => Promise.resolve({ data: assistant, error: null })),
  }
  const messagesChain = {
    insert: vi.fn(() => Promise.resolve({ error: null })),
  }
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table: string) => (table === 'assistants' ? assistantChain : messagesChain)),
  } as never)
  return { assistantChain, messagesChain }
}

function widgetRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/widget/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validBody() {
  return {
    messages: [{ role: 'user', content: '¿cuánto cuesta?' }],
    assistantId: ASSISTANT_ID,
    landingContext: { landingId: 'landing-1', brand: 'Vitanova', product: 'Esmalte' },
  }
}

function mockStreamingResult() {
  vi.mocked(processStreaming).mockResolvedValue({
    toStructuredStreamResponse: () =>
      new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } }),
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveCustomer).mockResolvedValue({ id: CUSTOMER_ID } as never)
  vi.mocked(resolveConversation).mockResolvedValue('conv-1')
})

describe('POST /api/widget/chat', () => {
  it('responde 400 sin assistantId', async () => {
    const res = await POST(widgetRequest({ messages: [{ role: 'user', content: 'hola' }] }))
    expect(res.status).toBe(400)
  })

  it('responde 400 sin messages', async () => {
    const res = await POST(widgetRequest({ assistantId: ASSISTANT_ID }))
    expect(res.status).toBe(400)
  })

  it('responde 400 con landing context inválido', async () => {
    const res = await POST(widgetRequest({ ...validBody(), landingContext: { product: 'x' } }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.code).toBe('INVALID_LANDING_CONTEXT')
  })

  it('responde 404 cuando el assistant no existe o está inactivo', async () => {
    mockAdminClient(null)
    const res = await POST(widgetRequest(validBody()))
    expect(res.status).toBe(404)
  })

  it('responde el stream estructurado y conserva los headers X-MIA', async () => {
    mockAdminClient({ id: ASSISTANT_ID, business_id: 'biz-1' })
    mockStreamingResult()

    const res = await POST(widgetRequest(validBody()))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('X-MIA-Conversation-Id')).toBe('conv-1')
    expect(['1', '0']).toContain(res.headers.get('X-MIA-Sales-Intent'))

    const body = await res.text()
    expect(body).toContain('"type":"text-delta"')
    expect(body).toContain('"type":"product"')
    expect(body).toContain('"productId":"prod-1"')
    expect(body).toContain('data: [DONE]')
  })

  it('no setea X-MIA-Conversation-Id cuando no hay conversación', async () => {
    mockAdminClient({ id: ASSISTANT_ID, business_id: 'biz-1' })
    mockStreamingResult()
    vi.mocked(resolveConversation).mockResolvedValue(null)

    const res = await POST(widgetRequest(validBody()))

    expect(res.headers.get('X-MIA-Conversation-Id')).toBeNull()
    expect(res.status).toBe(200)
  })

  it('propaga errores RuntimeError', async () => {
    mockAdminClient({ id: ASSISTANT_ID, business_id: 'biz-1' })
    vi.mocked(processStreaming).mockRejectedValue(new MockRuntimeError('Sin crédito', 'QUOTA_EXCEEDED', 402))

    const res = await POST(widgetRequest(validBody()))

    expect(res.status).toBe(402)
    const data = await res.json()
    expect(data).toEqual({ error: 'Sin crédito', code: 'QUOTA_EXCEEDED' })
  })

  it('CHANNEL-PARITY (LOOP 2): entra al Core con channel widget explícito', async () => {
    // Nota: los mocks legacy de este archivo omiten is_active y fallan
    // canServeTraffic (fallo pre-existente en HEAD, fuera de scope). Este test
    // provee el assistant completo para verificar el contrato del channel.
    mockAdminClient({ id: ASSISTANT_ID, business_id: 'biz-1', is_active: true, status: 'active' })
    mockStreamingResult()

    await POST(widgetRequest(validBody()))

    expect(processStreaming).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'widget',
        businessId: 'biz-1',
        requestType: 'live_customer',
      })
    )
  })
})
