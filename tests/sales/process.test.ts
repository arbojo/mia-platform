import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/client', () => ({ getOpenAIClient: vi.fn(), MODEL: 'gpt-4o-mini' }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))
vi.mock('@/lib/sales/detect', () => ({
  hasSalesTrigger: vi.fn(),
  detectSaleOutcome: vi.fn(),
  hasDiscountAcceptanceTrigger: vi.fn(),
  hasCancellationTrigger: vi.fn(),
  hasShortAffirmative: vi.fn(),
  hasPendingConfirmationRequest: vi.fn(),
  isExplicitNewPurchaseIntent: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/runtime/context-scope', () => ({ detectExplicitScopes: vi.fn() }))
vi.mock('@/lib/sales/cancel', () => ({
  processCancellation: vi.fn(),
}))
vi.mock('@/lib/sales/events', () => ({
  applyConversationOutcome: vi.fn(),
  emitDeliveryIssueSignal: vi.fn(),
  emitSalesEvent: vi.fn(),
  getCustomerData: vi.fn(),
  getCustomerName: vi.fn(),
  getSaleCycleState: vi.fn(),
  hasCancellationLock: vi.fn(),
  notifySaleToOwner: vi.fn(),
}))

import { processSaleClosing, isDiscountOfferSentinel, DISCOUNT_OFFERED_SENTINEL } from '@/lib/sales/process'
import {
  hasSalesTrigger,
  hasShortAffirmative,
  hasPendingConfirmationRequest,
  detectSaleOutcome,
  isExplicitNewPurchaseIntent,
  hasCancellationTrigger,
} from '@/lib/sales/detect'
import { processCancellation } from '@/lib/sales/cancel'
import {
  applyConversationOutcome,
  emitDeliveryIssueSignal,
  emitSalesEvent,
  getCustomerData,
  getCustomerName,
  getSaleCycleState,
  hasCancellationLock,
  notifySaleToOwner,
} from '@/lib/sales/events'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectExplicitScopes } from '@/lib/runtime/context-scope'

const params = {
  businessId: 'biz-1',
  assistantId: 'assistant-1',
  conversationId: 'conv-1',
  customerId: 'cust-1',
  messages: [
    { role: 'user', content: 'hola' },
    { role: 'assistant', content: 'hola, ¿en qué te ayudo?' },
    { role: 'user', content: 'sí, confirmo el pedido' },
  ],
}

const maybeSingle = vi.fn()
const mockSingle = vi.fn<() => Promise<{ data: null | Record<string, unknown> }>>(async () => ({ data: null }))
const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
vi.mocked(createAdminClient).mockReturnValue({
  from: vi.fn(() => ({
    update: mockUpdate,
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        // Gate §0.5: select('sales_cancelled_at').eq('id').maybeSingle()
        maybeSingle,
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ maybeSingle })),
          })),
          single: mockSingle,
          ilike: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle })) })),
        })),
      })),
    })),
  })),
} as unknown as ReturnType<typeof createAdminClient>)

beforeEach(() => {
  vi.mocked(hasSalesTrigger).mockReset()
  vi.mocked(hasCancellationTrigger).mockReset()
  vi.mocked(processCancellation).mockReset()
  vi.mocked(detectSaleOutcome).mockReset()
  vi.mocked(isExplicitNewPurchaseIntent).mockReset()
  vi.mocked(applyConversationOutcome).mockReset()
  vi.mocked(emitSalesEvent).mockReset()
  vi.mocked(emitDeliveryIssueSignal).mockReset()
  vi.mocked(getCustomerData).mockReset()
  vi.mocked(getCustomerName).mockReset()
  vi.mocked(hasCancellationLock).mockReset()
  vi.mocked(notifySaleToOwner).mockReset()
  vi.mocked(getSaleCycleState).mockReset()
  vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })
  vi.mocked(isExplicitNewPurchaseIntent).mockReturnValue('ambiguous')
  mockUpdate.mockClear()
  maybeSingle.mockResolvedValue({ data: null })
  mockSingle.mockReset()
  mockSingle.mockResolvedValue({ data: null })
  vi.mocked(detectExplicitScopes).mockReset()
  vi.mocked(detectExplicitScopes).mockResolvedValue([])
})

