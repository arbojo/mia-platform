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
  createAdminClient: vi.fn(),
}))

import { DELETE as deleteCollection } from '@/app/api/laboratorio/sessions/route'
import { DELETE as deleteOne } from '@/app/api/laboratorio/sessions/[id]/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ChainCall = { method: string; args: unknown[] }

function makeChain(result: { data: unknown; error: unknown }, calls: ChainCall[]) {
  const wrapper: Record<string, unknown> = {
    data: result.data,
    error: result.error,
  }
  for (const method of ['select', 'eq', 'maybeSingle', 'single', 'delete']) {
    wrapper[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return wrapper
    }
  }
  return wrapper
}

function mockServerClient() {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn(() => makeChain({ data: null, error: null }, [])),
  }
  vi.mocked(createClient).mockResolvedValue(supabase as never)
  return supabase
}

function mockAdmin(routes: Record<string, { data: unknown; error: unknown }>) {
  const calls: ChainCall[] = []
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table: string) => {
      const result = routes[table] ?? { data: null, error: null }
      return makeChain(result, calls)
    }),
  } as never)
  return calls
}

function unauthorizedServer() {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn(() => makeChain({ data: null, error: null }, [])),
  }
  vi.mocked(createClient).mockResolvedValue(supabase as never)
  return supabase
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/laboratorio/sessions?businessId=', () => {
  it('devuelve 401 sin sesión de usuario', async () => {
    unauthorizedServer()

    const res = await deleteCollection(
      new Request('http://localhost/api/laboratorio/sessions?businessId=business-1', {
        method: 'DELETE',
      })
    )

    expect(res.status).toBe(401)
  })

  it('devuelve 400 sin businessId', async () => {
    mockServerClient()

    const res = await deleteCollection(
      new Request('http://localhost/api/laboratorio/sessions', { method: 'DELETE' })
    )

    expect(res.status).toBe(400)
  })

  it('devuelve 403 cuando el negocio no pertenece al usuario', async () => {
    mockServerClient()
    mockAdmin({ businesses: { data: { owner_id: 'other-user' }, error: null } })

    const res = await deleteCollection(
      new Request('http://localhost/api/laboratorio/sessions?businessId=business-1', {
        method: 'DELETE',
      })
    )

    expect(res.status).toBe(403)
  })

  it('elimina todas las sesiones del negocio del owner', async () => {
    mockServerClient()
    const calls = mockAdmin({ businesses: { data: { owner_id: 'user-1' }, error: null } })

    const res = await deleteCollection(
      new Request('http://localhost/api/laboratorio/sessions?businessId=business-1', {
        method: 'DELETE',
      })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true })

    const deleteCall = calls.find((c) => c.method === 'delete')
    expect(deleteCall).toBeDefined()
  })
})

describe('DELETE /api/laboratorio/sessions/[id]', () => {
  it('devuelve 401 sin sesión de usuario', async () => {
    unauthorizedServer()

    const res = await deleteOne(
      new Request('http://localhost/api/laboratorio/sessions/session-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'session-1' }) }
    )

    expect(res.status).toBe(401)
  })

  it('devuelve 404 si la sesión no existe', async () => {
    mockServerClient()
    mockAdmin({ lab_sessions: { data: null, error: null } })

    const res = await deleteOne(
      new Request('http://localhost/api/laboratorio/sessions/missing', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'missing' }) }
    )

    expect(res.status).toBe(404)
  })

  it('devuelve 403 cuando la sesión pertenece a otro owner', async () => {
    mockServerClient()
    mockAdmin({
      lab_sessions: { data: { id: 'session-1', business_id: 'business-1' }, error: null },
      businesses: { data: { owner_id: 'other-user' }, error: null },
    })

    const res = await deleteOne(
      new Request('http://localhost/api/laboratorio/sessions/session-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'session-1' }) }
    )

    expect(res.status).toBe(403)
  })

  it('elimina la sesión del owner', async () => {
    mockServerClient()
    const calls = mockAdmin({
      lab_sessions: { data: { id: 'session-1', business_id: 'business-1' }, error: null },
      businesses: { data: { owner_id: 'user-1' }, error: null },
    })

    const res = await deleteOne(
      new Request('http://localhost/api/laboratorio/sessions/session-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'session-1' }) }
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true })

    const deleteCall = calls.find((c) => c.method === 'delete')
    expect(deleteCall).toBeDefined()
    const deleteEq = calls.find((c) => c.method === 'eq' && c.args[0] === 'id')
    expect(deleteEq).toBeDefined()
    expect(deleteEq!.args[1]).toBe('session-1')
  })
})
