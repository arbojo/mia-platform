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
} from '@/lib/sales/detect'
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
const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
vi.mocked(createAdminClient).mockReturnValue({
  from: vi.fn(() => ({
    update: mockUpdate,
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ maybeSingle })),
          })),
        })),
      })),
    })),
  })),
} as unknown as ReturnType<typeof createAdminClient>)

beforeEach(() => {
  vi.mocked(hasSalesTrigger).mockReset()
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
      amount: 120,
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
      dealValue: 120,
      customerId: 'cust-1',
      eventType: 'SALE_WON',
    })
    expect(notifySaleToOwner).toHaveBeenCalledWith({
      businessId: 'biz-1',
      customerName: 'Juan',
      amount: 120,
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
      expect.objectContaining({ eventType: 'SALE_WON', productName: 'Clean Nails', amount: 599 })
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
      amount: 120,
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
