import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/knowledge', () => ({ getSalesConfig: vi.fn() }))
vi.mock('@/lib/sales/detect', () => ({ detectCancellation: vi.fn() }))
vi.mock('@/lib/sales/events', () => ({ emitSalesEvent: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { processCancellation } from '@/lib/sales/cancel'
import { getSalesConfig } from '@/lib/ai/knowledge'
import { detectCancellation } from '@/lib/sales/detect'
import { emitSalesEvent } from '@/lib/sales/events'
import { createAdminClient } from '@/lib/supabase/admin'
import { DISCOUNT_OFFERED_SENTINEL } from '@/lib/sales/process'

const params = {
  businessId: 'biz-1',
  assistantId: 'assistant-1',
  conversationId: 'conv-1',
  customerId: 'cust-1',
  lastUserMessage: 'quiero cancelar mi pedido',
  messages: [
    { role: 'user', content: 'quiero cancelar mi pedido' },
  ],
}

function makeDb(options?: {
  salesEventError?: boolean
  conversationUpdateError?: unknown
  customerUpdateError?: unknown
  salesEventDeleteError?: unknown
  previousCancelledAt?: string | null
  conversationUpdateThrow?: unknown
  customerUpdateThrow?: unknown
  revertMatchThrow?: unknown
}) {
  const conversationsSelectMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      outcome: 'sold',
      outcome_history: [],
      ...(options?.previousCancelledAt !== undefined ? { sales_cancelled_at: options.previousCancelledAt } : {}),
    },
    error: null,
  })

  const conversationsUpdateEq = vi
    .fn()
    .mockImplementation(() => {
      if (options?.conversationUpdateThrow) return Promise.reject(options.conversationUpdateThrow)
      return Promise.resolve({ error: options?.conversationUpdateError ?? null })
    })
  const conversationsUpdateMatch = vi.fn().mockImplementation(() => {
    if (options?.revertMatchThrow) return Promise.reject(options.revertMatchThrow)
    return Promise.resolve({ error: null })
  })
  const conversationsUpdate = vi.fn(() => ({
    eq: conversationsUpdateEq,
    match: conversationsUpdateMatch,
  }))

  const salesEventMaybeSingle = vi.fn().mockResolvedValue(
    options?.salesEventError
      ? { data: null, error: null }
      : {
          data: {
            id: 'evt1234567890',
            created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            amount: 1200,
            metadata: {},
          },
          error: null,
        }
  )
  const salesEventsDeleteEq = vi.fn().mockResolvedValue({
    error: options?.salesEventDeleteError ?? null,
  })
  const salesEventsDelete = vi.fn(() => ({ eq: salesEventsDeleteEq }))
  const salesEventsTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ maybeSingle: salesEventMaybeSingle })),
          })),
        })),
      })),
    })),
    delete: salesEventsDelete,
  }

  const customersUpdateEq = vi
    .fn()
    .mockImplementation(() => {
      if (options?.customerUpdateThrow) return Promise.reject(options.customerUpdateThrow)
      return Promise.resolve({ error: options?.customerUpdateError ?? null })
    })
  const customersUpdate = vi.fn(() => ({ eq: customersUpdateEq }))
  const customersSelectMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { name: 'Cliente Test' }, error: null })
  const customersTable = {
    update: customersUpdate,
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: customersSelectMaybeSingle })) })),
  }

  const signalsInsert = vi.fn().mockResolvedValue({ error: null })

  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((name: string) => {
      if (name === 'conversations') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: conversationsSelectMaybeSingle })) })), update: conversationsUpdate }
      }
      if (name === 'sales_events') return salesEventsTable
      if (name === 'customers') return customersTable
      if (name === 'mia_signals') return { insert: signalsInsert }
      throw new Error(`Unexpected table ${name}`)
    }),
    schema: vi.fn(() => {
      throw new Error('delivery schema unavailable')
    }),
  } as never)

  return {
    conversationsUpdate,
    conversationsUpdateEq,
    conversationsUpdateMatch,
    customersUpdate,
    signalsInsert,
    salesEventsDelete,
    salesEventsDeleteEq,
  }
}