describe('processSaleClosing', () => {
  it('does nothing when no sales trigger is present', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(false)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    await processSaleClosing(params)
    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('does nothing when detection returns nothing', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({ outcome: null, events: [] })
    await processSaleClosing(params)
    expect(emitSalesEvent).not.toHaveBeenCalled()
    expect(applyConversationOutcome).not.toHaveBeenCalled()
  })

  it('emits events and applies outcome for a confirmed sale', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Combo 1', amount: 120 }],
      customerName: 'Juan',
      address: 'Av. Siempre Viva 123',
    })
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })
    vi.mocked(getCustomerData).mockResolvedValue(null)
    vi.mocked(getCustomerName).mockResolvedValue('Juan')

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      eventType: 'SALE_WON',
      productName: 'Combo 1',
      amount: null,
      metadata: {
        customer: {
          name: 'Juan',
          phone: null,
          city: null,
          address: 'Av. Siempre Viva 123',
        },
      },
    })
    expect(applyConversationOutcome).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      outcome: 'sold',
      dealValue: null,
      customerId: 'cust-1',
      eventType: 'SALE_WON',
    })
    expect(notifySaleToOwner).toHaveBeenCalledWith({
      businessId: 'biz-1',
      customerName: 'Juan',
      amount: null,
      productName: 'Combo 1',
      products: undefined,
      phone: null,
      city: null,
      address: 'Av. Siempre Viva 123',
      outcome: 'won',
      conversationId: 'conv-1',
    })
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('conversación cerrada SIN ciclo nuevo + followup → bloqueo anti-loop (sin LLM)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', amount: null }],
    })
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: true, hasOpenCycle: false })
    vi.mocked(isExplicitNewPurchaseIntent).mockReturnValue('followup')

    await processSaleClosing(params)

    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
    expect(applyConversationOutcome).not.toHaveBeenCalled()
    expect(notifySaleToOwner).not.toHaveBeenCalled()
  })

  it('queja de entrega en conversación cerrada → señal mia_signals, sin ciclo nuevo', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: true, hasOpenCycle: false })
    vi.mocked(isExplicitNewPurchaseIntent).mockReturnValue('delivery_issue')

    await processSaleClosing(params)

    expect(emitDeliveryIssueSignal).toHaveBeenCalledWith({
      businessId: 'biz-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      complaint: 'sí, confirmo el pedido',
    })
    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('recompra EXPLÍCITA tras cierre sin ciclo abierto → abre nuevo ciclo y emite venta', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [
        { type: 'SALE_STARTED', productName: 'Clean Nails' },
        { type: 'SALE_WON', productName: 'Clean Nails', amount: 599 },
      ],
      customerName: 'David',
      address: 'Clemente Aguirre 301',
    })
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: true, hasOpenCycle: false })
    vi.mocked(isExplicitNewPurchaseIntent).mockReturnValue('explicit')
    vi.mocked(getCustomerData).mockResolvedValue(null)
    vi.mocked(getCustomerName).mockResolvedValue('David')

    await processSaleClosing(params)

    expect(hasSalesTrigger).toHaveBeenCalled()
    expect(detectSaleOutcome).toHaveBeenCalled()
    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SALE_WON', productName: 'Clean Nails', amount: null })
    )
    expect(applyConversationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'sold' })
    )
  })

  it('intención AMBIGUA tras cierre sin evidencia de flujo nuevo (sin SALE_STARTED) → descarta SALE_WON (RC5c)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Clean Nails', amount: 599 }],
    })
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: true, hasOpenCycle: false })
    vi.mocked(isExplicitNewPurchaseIntent).mockReturnValue('ambiguous')

    await processSaleClosing(params)

    expect(detectSaleOutcome).toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
    expect(applyConversationOutcome).not.toHaveBeenCalled()
    expect(notifySaleToOwner).not.toHaveBeenCalled()
  })

  it('cambio de producto activo (ambiguo por producto distinto) → requiere flujo nuevo para cerrar', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [
        { type: 'PRODUCT_SELECTED', productName: 'Neurotin', amount: 449 },
        { type: 'SALE_WON', productName: 'Neurotin', amount: 449 },
      ],
    })
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: true, hasOpenCycle: false })
    vi.mocked(isExplicitNewPurchaseIntent).mockReturnValue('ambiguous')
    vi.mocked(getCustomerData).mockResolvedValue(null)
    vi.mocked(getCustomerName).mockResolvedValue('David')

    await processSaleClosing(params)

    // Evidencia de flujo nuevo (PRODUCT_SELECTED) presente → cierre permitido
    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SALE_WON', productName: 'Neurotin' })
    )
    expect(applyConversationOutcome).toHaveBeenCalled()
  })

  it('updates customer address when provided', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON' }],
      address: 'Calle 1',
    })
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })
    vi.mocked(getCustomerData).mockResolvedValue(null)
    vi.mocked(getCustomerName).mockResolvedValue(null)

    await processSaleClosing(params)

    expect(mockUpdate).toHaveBeenCalledWith({ address: 'Calle 1' })
  })

  it('emits FOLLOWUP_REQUIRED when sale confirmed without address', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Combo 1', amount: 120 }],
      customerName: 'Ana',
      phone: '5491100000000',
    })
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })
    vi.mocked(getCustomerData).mockResolvedValue(null)

    await processSaleClosing(params)

    expect(notifySaleToOwner).toHaveBeenCalledWith({
      businessId: 'biz-1',
      customerName: 'Ana',
      amount: null,
      productName: 'Combo 1',
      products: undefined,
      phone: '5491100000000',
      city: null,
      address: null,
      outcome: 'won',
      conversationId: 'conv-1',
    })
    expect(emitSalesEvent).toHaveBeenCalledWith({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      eventType: 'FOLLOWUP_REQUIRED',
      productName: 'Combo 1',
      metadata: { reason: 'missing_address' },
    })
  })

  it('nunca aplica outcome cancelled detectado por IA (guard STEP 3)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'cancelled',
      events: [],
    })
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })

    await processSaleClosing(params)

    expect(applyConversationOutcome).not.toHaveBeenCalled()
  })

  it('persiste customerName, phone, city y address al cierre (casos E/F)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON' }],
      customerName: 'Juan Pérez',
      phone: '+521234567890',
      city: 'CDMX',
      address: 'Av. Siempre Viva 123',
    })
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })
    vi.mocked(getCustomerData).mockResolvedValue(null)
    vi.mocked(getCustomerName).mockResolvedValue(null)

    await processSaleClosing(params)

    expect(mockUpdate).toHaveBeenCalledWith({
      name: 'Juan Pérez',
      phone: '+521234567890',
      city: 'CDMX',
      address: 'Av. Siempre Viva 123',
    })
  })

  it('no sobrescribe el nombre existente del customer al cierre (caso C en cierre)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON' }],
      customerName: 'Nombre Nuevo',
      address: 'Calle 1',
    })
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })
    vi.mocked(getCustomerData).mockResolvedValue({ name: 'Nombre Existente', phone: null, city: null, address: null })

    await processSaleClosing(params)

    expect(mockUpdate).toHaveBeenCalledWith({ address: 'Calle 1' })
  })

  it('propaga el error cuando falla la escritura de datos del customer al cierre (caso H)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON' }],
      address: 'Calle 1',
    })
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })
    vi.mocked(getCustomerData).mockResolvedValue(null)
    mockUpdate.mockImplementationOnce(() => ({
      eq: vi.fn().mockResolvedValue({ error: { message: 'db write failed' } }),
    }))

    await expect(processSaleClosing(params)).rejects.toThrow(
      'Failed to persist customer data at sale closing'
    )
  })
})

