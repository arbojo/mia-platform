import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const getUserMock = vi.fn()
  const supabaseMock = {
    from: vi.fn(),
    rpc: vi.fn(),
  }
  const user = { id: 'owner-uuid-123' }
  return { getUserMock, supabaseMock, user }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: h.getUserMock },
  })),
}))

vi.mock('@/lib/auth', () => ({
  requirePageAuth: vi.fn().mockResolvedValue({ supabase: h.supabaseMock, user: h.user }),
}))

import { GET } from '@/app/api/admin/analytics/knowledge-impact/route'

const row = {
  knowledge_item_id: 'k-1',
  question: 'Â¿Hacen envÃ­os a toda la ciudad?',
  category: 'envÃ­os',
  conversations_used: 4,
  conversations_sold: 2,
  close_rate: 0.5,
}

function mockBusinessQuery(rows: Array<{ id: string }> = [{ id: 'business-abc' }]) {
  const chain = {
    then: (r: (v: { data: Array<{ id: string }> | null; error: null }) => void) =>
      r({ data: rows, error: null }),
  }
  h.supabaseMock.from.mockReturnValueOnce({
    select: () => ({
      eq: () => ({ limit: () => chain }),
    }),
    then: chain.then,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/analytics/knowledge-impact', () => {
  it('returns 404 when user has no business', async () => {
    mockBusinessQuery([])

    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns impact rows and summary filtered to used knowledge', async () => {
    mockBusinessQuery()
    h.supabaseMock.rpc.mockResolvedValueOnce({
      data: [row, { ...row, knowledge_item_id: 'k-2', conversations_used: 0 }],
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(h.supabaseMock.rpc).toHaveBeenCalledWith('get_knowledge_sales_impact', { p_business_id: 'business-abc' })
    expect(body.impact).toHaveLength(1)
    expect(body.impact[0].knowledge_item_id).toBe('k-1')
    expect(body.summary.totalKnowledge).toBe(1)
    expect(body.summary.totalUsed).toBe(4)
    expect(body.summary.totalSold).toBe(2)
    expect(body.summary.avgCloseRate).toBe(0.5)
  })

  it('returns 500 when RPC fails', async () => {
    mockBusinessQuery()
    h.supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: new Error('rpc boom') })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
