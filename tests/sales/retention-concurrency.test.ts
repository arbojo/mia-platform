import { describe, it, expect, vi, beforeEach } from 'vitest'

// H1 / ADR-030 — tests de concurrencia real (N≥2 peticiones simultáneas con
// Promise.all). El árbitro es un store in-memory que replica SEMÁNTICAMENTE los
// índices UNIQUE parciales de la migración 060 (claim síncrono en el INSERT,
// como el commit point del índice real). Se usan los módulos REALES del motor
// (retention.ts, cancel.ts, events.ts) excepto los adaptadores de AI/detección.

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/ai/knowledge', () => ({ getSalesConfig: vi.fn() }))
vi.mock('@/lib/ai/customer-memory', () => ({ purgeCancelledOrderFromMemory: vi.fn() }))
vi.mock('@/lib/sales/detect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sales/detect')>()
  return { ...actual, detectCancellation: vi.fn() }
})

import { createAdminClient } from '@/lib/supabase/admin'
import { getSalesConfig } from '@/lib/ai/knowledge'
import { purgeCancelledOrderFromMemory } from '@/lib/ai/customer-memory'
import { detectCancellation } from '@/lib/sales/detect'
import { resolveRetentionDecision } from '@/lib/sales/retention'
import { DISCOUNT_OFFERED_SENTINEL } from '@/lib/sales/process'
import { emitSalesEvent, isRetentionConflictError, SalesEventConflictError } from '@/lib/sales/events'
import type { SalesConfig } from '@/lib/ai/knowledge'
import type { RetentionDecision } from '@/lib/sales/retention'

const CTX = {
  businessId: 'b1111111-1111-1111-1111-111111111111',
  assistantId: 'a1111111-1111-1111-1111-111111111111',
  customerId: 'c1111111-1111-1111-1111-111111111111',
  conversationId: 'd1111111-1111-1111-1111-111111111111',
}
const WON_EVENT_ID = 'abcdef-won'

// Mismo texto que ACK_OFFER_DUPLICATE (retention.ts) y
// CANCELLATION_ALREADY_PROCESSED (cancel.ts) — el ACK es determinista.
const OFFER_LOST_ACK = 'Ya procesé tu solicitud de cancelación. Revisá mi mensaje anterior, por favor.'
const CANCELLATION_ALREADY_PROCESSED = 'Tu pedido ya fue cancelado.'

const fullConfig: SalesConfig = {
  business_id: CTX.businessId,
  confirmation_message: 'Confirmado',
  cancellation_message: 'Tu pedido {order_id} ha sido cancelado.',
  ask_address: true,
  ask_phone: true,
  allow_cancellation: true,
  cancellation_window_hours: 24,
  follow_up_hours: 48,
  timezone: 'America/Argentina/Buenos_Aires',
  retention_discount_percent: 10,
  retention_discount_message:
    'Entiendo tu preocupación, {customer_name}. Puedo ofrecerte un *{discount_percent}% de descuento*.',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

interface RetentionStore {
  hasSale: boolean
  wonEventId: string
  lastWonAt: string
  convSentinel: string | null
  convOutcome: string | null
  convHistory: unknown[]
  failConversationUpdate: boolean
  claimed: Map<string, string>
  salesEvents: Array<Record<string, unknown>>
  convUpdateCalls: number
  customerUpdateCalls: number
  signalInserts: number
  deleteCalls: Array<{ col: string; value: string }>
}

type Row = Record<string, unknown>
interface Inserter {
  select: () => { single: () => Promise<{ data: unknown; error: unknown }> }
}
interface Builder {
  select: (cols: string) => Builder
  eq: (c: string, v: unknown) => Builder
  in: () => Builder
  ilike: () => Builder
  limit: () => Builder
  order: () => Builder
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
  single: () => Promise<{ data: unknown; error: unknown }>
  then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) => Promise<unknown>
  insert: (row: Row) => Inserter
  update: (row: Row) => { eq: () => Promise<{ data: unknown; error: unknown }> }
  delete: () => { eq: (c: string, v: unknown) => Promise<{ data: unknown; error: unknown }> }
}