describe('isDiscountOfferSentinel', () => {
  it('reconoce la forma canónica del sentinel (Z)', () => {
    expect(isDiscountOfferSentinel('0001-01-01T00:00:01Z')).toBe(true)
  })

  it('reconoce la forma serializada por PostgreSQL (+00:00)', () => {
    expect(isDiscountOfferSentinel('0001-01-01T00:00:01+00:00')).toBe(true)
  })

  it('ambas formas del sentinel son equivalentes (mismo epoch)', () => {
    expect(Date.parse('0001-01-01T00:00:01Z')).toBe(
      Date.parse('0001-01-01T00:00:01+00:00')
    )
    expect(isDiscountOfferSentinel(DISCOUNT_OFFERED_SENTINEL)).toBe(true)
  })

  it('retorna false para null', () => {
    expect(isDiscountOfferSentinel(null)).toBe(false)
  })

  it('retorna false para undefined', () => {
    expect(isDiscountOfferSentinel(undefined)).toBe(false)
  })

  it('retorna false para string vacía', () => {
    expect(isDiscountOfferSentinel('')).toBe(false)
  })

  it('retorna false para un timestamp real de cancelación', () => {
    expect(isDiscountOfferSentinel('2026-08-29T12:00:00+00:00')).toBe(false)
    expect(isDiscountOfferSentinel('2026-08-29T12:00:00Z')).toBe(false)
  })

  it('retorna false para una string inválida', () => {
    expect(isDiscountOfferSentinel('not-a-timestamp')).toBe(false)
  })
})

