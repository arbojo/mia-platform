import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/sales/detect', () => ({
  hasSalesTrigger: vi.fn(),
  detectSaleOutcome: vi.fn(),
  hasDiscountAcceptanceTrigger: vi.fn(),
  hasCancellationTrigger: vi.fn(),
}))
vi.mock('@/lib/sales/events', () => ({
  applyConversationOutcome: vi.fn(),
  emitSaleConfirmed: vi.fn(),
  emitSalesEvent: vi.fn(),
  fetchOrderNumber: vi.fn(),
  getCustomerData: vi.fn(),
  getCustomerName: vi.fn(),
  hasCancellationLock: vi.fn(),
  hasClosingEvent: vi.fn(),
  notifySaleToOwner: vi.fn(),
}))
vi.mock('@/lib/sales/cancel', () => ({ processCancellation: vi.fn() }))
vi.mock('@/lib/conversation/resolver', () => ({
  resolveConnection: vi.fn(),
  resolveConversation: vi.fn(),
}))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/ai/knowledge', () => ({ getSalesConfig: vi.fn() }))

import { handleCancellationWebhook } from '@/lib/sales/process'
import { emitSalesEvent } from '@/lib/sales/events'
import {
  hasDiscountAcceptanceTrigger,
  hasCancellationTrigger,
} from '@/lib/sales/detect'
import {
  resolveConnection,
  resolveConversation,
} from '@/lib/conversation/resolver'
import { resolveCustomer } from '@/lib/channels/identity'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WireMessage } from '@/lib/runtime/types'

type StubResult = { data?: unknown; error?: unknown }

interface DbConfig {
  activeSale: () => StubResult
  lastWon: () => StubResult
  convState: () => StubResult
  convHistory: () => StubResult
  conversationUpdateError?: unknown
  customersUpdateError?: unknown
}

interface DbHarness {
  client: ReturnType<typeof createAdminClient>
  deleteIds: unknown[]
  deleteFilters: Array<Array<[string, unknown]>>
  conversationUpdates: Array<Record<string, unknown>>
}

function createDb(config: DbConfig): DbHarness {
  const salesMaybes: Array<() => StubResult> = [config.activeSale, config.lastWon]
  const convMaybes: Array<() => StubResult> = [config.convState, config.convHistory]
  const deleteIds: unknown[] = []
  const deleteFilters: Array<Array<[string, unknown]>> = []
  const conversationUpdates: Array<Record<string, unknown>> = []

  function selectBuilder(getResult: () => StubResult) {
    const chain: Record<string, () => unknown> = {
      select: () => chain,
      eq: () => chain,
      ilike: () => chain,
      order: () => chain,
      limit: () => chain,
      in: () => chain,
      maybeSingle: () => Promise.resolve(getResult()),
      single: () => Promise.resolve(getResult()),
    }
    return chain
  }

  const client = {
    from: (name: string) => {
      if (name === 'conversations') {
        return {
          select: () => selectBuilder(() => (convMaybes.length ? convMaybes.shift()!() : { data: null, error: null })),
          update: (payload: Record<string, unknown>) => {
            conversationUpdates.push(payload)
            return { eq: () => Promise.resolve({ error: config.conversationUpdateError ?? null }) }
          },
        }
      }
      if (name === 'sales_events') {
        return {
          select: () => selectBuilder(() => (salesMaybes.length ? salesMaybes.shift()!() : { data: null, error: null })),
          delete: () => ({
            eq: (col: string, val: unknown) => {
              deleteFilters.push([[col, val]])
              if (col === 'id') deleteIds.push(val)
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      if (name === 'messages' || name === 'channel_messages') {
        return { insert: () => Promise.resolve({ error: null }) }
      }
      if (name === 'customers') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: config.customersUpdateError ?? null }) }),
        }
      }
      throw new Error(`Unexpected table: ${name}`)
    },
  } as unknown as ReturnType<typeof createAdminClient>

  return { client, deleteIds, deleteFilters, conversationUpdates }
}

const wireMessage = {
  content: 'quiero cancelar mi pedido',
  externalId: 'wa-ext-1',
  customerExternalId: '52xxxx@lid',
} as unknown as WireMessage

function defaultConfig(overrides?: Partial<DbConfig>): DbConfig {
  return {
    activeSale: () => ({ data: { id: 'won-1' }, error: null }),
    lastWon: () => ({ data: { id: 'won-1' }, error: null }),
    convState: () => ({ data: { sales_cancelled_at: null, outcome: 'sold' }, error: null }),
    convHistory: () => ({ data: { outcome: 'sold', outcome_history: [] }, error: null }),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(hasDiscountAcceptanceTrigger).mockReturnValue(false)
  vi.mocked(hasCancellationTrigger).mockReturnValue(true)
  vi.mocked(resolveConnection).mockResolvedValue({
    business_id: 'biz-1',
    assistant_id: 'assistant-1',
    mode: 'active',
  })
  vi.mocked(resolveCustomer).mockResolvedValue({ id: 'cust-1' })
  vi.mocked(resolveConversation).mockResolvedValue('conv-1')
})
describe('handleCancellationWebhook — atomicidad del primer intento', () => {
  it('si emitSalesEvent falla, NO se escribe el sentinel (ni update de conversación)', async () => {
    const db = createDb(defaultConfig())
    vi.mocked(createAdminClient).mockReturnValue(db.client)
    vi.mocked(emitSalesEvent).mockRejectedValue(new Error('emit failed'))

    await expect(handleCancellationWebhook(wireMessage)).rejects.toThrow('emit failed')

    expect(emitSalesEvent).toHaveBeenCalledTimes(1)
    expect(db.conversationUpdates).toHaveLength(0)
  })

  it('si el update de conversación falla, la compensación borra SOLO el evento devuelto por id', async () => {
    const db = createDb(
      defaultConfig({ conversationUpdateError: { message: 'db write failed' } })
    )
    vi.mocked(createAdminClient).mockReturnValue(db.client)
    vi.mocked(emitSalesEvent).mockResolvedValue('evt-new-1')

    await expect(handleCancellationWebhook(wireMessage)).rejects.toThrow(
      'Failed to persist cancellation state'
    )

    // Compensación acotada por id del evento recién creado
    expect(db.deleteIds).toEqual(['evt-new-1'])
    // El delete se filtra únicamente por id (nunca por conversation_id/event_type)
    expect(db.deleteFilters).toEqual([[['id', 'evt-new-1']]])
  })

  it('el flujo normal del primer intento persiste sentinel + outcome_history y devuelve la oferta', async () => {
    const db = createDb(defaultConfig())
    vi.mocked(createAdminClient).mockReturnValue(db.client)
    vi.mocked(emitSalesEvent).mockResolvedValue('evt-new-1')

    const result = await handleCancellationWebhook(wireMessage)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_CANCELLED',
        metadata: { reason: 'discount_offered' },
      })
    )
    expect(db.conversationUpdates).toHaveLength(1)
    const update = db.conversationUpdates[0]
    expect(update.sales_cancelled_at).toBe('0001-01-01T00:00:01Z')
    expect(Array.isArray(update.outcome_history)).toBe(true)
    expect((update.outcome_history as Array<Record<string, unknown>>)[0]).toMatchObject({
      outcome: 'cancelled',
      event_type: 'SALE_CANCELLED',
      reason: 'discount_offered',
    })
    // No hay compensación en el flujo exitoso
    expect(db.deleteIds).toHaveLength(0)
    expect(result).toMatchObject({ deliver: true, conversationId: 'conv-1', customerId: 'cust-1' })
    expect(result?.response).toContain('10% de descuento')
  })
})