function createStore(): RetentionStore {
  return {
    hasSale: true,
    wonEventId: WON_EVENT_ID,
    lastWonAt: new Date().toISOString(),
    convSentinel: null,
    convOutcome: null,
    convHistory: [],
    failConversationUpdate: false,
    claimed: new Map(),
    salesEvents: [],
    convUpdateCalls: 0,
    customerUpdateCalls: 0,
    signalInserts: 0,
    deleteCalls: [],
  }
}

function makeClient(store: RetentionStore): unknown {
  const buildBuilder = (table: string): Builder => {
    let cols: string | null = null
    const filters: Array<[string, unknown]> = []

    const hasFilter = (c: string, v: unknown) => filters.some(([k, val]) => k === c && val === v)

    const resolveRead = (): { data: unknown; error: unknown } => {
      if (table === 'sales_events') {
        const isLastWon = cols?.includes('created_at') ?? false
        if (isLastWon && hasFilter('event_type', 'SALE_WON')) {
          return {
            data: store.hasSale
              ? {
                  id: store.wonEventId,
                  created_at: store.lastWonAt,
                  amount: 100,
                  metadata: {},
                  product_id: null,
                }
              : null,
            error: null,
          }
        }
        if (hasFilter('event_type', 'SALE_WON')) {
          return { data: store.hasSale ? { id: store.wonEventId } : null, error: null }
        }
      }
      if (table === 'conversations') {
        if (cols?.includes('sales_cancelled_at') ?? false) {
          return {
            data: { sales_cancelled_at: store.convSentinel, outcome: store.convOutcome },
            error: null,
          }
        }
        return { data: { outcome: store.convOutcome, outcome_history: store.convHistory }, error: null }
      }
      if (table === 'customers') return { data: { name: 'Ana' }, error: null }
      if (table === 'messages') return { data: [], error: null }
      return { data: null, error: null }
    }

    const b: Builder = {
      select: (c: string) => {
        cols = c
        return b
      },
      eq: (c: string, v: unknown) => {
        filters.push([c, v])
        return b
      },
      in: () => b,
      ilike: () => b,
      limit: () => b,
      order: () => b,
      maybeSingle: () => Promise.resolve(resolveRead()),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (onFulfilled) => Promise.resolve(resolveRead()).then(onFulfilled),
      insert: (r: Row) => {
        const result = insertRow(store, table, r)
        return { select: () => ({ single: () => Promise.resolve(result) }) }
      },
      update: (r: Row) => ({
        eq: () => {
          if (table === 'conversations') {
            store.convUpdateCalls += 1
            if (store.failConversationUpdate) {
              return Promise.resolve({
                data: null,
                error: { code: 'PLACEHOLDER', message: 'forced failure' },
              })
            }
            const isSentinel = r.sales_cancelled_at === DISCOUNT_OFFERED_SENTINEL
            if (isSentinel) {
              store.convSentinel = DISCOUNT_OFFERED_SENTINEL
              store.convHistory = [...store.convHistory, { at: 'sentinel-write' }]
            } else {
              store.convSentinel = (r.sales_cancelled_at as string) ?? store.convSentinel
              store.convOutcome = 'cancelled'
            }
          }
          if (table === 'customers') store.customerUpdateCalls += 1
          return Promise.resolve({ data: null, error: null })
        },
      }),
      delete: () => ({
        eq: (c: string, v: unknown) => {
          const id = String(v)
          store.deleteCalls.push({ col: c, value: id })
          const idx = store.salesEvents.findIndex((e) => e.id === id)
          if (idx !== -1) {
            const key = variantKey(store.salesEvents[idx])
            if (key) store.claimed.delete(key)
            store.salesEvents.splice(idx, 1)
          }
          return Promise.resolve({ data: null, error: null })
        },
      }),
    }
    return b
  }

  return {
    from: (t: string) => buildBuilder(t),
    schema: () => ({ from: (t: string) => buildBuilder(t) }),
  }
}

// === Árbitro de unicidad (réplica semántica de la migración 060) ===

