import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/knowledge', () => ({ getSalesConfig: vi.fn() }))
vi.mock('@/lib/sales/cancel', () => ({ processCancellation: vi.fn() }))
vi.mock('@/lib/sales/detect', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/sales/detect')>()
  return { ...actual }
})
vi.mock('@/lib/sales/events', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/sales/events')>()
  return { ...actual, emitSalesEvent: vi.fn(), getCustomerName: vi.fn() }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { resolveRetentionDecision } from '@/lib/sales/retention'
import { getSalesConfig } from '@/lib/ai/knowledge'
import { processCancellation } from '@/lib/sales/cancel'
import { emitSalesEvent, getCustomerName } from '@/lib/sales/events'
import { createAdminClient } from '@/lib/supabase/admin'
import { DISCOUNT_OFFERED_SENTINEL } from '@/lib/sales/process'

const mockedGetSalesConfig = vi.mocked(getSalesConfig)
const mockedProcessCancellation = vi.mocked(processCancellation)
const mockedEmitSalesEvent = vi.mocked(emitSalesEvent)
const mockedGetCustomerName = vi.mocked(getCustomerName)

const CONTEXT = {
  businessId: 'biz-1',
  assistantId: 'assistant-1',
  conversationId: 'conv-1',
  customerId: 'cust-1',
  lastUserMessage: 'quiero cancelar mi pedido',
}

function fullConfig(overrides: Record<string, unknown> = {}) {
  return {
    business_id: 'biz-1',
    confirmation_message: 'Confirmado {order_id}',
    cancellation_message: 'Tu pedido ha sido cancelado.',
    ask_address: true,
    ask_phone: true,
    allow_cancellation: true,
    cancellation_window_hours: 24,
    follow_up_hours: 48,
    timezone: 'America/Argentina/Buenos_Aires',
    retention_discount_percent: 10,
    retention_discount_message:
      'Entiendo tu preocupación, {customer_name}. Puedo ofrecerte un *{discount_percent}% de descuento* en tu pedido. ¿Confirmamos tu compra?',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

interface MakeDbOptions {
  state?: string | null
  activeSale?: boolean
  conversationUpdateError?: unknown
  recentMessages?: Array<{ role: string; content: string }>
}

function makeDb(options: MakeDbOptions = {}) {
  const { state = null, activeSale = true, conversationUpdateError = null, recentMessages = [] } = options

  const salesEventDeleteEq = vi.fn().mockResolvedValue({ error: null })
  const salesEventDelete = vi.fn(() => ({ eq: salesEventDeleteEq }))

  const conversationsStateSelectMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { sales_cancelled_at: state, outcome: 'pending' }, error: null })
  const conversationsHistorySelectMaybeSingle = vi.fn().mockResolvedValue({
    data: { outcome: 'pending', outcome_history: [] },
    error: null,
  })
  const conversationsUpdateEq = vi
    .fn()
    .mockResolvedValue({ error: conversationUpdateError })
  const conversationsUpdate = vi.fn(() => ({ eq: conversationsUpdateEq }))

  const activeSaleMaybeSingle = vi.fn().mockResolvedValue(
    activeSale ? { data: { id: 'won-1' }, error: null } : { data: null, error: null }
  )

  const messagesLimit = vi.fn().mockResolvedValue({ data: recentMessages, error: null })

  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((name: string) => {
      if (name === 'sales_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({ maybeSingle: activeSaleMaybeSingle })),
              })),
            })),
          })),
          delete: salesEventDelete,
        }
      }
      if (name === 'conversations') {
        return {
          select: vi.fn((cols: string) => ({
            eq: vi.fn(() => ({
              maybeSingle:
                cols.includes('outcome_history')
                  ? conversationsHistorySelectMaybeSingle
                  : conversationsStateSelectMaybeSingle,
            })),
          })),
          update: conversationsUpdate,
        }
      }
      if (name === 'messages') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: messagesLimit,
              })),
            })),
          })),
        }
      }
      throw new Error(`Unexpected table ${name}`)
    }),
  } as never)

  return {
    activeSaleMaybeSingle,
    conversationsStateSelectMaybeSingle,
    conversationsHistorySelectMaybeSingle,
    conversationsUpdate,
    conversationsUpdateEq,
    salesEventDelete,
    salesEventDeleteEq,
    messagesLimit,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetSalesConfig.mockResolvedValue(fullConfig() as never)
  mockedGetCustomerName.mockResolvedValue('Ana')
  mockedEmitSalesEvent.mockResolvedValue('evt-discount-1')
  mockedProcessCancellation.mockResolvedValue({
    processed: true,
    action: 'confirmed',
    message: 'Tu solicitud de cancelación ha sido procesada.',
    orderNumber: 'VTA-ABC123',
  } as never)
})

describe('retention.ts — sin rama activada', () => {
  it('mensaje sin trigger de cancelación → action none (y no toca config/DB)', async () => {
    const db = makeDb()
    const decision = await resolveRetentionDecision({
      ...CONTEXT,
      lastUserMessage: '¿en cuánto está el envío?',
    })

    expect(decision).toEqual({ action: 'none' })
    expect(mockedGetSalesConfig).not.toHaveBeenCalled()
    expect(db.activeSaleMaybeSingle).not.toHaveBeenCalled()
  })

  it('trigger de cancelación sin SALE_WON activo (RC6) → action none', async () => {
    const db = makeDb({ activeSale: false })
    const decision = await resolveRetentionDecision(CONTEXT)

    expect(decision).toEqual({ action: 'none' })
    expect(db.activeSaleMaybeSingle).toHaveBeenCalled()
    expect(mockedEmitSalesEvent).not.toHaveBeenCalled()
    expect(mockedProcessCancellation).not.toHaveBeenCalled()
  })
})

