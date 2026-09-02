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
import { processCancellation } from '@/lib/sales/cancel'
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
  failCustomerUpdate: boolean
  failCompensationDelete: boolean
  // Godzilla H1 — BUG-T1/T2/T5: escrituras que RECHAZAN (throw, no {error}).
  failConversationUpdateThrow: boolean
  failCustomerUpdateThrow: boolean
  failOfferStateUpdateThrow: boolean
  failRevertThrow: boolean
  // RESIDUAL-R1/R2 — read de conversación que RECHAZA (throw) tras emitSalesEvent.
  convReadThrowAt: number | null
  convReadCalls: number
  claimed: Map<string, string>
  salesEvents: Array<Record<string, unknown>>
  convUpdateCalls: number
  customerUpdateCalls: number
  signalInserts: number
  deleteCalls: Array<{ col: string; value: string }>
  compensationDeleteErrorSeen: boolean
  // F1-a: guard de optimismo del revert (escrituras reales del intento + llamadas
  // .match() de conversación, que replican el WHERE del revert).
  convRealWrites: string[]
  convMatchCalls: Array<{ cond: Record<string, unknown>; payload: Row }>
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
  update: (row: Row) => {
    eq: () => Promise<{ data: unknown; error: unknown }>
    match: (cond: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  }
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
    failCustomerUpdate: false,
    failCompensationDelete: false,
    failConversationUpdateThrow: false,
    failCustomerUpdateThrow: false,
    failOfferStateUpdateThrow: false,
    failRevertThrow: false,
    convReadThrowAt: null,
    convReadCalls: 0,
    claimed: new Map(),
    salesEvents: [],
    convUpdateCalls: 0,
    customerUpdateCalls: 0,
    signalInserts: 0,
    deleteCalls: [],
    compensationDeleteErrorSeen: false,
    convRealWrites: [],
    convMatchCalls: [],
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
        store.convReadCalls += 1
        if (store.convReadThrowAt !== null && store.convReadCalls === store.convReadThrowAt) {
          throw networkError('net: conversations read rejected')
        }
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
      update: (r: Row) => {
        const applyConversationPayload = (): void => {
          const isSentinel = r.sales_cancelled_at === DISCOUNT_OFFERED_SENTINEL
          if (isSentinel) {
            store.convSentinel = DISCOUNT_OFFERED_SENTINEL
            store.convHistory = [...store.convHistory, { at: 'sentinel-write' }]
          } else if (r.sales_cancelled_at === null) {
            store.convSentinel = null
            store.convOutcome = null
          } else {
            store.convSentinel = (r.sales_cancelled_at as string) ?? store.convSentinel
            store.convRealWrites.push(r.sales_cancelled_at as string)
            store.convOutcome = 'cancelled'
          }
        }
        return {
          eq: () => {
            if (table === 'conversations') {
              store.convUpdateCalls += 1
              const isSentinelWrite = r.sales_cancelled_at === DISCOUNT_OFFERED_SENTINEL
              if (store.failOfferStateUpdateThrow && isSentinelWrite) {
                return Promise.reject(networkError('net: conversations update rejected (offer)'))
              }
              if (store.failConversationUpdateThrow) {
                return Promise.reject(networkError('net: conversations update rejected (confirm)'))
              }
              if (store.failConversationUpdate) {
                return Promise.resolve({
                  data: null,
                  error: { code: 'PLACEHOLDER', message: 'forced failure' },
                })
              }
              applyConversationPayload()
            }
            if (table === 'customers') {
              store.customerUpdateCalls += 1
              if (store.failCustomerUpdateThrow) {
                return Promise.reject(networkError('net: customers update rejected'))
              }
              if (store.failCustomerUpdate) {
                return Promise.resolve({ data: null, error: { message: 'forced customer failure' } })
              }
            }
            return Promise.resolve({ data: null, error: null })
          },
          // F1-a: el revert usa .match({ id, sales_cancelled_at: <timestamp del
          // intento> }). Replica el WHERE del UPDATE real: solo aplica si el
          // estado actual SIGUE siendo el timestamp de este intento (no pisa una
          // escritura concurrente posterior).
          match: (cond: Record<string, unknown>) => {
            store.convMatchCalls.push({ cond, payload: r })
            if (table === 'conversations' && store.failRevertThrow) {
              return Promise.reject(networkError('net: revert match rejected'))
            }
            if (table === 'conversations' && cond.sales_cancelled_at === store.convSentinel) {
              store.convUpdateCalls += 1
              store.convOutcome = null
              applyConversationPayload()
            }
            return Promise.resolve({ data: null, error: null })
          },
        }
      },
      delete: () => ({
        eq: (c: string, v: unknown) => {
          if (store.failCompensationDelete) {
            store.compensationDeleteErrorSeen = true
            return Promise.resolve({ data: null, error: { message: 'forced compensation failure' } })
          }
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

const networkError = (msg: string) => Object.assign(new Error(msg), { kind: 'network' })

const cancelParamsFor = (ctx: typeof CTX) => ({
  businessId: ctx.businessId,
  assistantId: ctx.assistantId,
  conversationId: ctx.conversationId,
  customerId: ctx.customerId,
  lastUserMessage: 'sí, quiero cancelar mi pedido',
  messages: [{ role: 'user', content: 'sí, quiero cancelar mi pedido' }],
})

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

describe('H1 / ADR-030 — F1: compensación id-scoped en la cancelación real', () => {
  it('confirm: evento real creado → falla el update de conversación ⇒ borra SOLO el id y el retry converge', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    vi.mocked(detectCancellation).mockResolvedValue({ confirmed: true, reason: 'demora' })
    // Evento ajeno (otra conversación): debe sobrevivir a la compensación.
    store.salesEvents.push({
      id: 'foreign-1',
      event_type: 'SALE_CANCELLED',
      conversation_id: 'other-conv',
      metadata: { reason: 'cambio de opinión', original_sale_event_id: 'other-won' },
    })

    // 1) El evento de confirmación se CREA; 2) el update de conversación falla.
    store.failConversationUpdate = true
    const first = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'sí, quiero cancelar mi pedido',
    }).catch((e: unknown) => e)

    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain('Failed to persist cancellation state')
    // 3) El evento propio fue eliminado → el slot queda libre.
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(0)
    expect(store.claimed.size).toBe(0)
    // Compensación id-scoped: exactamente un borrado por 'id', jamás conversation_id.
    expect(store.deleteCalls).toHaveLength(1)
    expect(store.deleteCalls[0].col).toBe('id')
    expect(store.deleteCalls[0].value).toMatch(/^evt-/)
    // 5) No se eliminó ningún evento ajeno.
    expect(store.salesEvents.some((e) => e.id === 'foreign-1')).toBe(true)
    expect(store.signalInserts).toBe(0)
    expect(store.customerUpdateCalls).toBe(0)

    // 4) Un retry idéntico re-ejecuta limpio, sin ack falso de "ya fue cancelado".
    store.failConversationUpdate = false
    const retry = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'sí, quiero cancelar mi pedido',
    })

    expect(retry.action).toBe('confirm_cancel')
    expect(retry.response).toContain('VTA-ABCDEF')
    expect(retry.response).not.toContain('ya fue cancelado')
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(1)
    expect(store.signalInserts).toBe(1)
    expect(store.customerUpdateCalls).toBe(1)
    expect(store.convOutcome).toBe('cancelled')
  })
})