function variantKey(row: Row): string | null {
  const type = row.event_type
  const conv = row.conversation_id
  if (type !== 'SALE_CANCELLED' || typeof conv !== 'string') return null
  const meta = (row.metadata ?? {}) as Record<string, unknown>
  // Predicados complementarios de 060: offer ⇒ reason === 'discount_offered';
  // cualquier otro SALE_CANCELLED (con original_sale_event_id) ⇒ cancel.
  return meta.reason === 'discount_offered' ? `offer:${conv}` : `cancel:${conv}`
}

function conflictResult(r: Row) {
  const isOffer = (r.metadata as Record<string, unknown>)?.reason === 'discount_offered'
  const constraint = isOffer
    ? 'uq_sales_events_retention_offer_once'
    : 'uq_sales_events_cancellation_once'
  return {
    data: null as unknown,
    error: {
      code: '23505',
      message: `duplicate key value violates unique constraint "${constraint}"`,
      constraint,
    },
  }
}

function insertRow(store: RetentionStore, table: string, r: Row) {
  const id = `evt-${store.salesEvents.length + 1}`
  const key = variantKey(r)
  // Claim síncrono en el INSERT: replica el commit point del índice unique.
  if (key) {
    if (store.claimed.has(key)) return conflictResult(r)
    store.claimed.set(key, id)
  }
  if (table === 'mia_signals') {
    store.signalInserts += 1
  } else {
    store.salesEvents.push({ ...r, id })
  }
  return { data: { id }, error: null }
}

let store: RetentionStore

beforeEach(() => {
  store = createStore()
  vi.clearAllMocks()
  vi.mocked(createAdminClient).mockReturnValue(makeClient(store) as never)
  vi.mocked(getSalesConfig).mockResolvedValue(fullConfig)
  vi.mocked(detectCancellation).mockResolvedValue({ confirmed: false, reason: null })
  vi.mocked(purgeCancelledOrderFromMemory).mockResolvedValue(undefined)
})

const offerEvent = (conversationId: string = CTX.conversationId) => ({
  businessId: CTX.businessId,
  conversationId,
  eventType: 'SALE_CANCELLED' as const,
  metadata: { reason: 'discount_offered' },
})

const realCancelEvent = (conversationId: string = CTX.conversationId) => ({
  businessId: CTX.businessId,
  conversationId,
  eventType: 'SALE_CANCELLED' as const,
  metadata: {
    reason: 'cambio de opinión',
    original_sale_event_id: WON_EVENT_ID,
    order_number: 'VTA-ABCDEF',
    within_window: true,
  },
})

const cancelEventsOf = (predicate: (row: Row) => boolean) =>
  store.salesEvents.filter(
    (e) => e.event_type === 'SALE_CANCELLED' && predicate(e)
  )

const metadataOf = (row: Row): Record<string, unknown> =>
  (row.metadata ?? {}) as Record<string, unknown>

const isOfferEvent = (row: Row) => metadataOf(row).reason === 'discount_offered'
const isRealCancelEvent = (row: Row) =>
  metadataOf(row).original_sale_event_id === WON_EVENT_ID

