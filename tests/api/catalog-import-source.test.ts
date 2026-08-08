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

vi.mock('@/lib/import/sourceClient', () => ({
  fetchSourceRows: vi.fn(),
}))

import { POST } from '@/app/api/catalog/import/source/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchSourceRows } from '@/lib/import/sourceClient'
import { createAdminMock } from '../import/mock-admin'
import type { RawRow } from '@/lib/import/types'

const BUSINESS_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'

function makeServerClient({ user, business }: { user: unknown; business: unknown }) {
  const wrapper: Record<string, unknown> = { data: business, error: null }
  for (const method of ['select', 'eq', 'single', 'maybeSingle']) {
    wrapper[method] = vi.fn(() => wrapper)
  }
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => wrapper),
  }
  return supabase
}

function post(body: unknown) {
  return new Request('http://localhost/api/catalog/import/source', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const BASE_BODY = {
  business_id: BUSINESS_ID,
  method: 'scrape',
  url: 'https://example.com/tienda',
  mode: 'import',
}

const ROW_A: RawRow = { name: 'Perfume', sku: 'PER-1', price: 45 }
const ROW_B: RawRow = { name: 'Crema', sku: 'CRE-2', price: 18.5 }

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)
const mockedFetchSourceRows = vi.mocked(fetchSourceRows)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/catalog/import/source', () => {
  it('devuelve 401 sin sesión', async () => {
    mockedCreateClient.mockResolvedValue(makeServerClient({ user: null, business: null }) as never)
    const res = await POST(post(BASE_BODY))
    expect(res.status).toBe(401)
  })

  it('devuelve 400 con cuerpo inválido', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    const res = await POST(
      new Request('http://localhost/api/catalog/import/source', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{no-json',
      })
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Cuerpo JSON inválido' })
  })

  it('valida business_id como UUID', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    const res = await POST(post({ ...BASE_BODY, business_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'business_id inválido' })
  })

  it('devuelve 403 si el negocio no pertenece al usuario', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: null }) as never
    )
    const res = await POST(post(BASE_BODY))
    expect(res.status).toBe(403)
  })

  it('devuelve 422 cuando no hay productos en la fuente', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    mockedFetchSourceRows.mockResolvedValue([])
    const res = await POST(post(BASE_BODY))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'No se encontraron productos en la fuente' })
  })

  it('devuelve preview limitado a 20 filas', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    const rows = Array.from({ length: 25 }, (_, i): RawRow => ({ name: `P${i}`, sku: `SKU-${i}`, price: i }))
    mockedFetchSourceRows.mockResolvedValue(rows)
    const res = await POST(post({ ...BASE_BODY, mode: 'preview' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preview.rows).toHaveLength(20)
    expect(body.preview.total).toBe(25)
    expect(body.preview.method).toBe('scrape')
    expect(body.preview.source).toBe('https://example.com/tienda')
  })

  it('importa filas y devuelve el resumen', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    mockedFetchSourceRows.mockResolvedValue([ROW_A, ROW_B])
    const { admin } = createAdminMock({ existing: [] })
    mockedCreateAdminClient.mockReturnValue(admin as never)

    const res = await POST(post(BASE_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.created).toBe(2)
  })
})