describe('H1 / ADR-030 — F2: tag reservado discount_offered nunca llega a la cancelación real', () => {
  it('detection.reason=discount_offered ⇒ la cancelación real no colisiona con el slot de la oferta', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    // El slot de oferta YA está ocupado (escenario F2): el tag del LLM no puede
    // redirigir la variante real al índice reservado de la oferta y dejar la
    // cancelación bloqueada en un 23505 silencioso.
    store.claimed.set(`offer:${CTX.conversationId}`, 'evt-offer')
    store.salesEvents.push({
      id: 'evt-offer',
      event_type: 'SALE_CANCELLED',
      conversation_id: CTX.conversationId,
      metadata: { reason: 'discount_offered' },
    })
    vi.mocked(detectCancellation).mockResolvedValue({ confirmed: true, reason: 'discount_offered' })

    const decision = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'sí, quiero cancelar mi pedido',
    })

    expect(decision.action).toBe('confirm_cancel')
    expect(decision.response).not.toContain('ya fue cancelado')
    // El evento real se inserta (free del bloqueo de oferta) y NO lleva el tag.
    const real = cancelEventsOf(isRealCancelEvent)
    expect(real).toHaveLength(1)
    expect(isOfferEvent(real[0])).toBe(false)
    expect(metadataOf(real[0]).reason).not.toBe('discount_offered')
    // Ocupó correctamente el slot de cancelación real (no el de la oferta).
    expect(store.claimed.has(`offer:${CTX.conversationId}`)).toBe(true)
    expect(store.claimed.has(`cancel:${CTX.conversationId}`)).toBe(true)
    expect(store.signalInserts).toBe(1)
    expect(store.customerUpdateCalls).toBe(1)
    expect(store.convOutcome).toBe('cancelled')
  })
})