describe('H1 / ADR-030 — contrato 23505 en emitSalesEvent (partición de variantes)', () => {
  it('2 ofertas concurrentes ⇒ exactly-one + SalesEventConflictError tipificado', async () => {
    const results = await Promise.allSettled([
      emitSalesEvent(offerEvent()),
      emitSalesEvent(offerEvent()),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(isRetentionConflictError(rejected[0].reason)).toBe(true)
    expect(rejected[0].reason).toBeInstanceOf(SalesEventConflictError)
    expect((rejected[0].reason as SalesEventConflictError).constraint).toBe(
      'uq_sales_events_retention_offer_once'
    )
    expect(cancelEventsOf(isOfferEvent)).toHaveLength(1)
  })

  it('2 cancelaciones reales concurrentes ⇒ exactly-one + constraint de cancelación', async () => {
    const results = await Promise.allSettled([
      emitSalesEvent(realCancelEvent()),
      emitSalesEvent(realCancelEvent()),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(isRetentionConflictError(rejected[0].reason)).toBe(true)
    expect((rejected[0].reason as SalesEventConflictError).constraint).toBe(
      'uq_sales_events_cancellation_once'
    )
    expect(
      cancelEventsOf(isRealCancelEvent)
    ).toHaveLength(1)
  })

  it('oferta y cancelación real coexisten (variantes complementarias, 1:1 con 060)', async () => {
    await emitSalesEvent(offerEvent())
    await emitSalesEvent(realCancelEvent())

    expect(store.salesEvents).toHaveLength(2)
    expect(store.claimed.size).toBe(2)
    expect(cancelEventsOf(isOfferEvent)).toHaveLength(1)
    expect(
      cancelEventsOf(isRealCancelEvent)
    ).toHaveLength(1)
  })
})

describe('H1 / ADR-030 — concurrencia real: N ofertas simultáneas', () => {
  it(`N=3 ⇒ exactamente 1 SALE_CANCELLED(discount_offered), 1 oferta, 0 señales`, async () => {
    const N = 3
    const decisions: RetentionDecision[] = await Promise.all(
      Array.from({ length: N }, () =>
        resolveRetentionDecision({ ...CTX, lastUserMessage: 'quiero cancelar mi pedido' })
      )
    )

    const offers = decisions.filter((d) => d.action === 'discount_offer')
    expect(offers).toHaveLength(1)

    expect(
      cancelEventsOf(isOfferEvent)
    ).toHaveLength(1)
    // Solo el ganador persiste el sentinel; los perdedores no escriben nada.
    expect(store.convUpdateCalls).toBe(1)
    expect(store.signalInserts).toBe(0)
    expect(store.customerUpdateCalls).toBe(0)

    const losers = decisions.filter((d) => d.action !== 'discount_offer')
    expect(losers.length).toBe(N - 1)
    for (const d of losers) {
      // El perdedor por 23505 → ack determinista; el que leyó tarde el sentinel
      // del ganador → confirm_cancel (sin evento: detección no confirmada).
      expect(['ack', 'confirm_cancel']).toContain(d.action)
      if (d.action === 'ack') expect(d.response).toBe(OFFER_LOST_ACK)
    }
  })
})

describe('H1 / ADR-030 — concurrencia real: N confirms simultáneos (tras sentinel)', () => {
  it(`N=3 ⇒ exactamente 1 cancelación real, 1 señal, 0 duplicados`, async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    vi.mocked(detectCancellation).mockResolvedValue({ confirmed: true, reason: 'cambio de opinión' })

    const N = 3
    const decisions: RetentionDecision[] = await Promise.all(
      Array.from({ length: N }, () =>
        resolveRetentionDecision({ ...CTX, lastUserMessage: 'sí, quiero cancelar mi pedido' })
      )
    )

    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(1)
    expect(store.signalInserts).toBe(1)
    expect(store.customerUpdateCalls).toBe(1)
    // 1 update de cancelación real (el ganador); el sentinel no se reescribe.
    expect(store.convUpdateCalls).toBe(1)
    expect(store.convOutcome).toBe('cancelled')

    const winnerMessage = `Tu pedido VTA-ABCDEF ha sido cancelado.`
    expect(decisions.filter((d) => d.response === winnerMessage)).toHaveLength(1)
    expect(decisions.filter((d) => d.response === CANCELLATION_ALREADY_PROCESSED)).toHaveLength(N - 1)
    expect(vi.mocked(purgeCancelledOrderFromMemory)).toHaveBeenCalledTimes(1)
  })
})

describe('H1 / ADR-030 — compensación id-scoped (event-first preservado)', () => {
  it('evento creado → falla la conversación ⇒ borra SOLO el id creado; retry limpio', async () => {
    store.failConversationUpdate = true

    const first = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'quiero cancelar mi pedido',
    }).catch((e: unknown) => e)

    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain('Failed to persist cancellation state')
    expect(cancelEventsOf(() => true)).toHaveLength(0)
    expect(store.claimed.size).toBe(0)
    expect(store.deleteCalls).toHaveLength(1)
    expect(store.convUpdateCalls).toBe(1)

    store.failConversationUpdate = false
    const retry = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'quiero cancelar mi pedido',
    })

    expect(retry.action).toBe('discount_offer')
    expect(cancelEventsOf(isOfferEvent)).toHaveLength(1)
    expect(store.claimed.size).toBe(1)
  })
})