// F1-a — mock stateful que replica el guard de optimismo del revert
// (.match({ id, sales_cancelled_at })) de forma determinista, incluyendo la
// ventana concurrente en que una cancelación LEGÍTIMA de otra ejecución cambia
// el estado ANTES de que se evalúe el guard.
function makeF1aStatefulDb(concurrentLegitWrite: boolean) {
  let current: string | null = DISCOUNT_OFFERED_SENTINEL
  const matchConds: Array<Record<string, unknown>> = []

  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((name: string) => {
      if (name === 'conversations') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  outcome: 'sold',
                  outcome_history: [],
                  sales_cancelled_at: current,
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(async () => {
              const ts = payload.sales_cancelled_at as string
              if (typeof ts === 'string' && ts !== DISCOUNT_OFFERED_SENTINEL) current = ts
              return { error: null }
            }),
            match: vi.fn(async (cond: Record<string, unknown>) => {
              matchConds.push(cond)
              if (concurrentLegitWrite) {
                // Una cancelación legítima concurrente aterriza en la ventana
                // previa al guard → el WHERE (sales_cancelled_at = <intento>) no
                // matchea fila y el revert NO se aplica.
                current = 'T2-concurrente-legitimo'
              } else if (current === cond.sales_cancelled_at) {
                // Sin escritura concurrente: el guard matchea (el estado sigue
                // siendo el timestamp de este intento) y el revert aplica.
                current = payload.sales_cancelled_at as string
              }
              return { error: null }
            }),
          })),
        }
      }
      if (name === 'sales_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        id: 'evt1234567890',
                        created_at: new Date(Date.now() - 3600e3).toISOString(),
                        amount: 100,
                        metadata: {},
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
          delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        }
      }
      if (name === 'customers') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: { message: 'db write failed' } })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { name: 'Cliente Test' }, error: null })),
            })),
          })),
        }
      }
      if (name === 'mia_signals') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      throw new Error(`Unexpected table ${name}`)
    }),
    schema: vi.fn(() => {
      throw new Error('delivery schema unavailable')
    }),
  } as never)

  return {
    matchConds: () => matchConds,
    current: () => current,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSalesConfig).mockResolvedValue({
    allow_cancellation: true,
    cancellation_window_hours: 24,
    cancellation_message: 'Pedido {order_id} cancelado. {customer_name}',
  } as never)
  vi.mocked(detectCancellation).mockResolvedValue({
    confirmed: true,
    reason: 'cliente insiste',
  } as never)
  vi.mocked(emitSalesEvent).mockResolvedValue('evt-new-1')
})

