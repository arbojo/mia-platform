import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

import { GET } from '@/app/api/conversations/[id]/messages/route'
import { requireAuth } from '@/lib/auth'

const mockedRequireAuth = vi.mocked(requireAuth)

const product = {
  productId: 'prod-1',
  name: 'Clean Nails',
  price: 45,
  imageUrl: null,
  description: null,
  benefits: null,
}

function mockSupabase(messages: unknown[]) {
  const messagesChain = {
    select: vi.fn(() => messagesChain),
    eq: vi.fn(() => messagesChain),
    order: vi.fn(() => Promise.resolve({ data: messages, error: null })),
  }
  const convChain = {
    select: vi.fn(() => convChain),
    eq: vi.fn(() => convChain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'conv-1' }, error: null })),
  }
  const supabase = {
    from: vi.fn((table: string) => (table === 'conversations' ? convChain : messagesChain)),
  }
  mockedRequireAuth.mockResolvedValue({ supabase } as never)
  return { messagesChain, convChain }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/conversations/[id]/messages', () => {
  it('devuelve los mensajes con metadata para restaurar la tarjeta', async () => {
    const messages = [
      { id: 'm-1', role: 'user', content: '¿cuánto cuesta?', created_at: 't1', metadata: null },
      {
        id: 'm-2',
        role: 'assistant',
        content: 'Te recomiendo Clean Nails.',
        created_at: 't2',
        metadata: { product_id: 'prod-1', product },
      },
    ]
    const { messagesChain } = mockSupabase(messages)

    const res = await GET(
      new Request('http://localhost/api/conversations/conv-1/messages') as never,
      { params: Promise.resolve({ id: 'conv-1' }) }
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.messages).toEqual(messages)
    expect(messagesChain.select).toHaveBeenCalledWith('id, role, content, created_at, metadata')
  })

  it('responde 404 si la conversación no existe', async () => {
    const convChain = {
      select: vi.fn(() => convChain),
      eq: vi.fn(() => convChain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }
    mockedRequireAuth.mockResolvedValue({
      supabase: { from: vi.fn(() => convChain) },
    } as never)

    const res = await GET(
      new Request('http://localhost/api/conversations/conv-404/messages') as never,
      { params: Promise.resolve({ id: 'conv-404' }) }
    )

    expect(res.status).toBe(404)
  })
})
