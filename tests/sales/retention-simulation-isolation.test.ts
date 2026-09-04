import { describe, it, expect, vi, beforeEach } from 'vitest'

// LOOP 2.2 — AISLAMIENTO DE EFECTOS COMERCIALES DE RETENCIÓN EN ENTORNO SIMULADO.
// Contrato del Concilio: cuando channel === 'simulation' (cubre requestType
// 'simulation' y 'training'), el motor conserva la respuesta de retención y el
// estado conversacional (sentinel) para un flujo oferta → confirmación → ack
// coherente, pero NO emite ningún SALE_* comercial.

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
  recentMessages?: Array<{ role: string; content: string }>
}

function makeDb(options: MakeDbOptions = {}) {
  const { state = null, activeSale = true, recentMessages = [] } = options

  const salesEventDeleteEq = vi.fn().mockResolvedValue({ error: null })
  const salesEventDelete = vi.fn(() => ({ eq: salesEventDeleteEq }))

  const conversationsStateSelectMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { sales_cancelled_at: state, outcome: 'pending' }, error: null })
  const conversationsHistorySelectMaybeSingle = vi.fn().mockResolvedValue({
    data: { outcome: 'pending', outcome_history: [] },
    error: null,
  })
  const conversationsUpdateEq = vi.fn().mockResolvedValue({ error: null })
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

  return { conversationsUpdate, conversationsUpdateEq, activeSaleMaybeSingle }
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

describe('LOOP 2.2 — simulado (channel=simulation): oferta de retención sin SALE_*', () => {
  it('simulado + retención elegible → respuesta conservada + sentinel conservado + 0 SALE_*', async () => {
    const db = makeDb()
    const decision = await resolveRetentionDecision({ ...CONTEXT, simulated: true })

    expect(decision.action).toBe('discount_offer')
    expect(decision.response).toContain('10%')
    expect(decision.response).toContain('Ana')

    // Comportamiento conversacional preservado: el sentinel se escribe para
    // mantener coherente el flujo oferta → confirmación → ack.
    const sentinelUpdate = db.conversationsUpdate.mock.calls[0][0]
    expect(sentinelUpdate.sales_cancelled_at).toBe(DISCOUNT_OFFERED_SENTINEL)

    // NINGÚN efecto comercial SALE_*.
    expect(mockedEmitSalesEvent).not.toHaveBeenCalled()
    expect(mockedProcessCancellation).not.toHaveBeenCalled()
  })

  it('simulado + confirmación (sentinel previo) → confirm_cancel determinista, 0 processCancellation', async () => {
    makeDb({ state: DISCOUNT_OFFERED_SENTINEL })
    const decision = await resolveRetentionDecision({ ...CONTEXT, simulated: true })

    expect(decision.action).toBe('confirm_cancel')
    expect(decision.response).toContain('entorno de simulación')

    expect(mockedProcessCancellation).not.toHaveBeenCalled()
    expect(mockedEmitSalesEvent).not.toHaveBeenCalled()
  })

  it('simulado + ya cancelado (no sentinel) → ack, sin efectos', async () => {
    makeDb({ state: '2026-09-01T10:00:00Z' })
    const decision = await resolveRetentionDecision({ ...CONTEXT, simulated: true })

    expect(decision.action).toBe('ack')
    expect(mockedEmitSalesEvent).not.toHaveBeenCalled()
    expect(mockedProcessCancellation).not.toHaveBeenCalled()
  })
})

describe('LOOP 2.2 — producción (canales productivos): comportamiento comercial normal', () => {
  it('producción + retención elegible → SALE_CANCELLED emitido + sentinel (sin cambio)', async () => {
    const db = makeDb()
    const decision = await resolveRetentionDecision(CONTEXT)

    expect(decision.action).toBe('discount_offer')
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
  })

  it('producción + confirmación → processCancellation ejecutado (cancelación real)', async () => {
    makeDb({ state: DISCOUNT_OFFERED_SENTINEL })
    const decision = await resolveRetentionDecision(CONTEXT)

    expect(decision.action).toBe('confirm_cancel')
    expect(mockedProcessCancellation).toHaveBeenCalledTimes(1)
  })
})