describe('H1 / ADR-030 — F1-a: fallo del update de cliente tras commit de conversación (revert id-scoped del intento)', () => {
  it('conversación commitada → cliente falla → revert al estado pre-intento → retry idéntico converge', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    vi.mocked(detectCancellation).mockResolvedValue({ confirmed: true, reason: 'demora' })
    store.failCustomerUpdate = true
    // Evento ajeno (otra conversación): debe sobrevivir a compensación y revert.
    store.salesEvents.push({
      id: 'foreign-1',
      event_type: 'SALE_CANCELLED',
      conversation_id: 'other-conv',
      metadata: { reason: 'cambio de opinión', original_sale_event_id: 'other-won' },
    })

    const first = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'sí, quiero cancelar mi pedido',
    }).catch((e: unknown) => e)

    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain(
      'Failed to update customer status after cancellation'
    )
    // 1) Slot liberado + evento propio eliminado (id-scoped, jamás conversation_id).
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(0)
    expect(store.claimed.size).toBe(0)
    expect(store.deleteCalls).toHaveLength(1)
    expect(store.deleteCalls[0].col).toBe('id')
    // 2) Conversación REVERTIDA al estado pre-intento: el sentinel de la oferta
    //    sigue vivo → el retry NO cae en ACK_ALREADY_CANCELLED.
    expect(store.convSentinel).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(store.convOutcome).toBe(null)
    // 3) El revert va anclado al timestamp EXACTO del intento (guard de optimismo).
    expect(store.convRealWrites).toHaveLength(1)
    expect(store.convMatchCalls).toHaveLength(1)
    expect(store.convMatchCalls[0].cond.id).toBe(CTX.conversationId)
    expect(store.convMatchCalls[0].cond.sales_cancelled_at).toBe(store.convRealWrites[0])
    // 4) Evento ajeno intacto; 0 señales; 0 efectos del cliente.
    expect(store.salesEvents.some((e) => e.id === 'foreign-1')).toBe(true)
    expect(store.signalInserts).toBe(0)

    // RETRY idéntico → converge al resultado de una ejecución única.
    store.failCustomerUpdate = false
    const retry = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'sí, quiero cancelar mi pedido',
    })

    expect(retry.action).toBe('confirm_cancel')
    expect(retry.response).toContain('VTA-ABCDEF')
    expect(retry.response).not.toContain('ya fue cancelado')
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(1)
    expect(store.convOutcome).toBe('cancelled')
    expect(store.signalInserts).toBe(1)
    // 5) Exactamente UN update final del cliente (el intento fallido dejó 1 en el contador).
    expect(store.customerUpdateCalls).toBe(2)
  })
})

