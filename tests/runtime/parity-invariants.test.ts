import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/ai/knowledge', () => ({
  getSalesConfig: vi.fn().mockResolvedValue({ cancellation_window_hours: 24 }),
}))

import {
  toChronologicalTranscript,
  resolveCancellationGuards,
} from '@/lib/runtime/runtime'
import { createAdminClient } from '@/lib/supabase/admin'

const NOW = Date.now()
const MS = 3600 * 1000

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PARITY C1 — transcript invariant (toChronologicalTranscript)', () => {
  it('reordena el tail DESC (N mas recientes) a cronologico para el detector', () => {
    const desc = [
      { role: 'user', content: 'msg-5 (mas reciente)' },
      { role: 'assistant', content: 'msg-4' },
      { role: 'user', content: 'msg-3' },
    ]
    const chronological = toChronologicalTranscript(desc)
    expect(chronological.map((m) => m.content)).toEqual(['msg-3', 'msg-4', 'msg-5 (mas reciente)'])
    // La ultima intervencion del cliente es la ultima posicion (visible para el core).
    expect(chronological[chronological.length - 1].role).toBe('user')
    expect(chronological[chronological.length - 1].content).toBe('msg-5 (mas reciente)')
  })

  it('no muta la entrada y preserva roles', () => {
    const desc = [
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'a' },
    ]
    const out = toChronologicalTranscript(desc)
    expect(out[0]).toEqual({ role: 'assistant', content: 'a' })
    expect(out[1]).toEqual({ role: 'user', content: 'b' })
    expect(desc[0].content).toBe('b')
  })

  it('GODZILLA zero-state: transcript vacio no crashea', () => {
    expect(toChronologicalTranscript([])).toEqual([])
  })
})

describe('PARITY P1 — guards de cancelacion compartidos', () => {
  const BIZ = 'biz-1'
  const CUST = 'cust-1'

  interface GuardResults {
    lastConv?: unknown
    customer?: unknown
    currentConv?: unknown
    cancelEvent?: unknown
  }

  function makeGuardSupabase(results: GuardResults) {
    const from = vi.fn((table: string) => {
      // Cadena base encadenable que resuelve en then().
      const chain = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        maybeSingle: vi.fn(),
        then: () => {
          throw new Error('unexpected then on unconfigured query')
        },
      }
      chain.eq.mockReturnValue(chain)
      chain.in.mockReturnValue(chain)
      chain.not.mockReturnValue(chain)
      chain.order.mockReturnValue(chain)
      chain.limit.mockReturnValue(chain)

      chain.select.mockImplementation((cols: string) => {
        const resolveTo = (data: unknown) => {
          const p = Promise.resolve({ data, error: null })
          chain.then = (onFulfilled: (v: { data: unknown; error: null }) => unknown) => p.then(onFulfilled)
          chain.maybeSingle.mockReturnValue(p)
          return chain
        }

        if (table === 'conversations') {
          // Query 1: ultima conversacion cancelada (historico) -> lastConv
          if (cols.includes('sales_cancelled_at') && !cols.includes('outcome')) {
            return resolveTo(results.lastConv ?? null)
          }
          // Query 2: conversacion actual (sentinel RETENTION_PENDING)
          if (cols.includes('outcome_updated_at')) {
            return resolveTo(results.currentConv ?? null)
          }
        }
        if (table === 'customers') return resolveTo(results.customer ?? null)
        if (table === 'sales_events') return resolveTo(results.cancelEvent ?? null)
        return resolveTo(null)
      })
      return chain
    })
    const supabase = { from }
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    return supabase
  }

  it('construye cancellationContext ante una cancelacion reciente (<24h)', async () => {
    makeGuardSupabase({
      lastConv: { id: 'conv-0', sales_cancelled_at: new Date(NOW - 2 * MS).toISOString() },
      cancelEvent: { metadata: { order_number: 'ORD-1' } },
    })
    const guards = await resolveCancellationGuards({
      supabase: vi.mocked(createAdminClient)(),
      businessId: BIZ,
      customerId: CUST,
      conversationId: 'conv-1',
      userContent: 'quiero cancelar',
    })
    expect(guards.cancellationContext).toEqual({ orderNumber: 'ORD-1', hoursAgo: expect.any(Number) })
  })

  it('NO construye cancellationContext pasadas >24h', async () => {
    makeGuardSupabase({
      lastConv: { id: 'conv-0', sales_cancelled_at: new Date(NOW - 100 * MS).toISOString() },
    })
    const guards = await resolveCancellationGuards({
      supabase: vi.mocked(createAdminClient)(),
      businessId: BIZ,
      customerId: CUST,
      conversationId: 'conv-1',
      userContent: 'hola',
    })
    expect(guards.cancellationContext).toBeNull()
  })

  it('construye lastCancelledOrder desde customer.last_cancelled_order (<24h)', async () => {
    makeGuardSupabase({
      customer: {
        last_cancelled_order: {
          product_name: 'Bota',
          cancelled_at: new Date(NOW - 3 * MS).toISOString(),
        },
      },
    })
    const guards = await resolveCancellationGuards({
      supabase: vi.mocked(createAdminClient)(),
      businessId: BIZ,
      customerId: CUST,
      conversationId: 'conv-1',
      userContent: 'quiero ver mi pedido',
    })
    expect(guards.lastCancelledOrder?.productName).toBe('Bota')
    expect(guards.lastCancelledOrder?.pending).toBeUndefined()
  })

  it('devuelve guards vacios sin historial de cancelacion', async () => {
    makeGuardSupabase({})
    const guards = await resolveCancellationGuards({
      supabase: vi.mocked(createAdminClient)(),
      businessId: BIZ,
      customerId: CUST,
      conversationId: 'conv-1',
      userContent: 'hola',
    })
    expect(guards.cancellationContext).toBeNull()
    expect(guards.lastCancelledOrder).toBeNull()
    expect(guards.userIntent).toBeNull()
  })

  it('GODZILLA zero-state: sin customer ni conversation no crashea ni lanza SQL', async () => {
    const guards = await resolveCancellationGuards({
      supabase: vi.mocked(createAdminClient)(),
      businessId: BIZ,
      customerId: undefined,
      conversationId: undefined,
      userContent: '',
    })
    expect(guards.cancellationContext).toBeNull()
    expect(guards.lastCancelledOrder).toBeNull()
  })
})