// === Gate contextual de afirmativas cortas (TASK-20260830-005512058) ===
// Una afirmativa corta SOLO dispara la detección cuando existe un ciclo de venta
// abierto (SALE_STARTED/PRODUCT_SELECTED posterior al último cierre, o sin cierre).

describe('processSaleClosing — gate contextual de afirmativas cortas', () => {
  const affirmativeParams = {
    ...params,
    messages: [
      { role: 'user', content: 'quiero comprar Clean Nails' },
      { role: 'assistant', content: 'Perfecto, ¿te confirmo tu pedido de Clean Nails?' },
      { role: 'user', content: 'claro!' },
    ],
  }

  function setupHappyPath() {
    vi.mocked(hasSalesTrigger).mockReturnValue(false)
    vi.mocked(hasShortAffirmative).mockReturnValue(true)
    vi.mocked(hasPendingConfirmationRequest).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Clean Nails', amount: 599 }],
      customerName: 'David',
    })
    vi.mocked(getCustomerData).mockResolvedValue(null)
    vi.mocked(getCustomerName).mockResolvedValue('David')
  }

  it('afirmativa corta con confirmación pendiente y ciclo abierto → corre detección y emite SALE_WON', async () => {
    setupHappyPath()

    await processSaleClosing(affirmativeParams)

    expect(detectSaleOutcome).toHaveBeenCalled()
    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SALE_WON', productName: 'Clean Nails' })
    )
    expect(applyConversationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'sold' })
    )
  })

  it('afirmativa corta SIN confirmación pendiente del asistente → NO corre detección', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(false)
    vi.mocked(hasShortAffirmative).mockReturnValue(true)
    vi.mocked(hasPendingConfirmationRequest).mockReturnValue(false)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })

    await processSaleClosing(affirmativeParams)

    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('afirmativa corta en conversación cerrada SIN ciclo nuevo → NO corre detección (RC5c)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(false)
    vi.mocked(hasShortAffirmative).mockReturnValue(true)
    vi.mocked(hasPendingConfirmationRequest).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: true, hasOpenCycle: false })

    await processSaleClosing(affirmativeParams)

    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('afirmativa corta sin SALE_STARTED previo (sin ciclo abierto) → NO corre detección', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(false)
    vi.mocked(hasShortAffirmative).mockReturnValue(true)
    vi.mocked(hasPendingConfirmationRequest).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: false })

    await processSaleClosing(affirmativeParams)

    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('afirmativa corta en conversación cancelada (cancellation lock) → NO corre detección', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(false)
    vi.mocked(hasShortAffirmative).mockReturnValue(true)
    vi.mocked(hasPendingConfirmationRequest).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(true)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })

    await processSaleClosing(affirmativeParams)

    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('mensaje sin trigger ni afirmativa (negativa "no") → NO corre detección', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(false)
    vi.mocked(hasShortAffirmative).mockReturnValue(false)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(getSaleCycleState).mockResolvedValue({ hasClosed: false, hasOpenCycle: true })

    await processSaleClosing(affirmativeParams)

    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })
})