describe('H1 / ADR-030 — F1-b: la compensación DELETE nunca es silenciosa', () => {
  it('fallo de conversación + DELETE { error } ⇒ detectado y reportado; el evento NO se presenta como compensado', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    vi.mocked(detectCancellation).mockResolvedValue({ confirmed: true, reason: 'demora' })
    store.failConversationUpdate = true
    store.failCompensationDelete = true
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const first = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'sí, quiero cancelar mi pedido',
    }).catch((e: unknown) => e)

    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain('Failed to persist cancellation state')
    expect(store.compensationDeleteErrorSeen).toBe(true)
    expect(spy).toHaveBeenCalled()
    // Sin falso éxito: el evento NO se eliminó (el slot sigue ocupado).
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(1)
    expect(store.claimed.has(`cancel:${CTX.conversationId}`)).toBe(true)
    // La conversación jamás se canceló (el error re-lanzado lo impide).
    expect(store.convSentinel).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(store.convOutcome).toBe(null)
    expect(store.signalInserts).toBe(0)
    spy.mockRestore()
  })

  it('fallo de cliente + DELETE { error } ⇒ detectado/reportado, revert aún aplicado; el retry no fabrica éxito', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    vi.mocked(detectCancellation).mockResolvedValue({ confirmed: true, reason: 'demora' })
    store.failCustomerUpdate = true
    store.failCompensationDelete = true
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const first = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'sí, quiero cancelar mi pedido',
    }).catch((e: unknown) => e)

    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain(
      'Failed to update customer status after cancellation'
    )
    expect(store.compensationDeleteErrorSeen).toBe(true)
    expect(spy).toHaveBeenCalled()
    // El revert de conversación se ejecuta A PESAR del fallo del DELETE: la
    // conversación vuelve al sentinel (orden compensar → revert → throw).
    expect(store.convSentinel).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(store.convOutcome).toBe(null)
    expect(store.convMatchCalls).toHaveLength(1)
    // El slot sigue ocupado (el DELETE falló): el retry honestamente acusa el
    // conflicto (CANCELLATION_ALREADY_PROCESSED) en vez de duplicar el evento.
    store.failCustomerUpdate = false
    const retry = await resolveRetentionDecision({
      ...CTX,
      lastUserMessage: 'sí, quiero cancelar mi pedido',
    })

    expect(retry.response).toBe(CANCELLATION_ALREADY_PROCESSED)
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(1)
    expect(store.convOutcome).toBe(null)
    expect(store.signalInserts).toBe(0)
    expect(store.customerUpdateCalls).toBe(1)
    spy.mockRestore()
  })
})