describe('retention.ts — discount_offer (primera cancelación)', () => {
  it('ofrece UNA vez y persiste sentinel + SALE_CANCELLED(discount_offered)', async () => {
    const db = makeDb()
    const decision = await resolveRetentionDecision(CONTEXT)

    expect(decision.action).toBe('discount_offer')
    expect(decision.response).toContain('10%')
    expect(decision.response).toContain('Ana')
    expect(mockedEmitSalesEvent).toHaveBeenCalledWith({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      eventType: 'SALE_CANCELLED',
      metadata: { reason: 'discount_offered' },
    })

    const sentinelUpdate = db.conversationsUpdate.mock.calls[0][0]
    expect(sentinelUpdate.sales_cancelled_at).toBe(DISCOUNT_OFFERED_SENTINEL)
    expect(sentinelUpdate.outcome_history).toHaveLength(1)
    expect(sentinelUpdate.outcome_history[0]).toMatchObject({
      outcome: 'cancelled',
      event_type: 'SALE_CANCELLED',
      reason: 'discount_offered',
    })
    // Event-first → el evento se crea antes de escribir el sentinel
    expect(mockedEmitSalesEvent.mock.invocationCallOrder[0]).toBeLessThan(
      db.conversationsUpdate.mock.invocationCallOrder[0]
    )
    expect(mockedProcessCancellation).not.toHaveBeenCalled()
  })

  it('interpola percent y nombre custom desde la config (fullConfig 15%)', async () => {
    makeDb()
    mockedGetSalesConfig.mockResolvedValue(
      fullConfig({
        retention_discount_percent: 15,
        retention_discount_message: 'Oferta de {discount_percent}% para {customer_name}',
      }) as never
    )
    const decision = await resolveRetentionDecision(CONTEXT)

    expect(decision.action).toBe('discount_offer')
    expect(decision.response).toBe('Oferta de 15% para Ana')
  })

  it('fallback name Cliente cuando no hay customerId', async () => {
    makeDb()
    const decision = await resolveRetentionDecision({ ...CONTEXT, customerId: null })

    expect(decision.action).toBe('discount_offer')
    expect(decision.response).toContain('Cliente')
    expect(mockedGetCustomerName).not.toHaveBeenCalled()
  })

  it('compensa el evento id-scoped si falla la escritura del sentinel', async () => {
    const db = makeDb({ conversationUpdateError: { message: 'boom' } })

    await expect(resolveRetentionDecision(CONTEXT)).rejects.toThrow(
      'Failed to persist cancellation state'
    )
    expect(db.salesEventDelete).toHaveBeenCalled()
    expect(db.salesEventDeleteEq).toHaveBeenCalledWith('id', 'evt-discount-1')
  })
})

describe('retention.ts — confirm_cancel (segunda cancelación, sentinel)', () => {
  it('con sentinel → processCancellation, sin re-ofertar (idempotencia)', async () => {
    const db = makeDb({
      state: DISCOUNT_OFFERED_SENTINEL,
      recentMessages: [
        { role: 'user', content: 'No, quiero cancelar' },
        { role: 'assistant', content: 'Puedo ofrecerte un *10% de descuento*.' },
      ],
    })

    const decision = await resolveRetentionDecision(CONTEXT)

    expect(decision.action).toBe('confirm_cancel')
    expect(decision.response).toBe('Tu solicitud de cancelación ha sido procesada.')
    expect(db.messagesLimit).toHaveBeenCalled()
    expect(mockedEmitSalesEvent).not.toHaveBeenCalled()
    expect(mockedProcessCancellation).toHaveBeenCalledWith({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      lastUserMessage: 'quiero cancelar mi pedido',
      messages: [
        { role: 'assistant', content: 'Puedo ofrecerte un *10% de descuento*.' },
        { role: 'user', content: 'No, quiero cancelar' },
      ],
    })
  })

  it('rechazo del descuento → no insistir (not_cancelation → mensaje canónico)', async () => {
    makeDb({ state: DISCOUNT_OFFERED_SENTINEL })
    mockedProcessCancellation.mockResolvedValue({
      processed: false,
      action: 'not_cancelation',
    } as never)

    const decision = await resolveRetentionDecision(CONTEXT)

    expect(decision.action).toBe('confirm_cancel')
    expect(decision.response).toContain('No detecté que quisieras cancelar')
  })
})

describe('retention.ts — ack (ya cancelado)', () => {
  it('sales_cancelled_at con fecha real → ack, sin tocar processCancellation', async () => {
    makeDb({ state: '2026-08-01T10:00:00.000Z' })
    const decision = await resolveRetentionDecision(CONTEXT)

    expect(decision.action).toBe('ack')
    expect(decision.response).toContain('ya fue cancelado anteriormente')
    expect(mockedProcessCancellation).not.toHaveBeenCalled()
    expect(mockedEmitSalesEvent).not.toHaveBeenCalled()
  })
})