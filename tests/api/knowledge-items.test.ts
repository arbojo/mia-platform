import { describe, it, expect, vi, beforeEach } from 'vitest'

const contextMock = vi.hoisted(() => ({
  invalidateConversationContext: vi.fn(),
}))

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
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/conversation/context', () => ({
  invalidateConversationContext: contextMock.invalidateConversationContext,
}))

import { GET, POST } from '@/app/api/knowledge/items/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  it('filtra inactivos con status=inactive', async () => {
    const { supabase, knowledgeCalls } = mockServerClient([ITEM])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const res = await GET(
      new Request('http://localhost/api/knowledge/items?business_id=business-1&status=inactive')
    )
    expect(res.status).toBe(200)
    const activeFilter = knowledgeCalls.find(
      (c) => c.method === 'eq' && c.args[0] === 'is_active'
    )
    expect(activeFilter).toBeDefined()
    expect(activeFilter?.args[1]).toBe(false)
  })

  it('no filtra por estado con status=all', async () => {
    const { supabase, knowledgeCalls } = mockServerClient([ITEM])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const res = await GET(
      new Request('http://localhost/api/knowledge/items?business_id=business-1&status=all')
    )
    expect(res.status).toBe(200)
    const activeFilter = knowledgeCalls.find(
      (c) => c.method === 'eq' && c.args[0] === 'is_active'
    )
    expect(activeFilter).toBeUndefined()
  })

  it('devuelve 400 con status inválido', async () => {
    const { supabase } = mockServerClient([ITEM])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const res = await GET(
      new Request('http://localhost/api/knowledge/items?business_id=business-1&status=bogus')
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid status')
  })
})

describe('POST /api/knowledge/items', () => {
  const adminChain = (result: { data: unknown; error: unknown }) => {
    const chain = {
      ...result,
      insert: () => chain,
      select: () => chain,
      single: async () => result,
      eq: () => chain,
    }
    return chain
  }

  const adminWithInsertCapture = () => {
    const inserts: Record<string, unknown>[] = []
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => {
        const chain: Record<string, unknown> = {
          insert: (payload: Record<string, unknown>) => {
            inserts.push(payload)
            return chain
          },
          select: () => chain,
          single: async () => ({ data: { id: 'item-new' }, error: null }),
          eq: () => chain,
        }
        return chain
      }),
    } as never)
    return inserts
  }

  it('crea el item e invalida la caché de contexto del negocio', async () => {
    const { supabase } = mockServerClient([])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const inserted = { id: 'item-new', business_id: 'business-1', question: '¿Precio?', answer: 'Respuesta' }
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => adminChain({ data: inserted, error: null })),
    } as never)

    const res = await POST(
      new Request('http://localhost/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: 'business-1',
          category: 'faq',
          question: '¿Precio?',
          answer: 'Respuesta',
        }),
      })
    )

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ item: inserted })
    expect(contextMock.invalidateConversationContext).toHaveBeenCalledWith('business-1')
  })

  it('devuelve 400 si faltan campos requeridos', async () => {
    const { supabase } = mockServerClient([])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const res = await POST(
      new Request('http://localhost/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: 'business-1' }),
      })
    )
    expect(res.status).toBe(400)
    expect(contextMock.invalidateConversationContext).not.toHaveBeenCalled()
  })

  it('acepta media de producto incondicional (trigger_condition null, R1.3)', async () => {
    const { supabase } = mockServerClient([])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const inserts = adminWithInsertCapture()

    const res = await POST(
      new Request('http://localhost/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: 'business-1',
          category: 'faq',
          question: '¿Foto?',
          answer: 'Enseño la foto.',
          image_url: 'https://example.com/img.jpg',
          trigger_condition: null,
          product_id: '11111111-2222-3333-4444-555555555555',
        }),
      })
    )

    expect(res.status).toBe(201)
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      business_id: 'business-1',
      product_id: '11111111-2222-3333-4444-555555555555',
      trigger_condition: null,
      image_url: 'https://example.com/img.jpg',
    })
  })

  it('acepta media genérica incondicional (sin product_id ni trigger, DP-6)', async () => {
    const { supabase } = mockServerClient([])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const inserts = adminWithInsertCapture()

    const res = await POST(
      new Request('http://localhost/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: 'business-1',
          category: 'faq',
          question: '¿Foto genérica?',
          answer: 'Genérica.',
          image_url: 'https://example.com/generic.jpg',
          trigger_condition: null,
          product_id: null,
        }),
      })
    )

    expect(res.status).toBe(201)
    expect(inserts[0]).toMatchObject({
      product_id: null,
      trigger_condition: null,
      image_url: 'https://example.com/generic.jpg',
    })
  })

  it('preserva media condicionada (trigger_condition presente)', async () => {
    const { supabase } = mockServerClient([])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const inserts = adminWithInsertCapture()

    const res = await POST(
      new Request('http://localhost/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: 'business-1',
          category: 'faq',
          question: '¿Precio?',
          answer: 'Precio.',
          image_url: 'https://example.com/price.jpg',
          trigger_condition: 'precio',
          product_id: '11111111-2222-3333-4444-555555555555',
        }),
      })
    )

    expect(res.status).toBe(201)
    expect(inserts[0]).toMatchObject({ trigger_condition: 'precio' })
  })

  it('no fuerza is_active en el insert: activo por default de la BD (R1.3)', async () => {
    const { supabase } = mockServerClient([])
    mockedCreateClient.mockResolvedValue(supabase as never)
    const inserts = adminWithInsertCapture()

    const res = await POST(
      new Request('http://localhost/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: 'business-1',
          category: 'faq',
          question: '¿Foto?',
          answer: 'Sí.',
          image_url: 'https://example.com/img.jpg',
          trigger_condition: null,
          product_id: '11111111-2222-3333-4444-555555555555',
        }),
      })
    )

    expect(res.status).toBe(201)
    expect(inserts[0].is_active).toBeUndefined()
  })

  it('rechaza product_id de otro negocio (ownership)', async () => {
    const { supabase } = mockServerClient([])
    supabase.from.mockImplementation((table: string) => {
      if (table === 'products') return makeChain({ data: null, error: null }, [])
      return makeChain({ data: { id: 'business-1' }, error: null }, [])
    })
    mockedCreateClient.mockResolvedValue(supabase as never)

    const res = await POST(
      new Request('http://localhost/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: 'business-1',
          category: 'faq',
          question: '¿Foto?',
          answer: 'Sí.',
          image_url: 'https://example.com/img.jpg',
          trigger_condition: null,
          product_id: '99999999-8888-7777-6666-555555555555',
        }),
      })
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'product_id does not belong to this business',
    })
    expect(contextMock.invalidateConversationContext).not.toHaveBeenCalled()
  })
})
