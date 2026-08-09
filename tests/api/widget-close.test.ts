import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      ok: (init?.status ?? 200) < 400,
      body,
      async json() {
        return body
      },
    }),
  },
  NextRequest: class {
    url: string
    constructor(url: string) {
      this.url = url
    }
  },
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/conversation/resolver', () => ({ resolveConversation: vi.fn() }))
vi.mock('@/lib/sales/widget', () => ({ recordWidgetSale: vi.fn() }))
vi.mock('@/lib/ai/knowledge', () => {
  class MockLandingContextError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode: number = 400
    ) {
      super(message)
      this.name = 'LandingContextError'
    }
  }
  return { LandingContextError: MockLandingContextError }
})

import { POST } from '@/app/api/widget/close/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCustomer } from '@/lib/channels/identity'
import { resolveConversation } from '@/lib/conversation/resolver'
import { recordWidgetSale } from '@/lib/sales/widget'

const mockedAdmin = vi.mocked(createAdminClient)
const mockedResolveCustomer = vi.mocked(resolveCustomer)
const mockedResolveConversation = vi.mocked(resolveConversation)
const mockedRecordWidgetSale = vi.mocked(recordWidgetSale)

function makeTable(result: unknown) {
  const table = {
    select: vi.fn(() => table),
    eq: vi.fn(() => table),
    limit: vi.fn(() => table),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return table
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/widget/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

const validBody = {
  assistantId: 'assistant-1',
  conversationId: 'conv-1',
  customerExternalId: 'visitor-1',
  landingContext: { landingId: 'landing-1', productId: 'p-1', product: 'Combo 1' },
}

beforeEach(() => {
  vi.clearAllMocks()

  mockedAdmin.mockReturnValue({
    from: vi.fn((name: string) => {
      if (name === 'assistants') {
        return makeTable({
          data: { id: 'assistant-1', business_id: 'biz-1' },
          error: null,
        })
      }
      if (name === 'conversations') {
        return makeTable({
          data: { id: 'conv-1', customer_id: 'cust-1' },
          error: null,
        })
      }
      if (name === 'products') {
        return makeTable({ data: null, error: null })
      }
      return makeTable({ data: null, error: null })
    }),
  } as never)

  mockedResolveCustomer.mockResolvedValue({
    id: 'cust-1',
    businessId: 'biz-1',
    name: null,
    phone: null,
    email: null,
    isNew: false,
  })
  mockedResolveConversation.mockResolvedValue('conv-1')
  mockedRecordWidgetSale.mockResolvedValue({ recorded: true })
})

describe('POST /api/widget/close', () => {
  it('devuelve 400 cuando falta assistantId', async () => {
    const res = await post({ conversationId: 'conv-1' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('assistantId')
  })

  it('devuelve 400 cuando landingContext es invalido', async () => {
    const res = await post({ ...validBody, landingContext: { brand: 'x' } })
    expect(res.status).toBe(400)
  })

  it('devuelve 404 cuando el assistant no existe', async () => {
    mockedAdmin.mockReturnValue({
      from: vi.fn(() => makeTable({ data: null, error: null })),
    } as never)

    const res = await post(validBody)
    expect(res.status).toBe(404)
  })

  it('registra la venta con la conversacion existente', async () => {
    const res = await post(validBody)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recorded).toBe(true)
    expect(body.conversationId).toBe('conv-1')
    expect(mockedRecordWidgetSale).toHaveBeenCalledWith({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      customerName: null,
      productName: 'Combo 1',
      amount: null,
    })
  })

  it('resuelve customer y conversacion cuando falta conversationId', async () => {
    const res = await post({ ...validBody, conversationId: undefined })

    expect(res.status).toBe(200)
    expect(mockedResolveCustomer).toHaveBeenCalledWith('biz-1', {
      channel: 'widget',
      customerExternalId: 'visitor-1',
      customerName: null,
    })
    expect(mockedResolveConversation).toHaveBeenCalledWith('assistant-1', 'cust-1')
    const payload = vi.mocked(mockedRecordWidgetSale).mock.calls[0][0]
    expect(payload.conversationId).toBe('conv-1')
  })

  it('resuelve monto desde el producto cuando existe productId', async () => {
    mockedAdmin.mockReturnValue({
      from: vi.fn((name: string) => {
        if (name === 'assistants') {
          return makeTable({
            data: { id: 'assistant-1', business_id: 'biz-1' },
            error: null,
          })
        }
        if (name === 'conversations') {
          return makeTable({
            data: { id: 'conv-1', customer_id: 'cust-1' },
            error: null,
          })
        }
        if (name === 'products') {
          return makeTable({
            data: { id: 'p-1', name: 'Combo Premium', price: 250 },
            error: null,
          })
        }
        return makeTable({ data: null, error: null })
      }),
    } as never)

    await post(validBody)

    const payload = vi.mocked(mockedRecordWidgetSale).mock.calls[0][0]
    expect(payload.productName).toBe('Combo Premium')
    expect(payload.amount).toBe(250)
  })

  it('devuelve 500 ante error interno', async () => {
    mockedRecordWidgetSale.mockRejectedValue(new Error('boom'))

    const res = await post(validBody)
    expect(res.status).toBe(500)
  })
})
