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
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}))

import { GET } from '@/app/api/knowledge/items/route'
import { createClient } from '@/lib/supabase/server'

type ChainCall = { method: string; args: unknown[] }

function makeChain(result: { data: unknown; error: unknown }, calls: ChainCall[]) {
  const wrapper: Record<string, unknown> = {
    data: result.data,
    error: result.error,
  }
  for (const method of [
    'select',
    'eq',
    'not',
    'is',
    'or',
    'order',
    'ilike',
    'limit',
    'single',
    'maybeSingle',
  ]) {
    wrapper[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return wrapper
    }
  }
  return wrapper
}

function mockServerClient(items: unknown[]) {
  const knowledgeCalls: ChainCall[] = []
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'knowledge_items') {
        return makeChain({ data: items, error: null }, knowledgeCalls)
      }
      return makeChain({ data: { id: 'business-1' }, error: null }, [])
    }),
  }
  return { supabase, knowledgeCalls }
}

const mockedCreateClient = vi.mocked(createClient)
const ITEM = { id: 'item-1', answer: 'medio de prueba' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/knowledge/items', () => {
  it('devuelve 401 sin sesión', async () => {
    const { supabase } = mockServerClient([ITEM])
    mockedCreateClient.mockResolvedValue({
      ...supabase,
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never)
    const res = await GET(new Request('http://localhost/api/knowledge/items?business_id=business-1'))
    expect(res.status).toBe(401)
  })

  it('devuelve 403 si el negocio no pertenece al usuario', async () => {
    const { supabase } = mockServerClient([ITEM])
    supabase.from.mockImplementation((table: string) => {
      if (table === 'knowledge_items') {
        return makeChain({ data: [], error: null }, [])
      }
      return makeChain({ data: null, error: null }, [])
    })
    mockedCreateClient.mockResolvedValue(supabase as never)
    const res = await GET(new Request('http://localhost/api/knowledge/items?business_id=business-1'))
    expect(res.status).toBe(403)
  })

  it('filtra por product_id cuando se pasa un UUID', async () => {
    const { supabase, knowledgeCalls } = mockServerClient([ITEM])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const productId = '11111111-2222-3333-4444-555555555555'
    const res = await GET(
      new Request(`http://localhost/api/knowledge/items?business_id=business-1&product_id=${productId}`)
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [ITEM] })
    const productFilter = knowledgeCalls.find(
      (c) => c.method === 'eq' && c.args[0] === 'product_id'
    )
    expect(productFilter).toBeDefined()
    expect(productFilter?.args[1]).toBe(productId)
  })

  it('filtra medios genéricos con product_id=null', async () => {
    const { supabase, knowledgeCalls } = mockServerClient([ITEM])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const res = await GET(
      new Request('http://localhost/api/knowledge/items?business_id=business-1&product_id=null')
    )
    expect(res.status).toBe(200)
    const nullFilter = knowledgeCalls.find(
      (c) => c.method === 'is' && c.args[0] === 'product_id' && c.args[1] === null
    )
    expect(nullFilter).toBeDefined()
  })

  it('no aplica filtro de producto cuando se omite product_id', async () => {
    const { supabase, knowledgeCalls } = mockServerClient([ITEM])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const res = await GET(
      new Request('http://localhost/api/knowledge/items?business_id=business-1')
    )
    expect(res.status).toBe(200)
    const hasProductFilter = knowledgeCalls.some(
      (c) => c.method === 'eq' && c.args[0] === 'product_id'
    )
    const hasNullFilter = knowledgeCalls.some(
      (c) => c.method === 'is' && c.args[0] === 'product_id'
    )
    expect(hasProductFilter).toBe(false)
    expect(hasNullFilter).toBe(false)
  })

  it('devuelve 400 con product_id inválido', async () => {
    const { supabase } = mockServerClient([ITEM])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const res = await GET(
      new Request('http://localhost/api/knowledge/items?business_id=business-1&product_id=not-a-uuid')
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid product_id')
  })
})
