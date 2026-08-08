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

import { POST } from '@/app/api/catalog/import/file/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAdminMock } from '../import/mock-admin'

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

function formWith(file?: File | null, businessId = '11111111-2222-3333-4444-555555555555') {
  const form = new FormData()
  form.append('business_id', businessId)
  if (file) form.append('file', file)
  return new Request('http://localhost/api/catalog/import/file', { method: 'POST', body: form })
}

const CSV = `nombre,sku,precio,beneficios\nPerfume,PER-1,45,\"Ideal para regalar\"\nCrema,CRE-2,18.5,\n`

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/catalog/import/file', () => {
  it('devuelve 401 sin sesión', async () => {
    mockedCreateClient.mockResolvedValue(makeServerClient({ user: null, business: null }) as never)
    const res = await POST(formWith(new File(['a,b'], 'x.csv', { type: 'text/csv' })))
    expect(res.status).toBe(401)
  })

  it('devuelve 403 si el negocio no pertenece al usuario', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: null }) as never
    )
    const res = await POST(formWith(new File([CSV], 'x.csv', { type: 'text/csv' })))
    expect(res.status).toBe(403)
  })

  it('devuelve 400 sin archivo', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    const res = await POST(formWith(null))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Archivo requerido (campo "file")' })
  })

  it('rechaza extensiones no soportadas', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    const res = await POST(formWith(new File(['hola'], 'x.txt', { type: 'text/plain' })))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Formato no soportado. Usa .csv o .xlsx' })
  })

  it('rechaza un CSV binario corrupto', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    const binary = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00])
    const res = await POST(formWith(new File([binary], 'x.csv', { type: 'text/csv' })))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: 'El archivo CSV contiene datos binarios o está corrupto',
    })
  })

  it('importa filas válidas y devuelve el resumen', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    const { admin } = createAdminMock({ existing: [] })
    mockedCreateAdminClient.mockReturnValue(admin as never)

    const res = await POST(formWith(new File([CSV], 'catalogo.csv', { type: 'text/csv' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.created).toBe(2)
    expect(body.summary.errors).toHaveLength(0)
  })

  it('devuelve 422 sin filas válidas', async () => {
    mockedCreateClient.mockResolvedValue(
      makeServerClient({ user: { id: 'user-1' }, business: { id: 'business-1' } }) as never
    )
    const res = await POST(formWith(new File(['a,b\nx,y\n'], 'catalogo.csv', { type: 'text/csv' })))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'No se encontraron filas válidas para importar' })
  })
})