describe('processCancellation', () => {
  it('no procesa cuando la deteccion no confirma la cancelacion', async () => {
    makeDb()
    vi.mocked(detectCancellation).mockResolvedValue({ confirmed: false } as never)

    const result = await processCancellation(params)

    expect(result).toEqual({ processed: false, action: 'not_cancelation' })
  })

  it('niega la cancelacion cuando esta deshabilitada por configuracion', async () => {
    makeDb()
    vi.mocked(getSalesConfig).mockResolvedValue({
      allow_cancellation: false,
      cancellation_message: 'No se puede cancelar',
    } as never)

    const result = await processCancellation(params)

    expect(result.action).toBe('denied')
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('deniega cuando no existe venta previa que cancelar', async () => {
    makeDb({ salesEventError: true })

    const result = await processCancellation(params)

    expect(result.action).toBe('denied')
  })

  it('escribe estado de cancelacion valido sin tocar conversations.outcome (caso G)', async () => {
    const db = makeDb()

    await processCancellation(params)

    const [updatePayload] = db.conversationsUpdate.mock.calls[0] as [Record<string, unknown>]

    expect(updatePayload.outcome).toBeUndefined()
    expect(updatePayload.status).toBe('completed')
    expect(typeof updatePayload.sales_cancelled_at).toBe('string')
    expect(updatePayload.sales_cancelled_at).not.toBe('0001-01-01T00:00:01Z')
    expect(Array.isArray(updatePayload.outcome_history)).toBe(true)
    const history = updatePayload.outcome_history as Array<Record<string, unknown>>
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      outcome: 'cancelled',
      previous: 'sold',
      event_type: 'SALE_CANCELLED',
    })
  })

  it('marca el customer como lost tras cancelar', async () => {
    const db = makeDb()

    await processCancellation(params)

    expect(db.customersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'lost',
        last_cancelled_order: expect.objectContaining({
          order_id: 'evt1234567890',
          product_id: null,
          product_name: null,
          reason: 'cliente insiste',
          event_id: 'evt1234567890',
        }),
      })
    )
  })

  it('propaga el error cuando falla la escritura del estado de cancelacion (caso H)', async () => {
    makeDb({ conversationUpdateError: { message: 'CHECK constraint violated' } })

    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to persist cancellation state'
    )
  })

  it('propaga el error cuando falla la actualizacion del customer (caso H)', async () => {
    makeDb({ customerUpdateError: { message: 'db write failed' } })

    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to update customer status after cancellation'
    )
  })

  // F1 / ADR-030 — compensación id-scoped en la cancelación real.
  it('F1: falla el update de conversación ⇒ borra SOLO el evento creado por su id', async () => {
    const db = makeDb({ conversationUpdateError: { message: 'CHECK constraint violated' } })

    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to persist cancellation state'
    )

    expect(emitSalesEvent).toHaveBeenCalledTimes(1)
    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
    expect(db.salesEventsDelete).toHaveBeenCalledTimes(1)
  })

  it('F1: falla el update del cliente ⇒ compensación id-scoped antes de re-lanzar', async () => {
    const db = makeDb({ customerUpdateError: { message: 'db write failed' } })

    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to update customer status after cancellation'
    )

    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
  })

  // F2 / ADR-030 — el tag reservado 'discount_offered' nunca llega a la variante
  // de cancelación real (no colisiona con el índice de la oferta).
  it('F2: detection.reason=discount_offered ⇒ la cancelación real NO escribe el tag reservado', async () => {
    const db = makeDb()
    vi.mocked(detectCancellation).mockResolvedValue({
      confirmed: true,
      reason: 'discount_offered',
    } as never)

    const result = await processCancellation(params)

    expect(result.action).toBe('confirmed')
    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_CANCELLED',
        metadata: expect.objectContaining({
          reason: null,
          original_sale_event_id: 'evt1234567890',
        }),
      })
    )
    const [updatePayload] = db.conversationsUpdate.mock.calls[0] as unknown as [
        Record<string, unknown>
      ]
    const history = updatePayload.outcome_history as Array<Record<string, unknown>>
    expect(history[0].reason).toBeNull()
    expect(db.customersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        last_cancelled_order: expect.objectContaining({ reason: null }),
      })
    )
  })

  // F1-a / ADR-030 — fallo del update de cliente tras commit de conversación:
  // el revert restaura el estado pre-intento anclado al timestamp del intento.
  it('F1-a: falla el update del cliente ⇒ borra el evento Y revierte la conversación al estado pre-intento', async () => {
    const db = makeDb({
      customerUpdateError: { message: 'db write failed' },
      previousCancelledAt: DISCOUNT_OFFERED_SENTINEL,
    })

    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to update customer status after cancellation'
    )

    // Compensación id-scoped del evento propio.
    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
    // Dos updates de conversación: la escritura principal + el revert.
    expect(db.conversationsUpdate).toHaveBeenCalledTimes(2)
    const [mainPayload] = db.conversationsUpdate.mock.calls[0] as unknown as [
      Record<string, unknown>
    ]
    const attemptTs = mainPayload.sales_cancelled_at as string
    const [revertPayload] = db.conversationsUpdate.mock.calls[1] as unknown as [
      Record<string, unknown>
    ]
    expect(revertPayload.sales_cancelled_at).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(revertPayload.outcome_history).toEqual([])
    // El revert va anclado al timestamp EXACTO del intento (guard de optimismo).
    expect(db.conversationsUpdateMatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conv-1', sales_cancelled_at: attemptTs })
    )
  })

  it('F1-a: sin escritura concurrente, el revert SÍ se aplica y restaura el sentinel previo', async () => {
    const db = makeF1aStatefulDb(false)

    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to update customer status after cancellation'
    )

    expect(db.current()).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(db.matchConds()).toHaveLength(1)
    expect(db.matchConds()[0].id).toBe('conv-1')
    expect(typeof db.matchConds()[0].sales_cancelled_at).toBe('string')
  })

  it('F1-a: el revert NO revierte una cancelación legítima concurrente posterior (guard de optimismo)', async () => {
    const db = makeF1aStatefulDb(true)

    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to update customer status after cancellation'
    )

    // La cancelación legítima de la otra ejecución sobrevive intacta.
    expect(db.current()).toBe('T2-concurrente-legitimo')
    expect(db.matchConds()).toHaveLength(1)
    expect(db.matchConds()[0].sales_cancelled_at).not.toBe(DISCOUNT_OFFERED_SENTINEL)
  })

  // F1-b / ADR-030 — la compensación DELETE nunca es silenciosa: supabase-js no
  // lanza ante un error de DB, así que el { error } se inspecciona y se reporta.
  it('F1-b: DELETE de compensación con { error } ⇒ detectado y reportado; el error original se re-lanza', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = makeDb({
      conversationUpdateError: { message: 'CHECK constraint violated' },
      salesEventDeleteError: { message: 'connection reset' },
    })

    await expect(processCancellation(params)).rejects.toThrow('Failed to persist cancellation state')

    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('compensate'),
      expect.objectContaining({ conversationId: 'conv-1', createdEventId: 'evt-new-1' })
    )
    spy.mockRestore()
  })

  it('F1-b: compensación exitosa ⇒ no se reportan falsos errores', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = makeDb({ conversationUpdateError: { message: 'CHECK constraint violated' } })

    await expect(processCancellation(params)).rejects.toThrow('Failed to persist cancellation state')

    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('F1-b: DELETE con { error } en fallo de cliente ⇒ detectado/reportado; el revert se ejecuta igual', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = makeDb({
      customerUpdateError: { message: 'db write failed' },
      salesEventDeleteError: { message: 'connection reset' },
      previousCancelledAt: DISCOUNT_OFFERED_SENTINEL,
    })

    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to update customer status after cancellation'
    )

    expect(spy).toHaveBeenCalled()
    // Orden compensar → revert → throw: el revert se intenta A PESAR del fallo del DELETE.
    expect(db.conversationsUpdate).toHaveBeenCalledTimes(2)
    const [revertPayload] = db.conversationsUpdate.mock.calls[1] as unknown as [
      Record<string, unknown>
    ]
    expect(revertPayload.sales_cancelled_at).toBe(DISCOUNT_OFFERED_SENTINEL)
    spy.mockRestore()
  })

  // ===== Godzilla H1 — BUG-T1/T2/T3: escrituras que RECHAZAN (throw, no {error})
  // ===== Patrón throw-safe (ídem compensateCreatedEvent): compensar + revert
  // ===== antes de re-lanzar, preservando el error original siempre.

  it('BUG-T2: el update de conversación RECHAZA (throw) ⇒ compensa antes de re-lanzar; retry converge', async () => {
    const db = makeDb({
      conversationUpdateThrow: new Error('net: conversations update rejected'),
    })

    await expect(processCancellation(params)).rejects.toThrow(
      'net: conversations update rejected'
    )
    // Compensación id-scoped se ejecutó A PESAR del throw.
    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
  })

  it('BUG-T2: el update de conversación RECHAZA ⇒ el error original se preserva (no se fabrica otro)', async () => {
    const db = makeDb({
      conversationUpdateThrow: Object.assign(new Error('socket hang up'), { kind: 'network' }),
    })

    await expect(processCancellation(params)).rejects.toThrow('socket hang up')
    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
  })

  it('BUG-T1: el update de cliente RECHAZA (throw) ⇒ compensa Y revierte antes de re-lanzar', async () => {
    const db = makeDb({
      customerUpdateThrow: new Error('net: customers update rejected'),
      previousCancelledAt: DISCOUNT_OFFERED_SENTINEL,
    })

    await expect(processCancellation(params)).rejects.toThrow(
      'net: customers update rejected'
    )
    // La compensación corre (evento propio borrado)…
    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
    // …y el revert de conversación también (una escritura principal + un revert).
    expect(db.conversationsUpdate).toHaveBeenCalledTimes(2)
    const [revertPayload] = db.conversationsUpdate.mock.calls[1] as unknown as [
      Record<string, unknown>
    ]
    expect(revertPayload.sales_cancelled_at).toBe(DISCOUNT_OFFERED_SENTINEL)
  })

  it('BUG-T3: el REVERT RECHAZA (throw) ⇒ no enmascara el error original y sí lo reporta', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = makeDb({
      customerUpdateError: { message: 'db write failed' },
      revertMatchThrow: new Error('net: revert match rejected'),
      previousCancelledAt: DISCOUNT_OFFERED_SENTINEL,
    })

    // El error del cliente ({error}, no throw) sigue siendo el que se propaga:
    // el revert throw-safe lo reporta pero NO lo enmascara.
    await expect(processCancellation(params)).rejects.toThrow(
      'Failed to update customer status after cancellation'
    )
    // La compensación sí se ejecutó.
    expect(db.salesEventsDeleteEq).toHaveBeenCalledWith('id', 'evt-new-1')
    // El revert fallido se reporta (catch-and-log), no silencioso.
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('revert'),
      expect.objectContaining({ conversationId: 'conv-1' })
    )
    spy.mockRestore()
  })
})
