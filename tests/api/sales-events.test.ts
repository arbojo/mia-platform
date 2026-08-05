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

import { GET } from '@/app/api/sales/events/route'
import { requireAuth } from '@/lib/auth'

const mockedRequireAuth = vi.mocked(requireAuth)

const events = [
  { id: 'e-1', event_type: 'SALE_WON', amount: 150 },
  { id: 'e-2', event_type: 'SALE_LOST', amount: 0 },
]

let eqMock: ReturnType<typeof vi.fn>

function makeChain() {
  eqMock = vi.fn(() => chain)
  const chain = {
    select: vi.fn(() => chain),
    eq: eqMock,
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (value: unknown) => unknown) =>
      resolve(Promise.resolve({ data: events, error: null })),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  const chain = makeChain()
  mockedRequireAuth.mockResolvedValue({
    user: { id: 'user-1' },
    supabase: { from: vi.fn(() => chain) },
  } as never)
})

describe('GET /api/sales/events', () => {
  it('devuelve 400 cuando falta business_id', async () => {
    const res = await GET(new Request('http://localhost/api/sales/events'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('business_id')
  })

  it('devuelve eventos cuando business_id existe', async () => {
    const res = await GET(
      new Request('http://localhost/api/sales/events?business_id=b-1')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.events).toHaveLength(2)
  })

  it('aplica filtro por event_type', async () => {
    await GET(
      new Request('http://localhost/api/sales/events?business_id=b-1&event_type=SALE_WON')
    )

    expect(eqMock).toHaveBeenCalledWith('business_id', 'b-1')
    expect(eqMock).toHaveBeenCalledWith('event_type', 'SALE_WON')
  })
})
