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
}) {
  const conversationsSelectMaybeSingle = vi.fn().mockResolvedValue({
    data: { outcome: 'sold', outcome_history: [] },
    error: null,
  })

  const conversationsUpdateEq = vi
    .fn()
    .mockResolvedValue({ error: options?.conversationUpdateError ?? null })
  const conversationsUpdate = vi.fn(() => ({ eq: conversationsUpdateEq }))

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
  }

  const customersUpdateEq = vi
    .fn()
    .mockResolvedValue({ error: options?.customerUpdateError ?? null })
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

  return { conversationsUpdate, conversationsUpdateEq, customersUpdate, signalsInsert }
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
  vi.mocked(emitSalesEvent).mockResolvedValue(undefined)
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
})