describe('Godzilla H1 — BUG-T1/T2/T5: escrituras que RECHAZAN (throw, no {error}) convergen', () => {
  beforeEach(() => {
    // para estos tests la confirmación real sí procede
    vi.mocked(detectCancellation).mockResolvedValue({ confirmed: true, reason: 'demora' })
  })

  it('BUG-T2: conversación RECHAZA (throw) ⇒ compensa el evento propio + slot libre + retry convergente', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    store.failConversationUpdateThrow = true
    // Evento ajeno para garantizar que la compensación id-scoped jamás lo borra.
    store.salesEvents.push({
      id: 'foreign-1',
      event_type: 'SALE_CANCELLED',
      conversation_id: 'other-conv',
      metadata: { reason: 'cambio de opinión', original_sale_event_id: 'other-won' },
    })

    const first = await processCancellation(cancelParamsFor(CTX)).catch((e: unknown) => e)
    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain('net: conversations update rejected (confirm)')
    // Compensación ejecutada: solo el evento propio fue borrado.
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(0)
    expect(store.salesEvents.some((e) => e.id === 'foreign-1')).toBe(true)
    expect(store.claimed.size).toBe(0)
    // La conversación nunca se canceló (el retry puede re-ejecutar limpio).
    expect(store.convSentinel).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(store.convOutcome).toBe(null)

    // Retry convergente: 1 evento real, sin quedarse clavado en 23505.
    store.failConversationUpdateThrow = false
    const retry = await resolveRetentionDecision({ ...CTX, lastUserMessage: 'sí, quiero cancelar mi pedido' })
    expect(retry.action).toBe('confirm_cancel')
    expect(retry.response).toContain('VTA-ABCDEF')
    expect(retry.response).not.toContain('ya fue cancelado')
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(1)
    expect(store.convOutcome).toBe('cancelled')
    expect(store.signalInserts).toBe(1)
    // El evento ajeno sigue intacto tras el flujo completo.
    expect(store.salesEvents.some((e) => e.id === 'foreign-1')).toBe(true)
  })

  it('BUG-T1: cliente RECHAZA (throw) ⇒ compensa + revierte + retry convergente sin ABANDERAR ack falso', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    store.failCustomerUpdateThrow = true
    store.salesEvents.push({
      id: 'foreign-1',
      event_type: 'SALE_CANCELLED',
      conversation_id: 'other-conv',
      metadata: { reason: 'cambio de opinión', original_sale_event_id: 'other-won' },
    })

    const first = await processCancellation(cancelParamsFor(CTX)).catch((e: unknown) => e)
    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain('net: customers update rejected')
    // Slot liberado + evento propio revertido y ajeno intacto.
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(0)
    expect(store.claimed.size).toBe(0)
    expect(store.salesEvents.some((e) => e.id === 'foreign-1')).toBe(true)
    // Conversación revertida al sentinel de oferta (no a un ack "ya cancelado").
    expect(store.convSentinel).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(store.convOutcome).toBe(null)
    expect(store.convMatchCalls).toHaveLength(1)

    // Retry convergente.
    store.failCustomerUpdateThrow = false
    const retry = await resolveRetentionDecision({ ...CTX, lastUserMessage: 'sí, quiero cancelar mi pedido' })
    expect(retry.response).toContain('VTA-ABCDEF')
    expect(retry.response).not.toContain('ya fue cancelado')
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(1)
    expect(store.convOutcome).toBe('cancelled')
    expect(store.signalInserts).toBe(1)
    expect(store.salesEvents.some((e) => e.id === 'foreign-1')).toBe(true)
  })

  it('BUG-T5: el sentinel de oferta RECHAZA (throw) ⇒ compensa el evento de oferta + retry re-oferta limpio', async () => {
    store.failOfferStateUpdateThrow = true
    store.salesEvents.push({
      id: 'offer-foreign',
      event_type: 'SALE_CANCELLED',
      conversation_id: 'other-conv',
      metadata: { reason: 'discount_offered' },
    })

    const first = await resolveRetentionDecision({ ...CTX, lastUserMessage: 'quiero cancelar mi pedido' }).catch(
      (e: unknown) => e
    )
    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain('net: conversations update rejected (offer)')
    // El evento de oferta propio se compensó (slot liberado); el ajeno intacto.
    expect(cancelEventsOf(isOfferEvent)).toHaveLength(1)
    expect(store.salesEvents.some((e) => e.id === 'offer-foreign')).toBe(true)
    expect(store.claimed.size).toBe(0)
    // El sentinel nunca se escribió → el retry puede ofertar de nuevo limpio.
    expect(store.convSentinel).toBeNull()

    store.failOfferStateUpdateThrow = false
    const retry = await resolveRetentionDecision({ ...CTX, lastUserMessage: 'quiero cancelar mi pedido' })
    expect(retry.action).toBe('discount_offer')
    expect(cancelEventsOf(isOfferEvent)).toHaveLength(2) // 1 ajeno + 1 nuevo propio
    expect(store.convSentinel).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(store.signalInserts).toBe(0)
    expect(store.salesEvents.some((e) => e.id === 'offer-foreign')).toBe(true)
  })

  it('BUG-T3: revert RECHAZA (throw) ⇒ no enmascara el error de cliente ni fabrica convergencia falsa', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    store.failCustomerUpdate = true // {error} de cliente (no throw)
    store.failRevertThrow = true
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const first = await processCancellation(cancelParamsFor(CTX)).catch((e: unknown) => e)
    // El error del cliente ({error}) es el que se preserva — el revert throw-safe
    // lo reporta pero NO lo enmascara con el error del revert.
    expect(String((first as Error).message)).toContain('Failed to update customer status')
    // El revert fallido se reporta (catch-and-log), no silencioso.
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('revert'),
      expect.objectContaining({ conversationId: CTX.conversationId })
    )
    spy.mockRestore()
  })

  it('RESIDUAL-R1: read de conversación RECHAZA (throw) en cancel.ts ⇒ compensa el evento propio; retry converge', async () => {
    store.convSentinel = DISCOUNT_OFFERED_SENTINEL
    // read de cancel.ts:165-169 — es el ÚNICO read de conversaciones en la
    // llamada directa a processCancellation (1er read).
    store.convReadThrowAt = 1
    store.salesEvents.push({
      id: 'foreign-1',
      event_type: 'SALE_CANCELLED',
      conversation_id: 'other-conv',
      metadata: { reason: 'cambio de opinión', original_sale_event_id: 'other-won' },
    })

    const first = await processCancellation(cancelParamsFor(CTX)).catch((e: unknown) => e)
    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain('net: conversations read rejected')
    // Compensación id-scoped ejecutada: solo el evento propio se borró; el ajeno intacto.
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(0)
    expect(store.claimed.size).toBe(0)
    expect(store.salesEvents.some((e) => e.id === 'foreign-1')).toBe(true)
    // La conversación conserva el sentinel (no se canceló) → el retry re-ejecuta limpio.
    expect(store.convSentinel).toBe(DISCOUNT_OFFERED_SENTINEL)

    store.convReadThrowAt = null
    const retry = await resolveRetentionDecision({ ...CTX, lastUserMessage: 'sí, quiero cancelar mi pedido' })
    expect(retry.response).toContain('VTA-ABCDEF')
    expect(retry.response).not.toContain('ya fue cancelado')
    expect(cancelEventsOf(isRealCancelEvent)).toHaveLength(1)
    expect(store.convOutcome).toBe('cancelled')
    expect(store.signalInserts).toBe(1)
    expect(store.salesEvents.some((e) => e.id === 'foreign-1')).toBe(true)
  })

  it('RESIDUAL-R2: read de convHistory RECHAZA (throw) en retention.ts ⇒ compensa el evento de oferta; retry re-oferta limpio', async () => {
    // read de retention.ts:143-147 (2do read de conversaciones, tras emitSalesEvent).
    store.convReadThrowAt = 2
    store.salesEvents.push({
      id: 'offer-foreign',
      event_type: 'SALE_CANCELLED',
      conversation_id: 'other-conv',
      metadata: { reason: 'discount_offered' },
    })

    const first = await resolveRetentionDecision({ ...CTX, lastUserMessage: 'quiero cancelar mi pedido' }).catch(
      (e: unknown) => e
    )
    expect(first).toBeInstanceOf(Error)
    expect(String((first as Error).message)).toContain('net: conversations read rejected')
    // El evento de oferta propio se compensó; el ajeno intacto; slot libre.
    expect(cancelEventsOf(isOfferEvent)).toHaveLength(1)
    expect(store.salesEvents.some((e) => e.id === 'offer-foreign')).toBe(true)
    expect(store.claimed.size).toBe(0)
    expect(store.convSentinel).toBeNull()

    store.convReadThrowAt = null
    const retry = await resolveRetentionDecision({ ...CTX, lastUserMessage: 'quiero cancelar mi pedido' })
    expect(retry.action).toBe('discount_offer')
    expect(cancelEventsOf(isOfferEvent)).toHaveLength(2) // 1 ajeno + 1 nuevo propio
    expect(store.convSentinel).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(store.signalInserts).toBe(0)
    expect(store.salesEvents.some((e) => e.id === 'offer-foreign')).toBe(true)
  })
})