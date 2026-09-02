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

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/cache/invalidator', () => ({
  invalidateSystemContext: vi.fn(),
}))

vi.mock('@/lib/ai/knowledge', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/ai/knowledge')>()
  return {
    ...actual,
    getSalesConfig: vi.fn(),
    upsertSalesConfig: vi.fn(),
  }
})

import { POST } from '@/app/api/sales/config/route'
import { requireAuth } from '@/lib/auth'
import { upsertSalesConfig } from '@/lib/ai/knowledge'
import { SALES_CONFIG_DEFAULTS } from '@/lib/ai/knowledge'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedUpsert = vi.mocked(upsertSalesConfig)

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/sales/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedRequireAuth.mockResolvedValue({
    user: { id: 'user-1' },
    supabase: {
      rpc: vi.fn().mockResolvedValue({ data: ['biz-1'], error: null }),
    } as never,
  })
})

describe('SalesConfig — defaults (T1-1)', () => {
  it('define percent de retención por defecto en 10', () => {
    expect(SALES_CONFIG_DEFAULTS.retention_discount_percent).toBe(10)
  })

  it('define un mensaje de retención con ambos placeholders soportados', () => {
    expect(SALES_CONFIG_DEFAULTS.retention_discount_message).toContain('{customer_name}')
    expect(SALES_CONFIG_DEFAULTS.retention_discount_message).toContain('{discount_percent}')
  })
})

describe('SalesConfig — persistencia/lectura POST (T1-1)', () => {
  it('persiste fields de retención válidos junto a otros campos', async () => {
    mockedUpsert.mockResolvedValue({} as never)

    const res = await POST(
      buildRequest({
        retention_discount_percent: 15,
        retention_discount_message: 'Te ofrezco un *{discount_percent}%* hoy, {customer_name}.',
        ask_phone: false,
        no_permitido: 'ignorado',
      }),
    )

    expect(res.status).toBe(200)
    expect(mockedUpsert).toHaveBeenCalledWith('biz-1', {
      retention_discount_percent: 15,
      retention_discount_message: 'Te ofrezco un *{discount_percent}%* hoy, {customer_name}.',
      ask_phone: false,
    })
  })

  it('rechaza percent fuera del rango 5..20 con 400', async () => {
    for (const bad of [4, 21, 10.5, 'alto']) {
      const res = await POST(buildRequest({ retention_discount_percent: bad }))
      expect(res.status).toBe(400)
      expect(mockedUpsert).not.toHaveBeenCalled()
    }
  })

  it('rechaza mensaje de retención de más de 500 caracteres con 400', async () => {
    const long = 'x'.repeat(501)
    const res = await POST(buildRequest({ retention_discount_message: long }))
    expect(res.status).toBe(400)
    expect(mockedUpsert).not.toHaveBeenCalled()
  })

  it('rechaza body sin campos permitidos con 400', async () => {
    const res = await POST(buildRequest({ foo: 'bar' }))
    expect(res.status).toBe(400)
    expect(mockedUpsert).not.toHaveBeenCalled()
  })
})