// === STEP 0.5: Cancellation Intention Gate (bloqueo estructural del turno) ===
// El mensaje ACTUAL del cliente expresa intención de cancelar → el turno NUNCA
// procede a detección de venta, SIN exigir un SALE_WON previo. Reproduce la
// causa raíz de ORD-000012: una cancelación que llega ANTES de que exista la
// venta ya no puede terminar en SALE_WON espurio + orden de delivery.

describe('processSaleClosing — Cancellation Intention Gate (STEP 0.5)', () => {
  const cancelMessages = {
    ...params,
    messages: [
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'hola, ¿en qué te ayudo?' },
      { role: 'user', content: 'sí, quiero confirmar el pedido' },
      { role: 'assistant', content: '¿Te confirmo tu pedido del Combo 1?' },
      { role: 'user', content: 'cancelo la compra' },
    ],
  }

  it('bloquea el cierre del turno cuando el mensaje actual cancela, SIN SALE_WON previo [ORD-000012]', async () => {
    vi.mocked(hasCancellationTrigger).mockReturnValue(true)
    vi.mocked(processCancellation).mockResolvedValue({
      processed: true,
      action: 'denied',
      message: 'No se encontró una venta reciente para cancelar.',
    })
    maybeSingle.mockResolvedValue({ data: null })

    await processSaleClosing(cancelMessages)

    // El gate corta ANTES de STEP 2: aunque el historial parezca venta ("compra"),
    // el turno actual es una cancelación → el detector jamás corre.
    expect(hasSalesTrigger).not.toHaveBeenCalled()
    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
    expect(applyConversationOutcome).not.toHaveBeenCalled()
    expect(processCancellation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        lastUserMessage: 'cancelo la compra',
      })
    )
  })

  it('el gate NO consulta ni exige un SALE_WON previo (bloqueo incondicional)', async () => {
    vi.mocked(hasCancellationTrigger).mockReturnValue(true)
    vi.mocked(processCancellation).mockResolvedValue({
      processed: true,
      action: 'confirmed',
      message: 'Tu pedido fue cancelado.',
    })
    maybeSingle.mockResolvedValue({ data: null })

    await processSaleClosing(params)

    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('conversación ya cancelada (fully cancelled) → retorna sin reprocesar', async () => {
    vi.mocked(hasCancellationTrigger).mockReturnValue(true)
    maybeSingle.mockResolvedValue({
      data: { sales_cancelled_at: '2026-09-01T10:00:00.000Z' },
    })

    await processSaleClosing(params)

    expect(processCancellation).not.toHaveBeenCalled()
    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })
})

