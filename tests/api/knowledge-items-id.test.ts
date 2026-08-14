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

import { PATCH, DELETE } from '@/app/api/knowledge/items/[id]/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EXISTING = {
  id: 'item-1',
  business_id: 'business-1',
  question: '¿Envío?',
  answer: 'Gratis',
  category: 'faq',
  is_active: true,
}
const UPDATED = { ...EXISTING, answer: 'Gratis en compras +$50', is_active: true }

type ChainCall = { method: string; args: unknown[] }

function makeChain(result: { data: unknown; error: unknown }, calls: ChainCall[]) {
  const wrapper: Record<string, unknown> = {
    data: result.data,
    error: result.error,
  }
  for (const method of [
    'select',
    'eq',
    'order',
    'update',
    'insert',
    'maybeSingle',
    'single',
  ]) {
    wrapper[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return wrapper
    }
  }
  return wrapper
}

function mockServerClient(item: unknown) {
  const knowledgeCalls: ChainCall[] = []
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'knowledge_items') {
        return makeChain({ data: item, error: null }, knowledgeCalls)
      }
      return makeChain({ data: { id: 'business-1' }, error: null }, [])
    }),
  }
  return { supabase, knowledgeCalls }
}

const mockedCreateClient = vi.mocked(createClient)

beforeEach(() => {
  vi.clearAllMocks()
})

function mockAdmin(item: unknown) {
  const adminCalls: ChainCall[] = []
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'knowledge_versions') {
        return makeChain({ data: null, error: null }, adminCalls)
      }
      return makeChain({ data: item, error: null }, adminCalls)
    }),
  } as never)
  return adminCalls
}

describe('PATCH /api/knowledge/items/[id]', () => {
  it('actualiza el item, registra versión manual e invalida la caché', async () => {
    const { supabase } = mockServerClient(EXISTING)
    mockedCreateClient.mockResolvedValue(supabase as never)
    const adminCalls = mockAdmin(UPDATED)

    const res = await PATCH(
      new Request('http://localhost/api/knowledge/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: 'Gratis en compras +$50' }),
      }),
      { params: Promise.resolve({ id: 'item-1' }) }
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ item: UPDATED })

    const versionInsert = adminCalls.find(
      (c) => c.method === 'insert'
    )
    expect(versionInsert).toBeDefined()
    const payload = versionInsert!.args[0] as Record<string, unknown>
    expect(payload).toMatchObject({
      business_id: 'business-1',
      entity_type: 'knowledge_item',
      entity_id: 'item-1',
      change_source: 'manual',
      changed_by: 'user-1',
    })
    expect(payload.previous_value).toEqual(EXISTING)
    expect(payload.new_value).toEqual(UPDATED)

    expect(contextMock.invalidateConversationContext).toHaveBeenCalledWith('business-1')
  })

  it('acepta is_active para desactivar/reactivar', async () => {
    const { supabase } = mockServerClient(EXISTING)
    mockedCreateClient.mockResolvedValue(supabase as never)
    mockAdmin({ ...UPDATED, is_active: false })

    const res = await PATCH(
      new Request('http://localhost/api/knowledge/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      }),
      { params: Promise.resolve({ id: 'item-1' }) }
    )

    expect(res.status).toBe(200)
    expect(contextMock.invalidateConversationContext).toHaveBeenCalledWith('business-1')
  })

  it('rechaza is_active no booleano con 400', async () => {
    const { supabase } = mockServerClient(EXISTING)
    mockedCreateClient.mockResolvedValue(supabase as never)

    const res = await PATCH(
      new Request('http://localhost/api/knowledge/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 'si' }),
      }),
      { params: Promise.resolve({ id: 'item-1' }) }
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid is_active' })
    expect(contextMock.invalidateConversationContext).not.toHaveBeenCalled()
  })

  it('devuelve 404 si el item no existe', async () => {
    const { supabase } = mockServerClient(null)
    mockedCreateClient.mockResolvedValue(supabase as never)

    const res = await PATCH(
      new Request('http://localhost/api/knowledge/items/missing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: 'x' }),
      }),
      { params: Promise.resolve({ id: 'missing' }) }
    )

    expect(res.status).toBe(404)
    expect(contextMock.invalidateConversationContext).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/knowledge/items/[id]', () => {
  it('desactiva el item e invalida la caché del negocio', async () => {
    const { supabase } = mockServerClient(EXISTING)
    mockedCreateClient.mockResolvedValue(supabase as never)
    mockAdmin(null)

    const res = await DELETE(
      new Request('http://localhost/api/knowledge/items/item-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'item-1' }) }
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(contextMock.invalidateConversationContext).toHaveBeenCalledWith('business-1')
  })

  it('no invalida caché si el item no existe', async () => {
    const { supabase } = mockServerClient(null)
    mockedCreateClient.mockResolvedValue(supabase as never)

    const res = await DELETE(
      new Request('http://localhost/api/knowledge/items/missing', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'missing' }) }
    )

    expect(res.status).toBe(404)
    expect(contextMock.invalidateConversationContext).not.toHaveBeenCalled()
  })
})