describe('SALE_WON snapshot comercial (ORD-000013 product_id/amount perdidos)', () => {
  it('resuelve producto por nombre LLM (hit único) → snapshot items + amount + deal', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      eventType: 'SALE_WON',
      productName: 'Tiras Bella Patch',
      productId: undefined,
      amount: 499,
      metadata: {
        customer: { name: null, phone: null, city: null, address: null },
        items: [{ product_id: 'prod-9901', name: 'Bella Patch', unit_price: 499, quantity: 1 }],
        totals: { subtotal: 499, discount: 0, total: 499 },
      },
    })
    expect(applyConversationOutcome).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      outcome: 'sold',
      dealValue: 499,
      customerId: 'cust-1',
      eventType: 'SALE_WON',
    })
  })

  it('match ambiguo o sin-match → NO fabrica snapshot ni amount (C4)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'N/A' }],
    })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      eventType: 'SALE_WON',
      productName: 'N/A',
      productId: undefined,
      amount: null,
      metadata: { customer: { name: null, phone: null, city: null, address: null } },
    })
    expect(applyConversationOutcome).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      outcome: 'sold',
      dealValue: null,
      customerId: 'cust-1',
      eventType: 'SALE_WON',
    })
  })

  it('canonicalProductId presente → lo usa (C4) sin consultar el matcher LLM', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
    })
    mockSingle.mockResolvedValue({ data: { id: 'prod-canon', name: 'Bella Patch', price: 499 } })

    await processSaleClosing({ ...params, canonicalProductId: 'prod-canon' })

    expect(detectExplicitScopes).not.toHaveBeenCalled()
    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        productId: 'prod-canon',
        amount: 499,
        metadata: expect.objectContaining({
          items: [{ product_id: 'prod-canon', name: 'Bella Patch', unit_price: 499, quantity: 1 }],
          totals: { subtotal: 499, discount: 0, total: 499 },
        }),
      })
    )
    expect(applyConversationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ dealValue: 499 })
    )
  })

  it('catálogo gana sobre amount LLM (decisión A: total determinista)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch', amount: 550 }],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: 499,
        metadata: expect.objectContaining({
          items: [{ product_id: 'prod-9901', name: 'Bella Patch', unit_price: 499, quantity: 1 }],
          totals: { subtotal: 499, discount: 0, total: 499 },
        }),
      })
    )
    expect(applyConversationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ dealValue: 499 })
    )
  })

  it('eventos no-SALE_WON no generan snapshot propio', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [
        { type: 'SALE_STARTED', productName: 'Combo 1' },
        { type: 'SALE_WON', productName: 'Combo 1', amount: 120 },
      ],
    })
    vi.mocked(getCustomerData).mockResolvedValue(null)
    vi.mocked(getCustomerName).mockResolvedValue('Juan')

    await processSaleClosing(params)

    expect(detectExplicitScopes).toHaveBeenCalledTimes(1)
    expect(emitSalesEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ eventType: 'SALE_STARTED' })
    )
    expect(emitSalesEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ eventType: 'SALE_WON' })
    )
  })

  it('FASE1: cantidad explícita del LLM → subtotal = unit_price × quantity', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [
        {
          type: 'SALE_WON',
          productName: 'Tiras Bella Patch',
          amount: 550,
          quantity: 3,
        },
        {
          type: 'SALE_WON',
          productName: 'Bella Patch',
        },
      ],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })

    await processSaleClosing(params)

    const won = vi.mocked(emitSalesEvent).mock.calls.find(
      ([args]) => args.eventType === 'SALE_WON' && args.productName === 'Tiras Bella Patch'
    )?.[0]
    expect((won?.metadata as { totals?: { subtotal?: number; discount?: number; total?: number } }).totals).toEqual(
      { subtotal: 1497, discount: 0, total: 1497 }
    )
    expect(won?.amount).toBe(1497)
    expect((won?.metadata as { items?: Array<{ quantity?: number }> }).items?.[0]?.quantity).toBe(3)
  })

  it('FASE1: sin cantidad explícita → default contractual 1', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch', amount: 550 }],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })

    await processSaleClosing(params)

    const won = vi.mocked(emitSalesEvent).mock.calls.find(
      ([args]) => args.eventType === 'SALE_WON'
    )?.[0]
    expect((won?.metadata as { items?: Array<{ quantity?: number }> }).items?.[0]?.quantity).toBe(1)
    expect((won?.metadata as { totals?: { subtotal?: number; total?: number } }).totals).toEqual(
      { subtotal: 499, discount: 0, total: 499 }
    )
  })

  it('FASE1: producto sin precio verificable → amount null, sin inventar precio', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch', amount: 550 }],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: null } })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: null,
      })
    )
    expect(applyConversationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ dealValue: null })
    )
  })

  it('FASE1: segundo SALE_WON (dedupe) no contamina el deal del primero', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [
        { type: 'SALE_WON', productName: 'Tiras Bella Patch', amount: 550 },
        { type: 'SALE_WON', productName: 'N/A' },
      ],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })

    await processSaleClosing(params)

    expect(applyConversationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'sold', dealValue: 499 })
    )
  })

  it('FASE2: pedido multi-producto → un item por cada products[] resuelto + totals sumados', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
      products: [
        { name: 'Tiras Bella Patch', quantity: 1 },
        { name: 'Crema Reafirmante', quantity: 2 },
      ],
    })
    vi.mocked(detectExplicitScopes).mockImplementation((_supabase, _businessId, name) => {
      if (name === 'Tiras Bella Patch') {
        return Promise.resolve([{ productId: 'prod-9901', source: 'literal', tier: 'literal' }])
      }
      if (name === 'Crema Reafirmante') {
        return Promise.resolve([{ productId: 'prod-9902', source: 'literal', tier: 'literal' }])
      }
      return Promise.resolve([])
    })
    mockSingle
      .mockResolvedValueOnce({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })
      .mockResolvedValueOnce({ data: { id: 'prod-9902', name: 'Crema Reafirmante', price: 299 } })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: 1097,
        metadata: expect.objectContaining({
          items: [
            { product_id: 'prod-9901', name: 'Bella Patch', unit_price: 499, quantity: 1 },
            { product_id: 'prod-9902', name: 'Crema Reafirmante', unit_price: 299, quantity: 2 },
          ],
          totals: { subtotal: 1097, discount: 0, total: 1097 },
        }),
      })
    )
    expect(applyConversationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ dealValue: 1097 })
    )
  })

  it('FASE2: item multi-producto sin resolver → se omite, totals sobre los resueltos', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
      products: [
        { name: 'Tiras Bella Patch', quantity: 1 },
        { name: 'Producto Inventado', quantity: 1 },
      ],
    })
    vi.mocked(detectExplicitScopes).mockImplementation((_supabase, _businessId, name) =>
      name === 'Tiras Bella Patch'
        ? Promise.resolve([{ productId: 'prod-9901', source: 'literal', tier: 'literal' }])
        : Promise.resolve([])
    )
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: 499,
        metadata: expect.objectContaining({
          items: [{ product_id: 'prod-9901', name: 'Bella Patch', unit_price: 499, quantity: 1 }],
          totals: { subtotal: 499, discount: 0, total: 499 },
        }),
      })
    )
  })

  it('FASE2: item sin precio → se incluye en items, no contribuye al total si hay otro con precio', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
      products: [
        { name: 'Tiras Bella Patch', quantity: 1 },
        { name: 'Servicio Sin Precio', quantity: 1 },
      ],
    })
    vi.mocked(detectExplicitScopes).mockImplementation((_supabase, _businessId, name) => {
      if (name === 'Tiras Bella Patch') {
        return Promise.resolve([{ productId: 'prod-9901', source: 'literal', tier: 'literal' }])
      }
      if (name === 'Servicio Sin Precio') {
        return Promise.resolve([{ productId: 'prod-svc', source: 'literal', tier: 'literal' }])
      }
      return Promise.resolve([])
    })
    mockSingle
      .mockResolvedValueOnce({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })
      .mockResolvedValueOnce({ data: { id: 'prod-svc', name: 'Servicio Sin Precio', price: null } })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: 499,
        metadata: expect.objectContaining({
          items: [
            { product_id: 'prod-9901', name: 'Bella Patch', unit_price: 499, quantity: 1 },
            { product_id: 'prod-svc', name: 'Servicio Sin Precio', unit_price: null, quantity: 1 },
          ],
          totals: { subtotal: 499, discount: 0, total: 499 },
        }),
      })
    )
  })

  it('FASE3: SALE_WON tras descuento aceptado → discount real y total descontado', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })
    // First maybeSingle call = resolveAcceptedDiscount (conversations.outcome_history)
    // Subsequent maybeSingle calls (STEP 4 sales_events) fall back to beforeEach default {data:null}
    maybeSingle.mockResolvedValueOnce({
      data: {
        outcome_history: [
          { outcome: 'discount_accepted', event_type: 'DISCOUNT_ACCEPTED', discount_percent: 10 },
        ],
      },
    })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: 449.1,
        metadata: expect.objectContaining({
          totals: { subtotal: 499, discount: 49.9, total: 449.1 },
          discount: { percent: 10 },
        }),
      })
    )
    expect(applyConversationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ dealValue: 449.1 })
    )
  })

  it('FASE3: sin marca DISCOUNT_ACCEPTED → discount 0 (regresión FASE 1/2)', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })
    maybeSingle.mockResolvedValueOnce({
      data: { outcome_history: [{ outcome: 'sold', event_type: 'SALE_WON' }] },
    })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: 499,
        metadata: expect.objectContaining({
          totals: { subtotal: 499, discount: 0, total: 499 },
        }),
      })
    )
    expect(
      (vi.mocked(emitSalesEvent).mock.calls.find(([a]) => a.eventType === 'SALE_WON')?.[0].metadata as Record<string, unknown>).discount
    ).toBeUndefined()
  })

  it('FASE3: recompra posterior (marca ya no es la última) → sin descuento', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
    })
    vi.mocked(detectExplicitScopes).mockResolvedValue([
      { productId: 'prod-9901', source: 'literal', tier: 'literal' },
    ])
    mockSingle.mockResolvedValue({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })
    maybeSingle.mockResolvedValueOnce({
      data: {
        outcome_history: [
          { outcome: 'discount_accepted', event_type: 'DISCOUNT_ACCEPTED', discount_percent: 10 },
          { outcome: 'sold', event_type: 'SALE_WON' },
        ],
      },
    })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: 499,
        metadata: expect.objectContaining({
          totals: { subtotal: 499, discount: 0, total: 499 },
        }),
      })
    )
  })

  it('FASE3: multi-item con descuento → % sobre el subtotal sumado', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(hasCancellationLock).mockResolvedValue(false)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Tiras Bella Patch' }],
      products: [
        { name: 'Tiras Bella Patch', quantity: 1 },
        { name: 'Crema Reafirmante', quantity: 2 },
      ],
    })
    vi.mocked(detectExplicitScopes).mockImplementation((_supabase, _businessId, name) => {
      if (name === 'Tiras Bella Patch') {
        return Promise.resolve([{ productId: 'prod-9901', source: 'literal', tier: 'literal' }])
      }
      if (name === 'Crema Reafirmante') {
        return Promise.resolve([{ productId: 'prod-9902', source: 'literal', tier: 'literal' }])
      }
      return Promise.resolve([])
    })
    mockSingle
      .mockResolvedValueOnce({ data: { id: 'prod-9901', name: 'Bella Patch', price: 499 } })
      .mockResolvedValueOnce({ data: { id: 'prod-9902', name: 'Crema Reafirmante', price: 299 } })
    maybeSingle.mockResolvedValueOnce({
      data: {
        outcome_history: [
          { outcome: 'discount_accepted', event_type: 'DISCOUNT_ACCEPTED', discount_percent: 10 },
        ],
      },
    })

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SALE_WON',
        amount: 987.3,
        metadata: expect.objectContaining({
          totals: { subtotal: 1097, discount: 109.7, total: 987.3 },
          discount: { percent: 10 },
        }),
      })
    )
  })
})
