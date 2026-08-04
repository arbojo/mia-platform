import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/client', () => ({ getOpenAIClient: vi.fn(), MODEL: 'gpt-4o-mini' }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))
vi.mock('@/lib/sales/detect', () => ({
  hasSalesTrigger: vi.fn(),
  detectSaleOutcome: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/sales/events', () => ({
  applyConversationOutcome: vi.fn(),
  emitSalesEvent: vi.fn(),
  getCustomerName: vi.fn(),
  hasClosingEvent: vi.fn(),
  notifySaleToOwner: vi.fn(),
}))

import { processSaleClosing } from '@/lib/sales/process'
import { hasSalesTrigger, detectSaleOutcome } from '@/lib/sales/detect'
import {
  applyConversationOutcome,
  emitSalesEvent,
  getCustomerName,
  hasClosingEvent,
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

const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
vi.mocked(createAdminClient).mockReturnValue({
  from: vi.fn(() => ({ update: mockUpdate })),
} as unknown as ReturnType<typeof createAdminClient>)

beforeEach(() => {
  vi.mocked(hasSalesTrigger).mockReset()
  vi.mocked(detectSaleOutcome).mockReset()
  vi.mocked(applyConversationOutcome).mockReset()
  vi.mocked(emitSalesEvent).mockReset()
  vi.mocked(getCustomerName).mockReset()
  vi.mocked(hasClosingEvent).mockReset()
  vi.mocked(notifySaleToOwner).mockReset()
  mockUpdate.mockReset()
})

describe('processSaleClosing', () => {
  it('does nothing when no sales trigger is present', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(false)
    await processSaleClosing(params)
    expect(detectSaleOutcome).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('does nothing when detection returns nothing', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({ outcome: null, events: [] })
    await processSaleClosing(params)
    expect(hasClosingEvent).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
  })

  it('emits events and applies outcome for a confirmed sale', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', productName: 'Combo 1', amount: 120 }],
      customerName: 'Juan',
      address: 'Av. Siempre Viva 123',
    })
    vi.mocked(hasClosingEvent).mockResolvedValue(false)
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
      outcome: 'won',
      conversationId: 'conv-1',
    })
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('skips events when the conversation already closed', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON', amount: null }],
    })
    vi.mocked(hasClosingEvent).mockResolvedValue(true)

    await processSaleClosing(params)

    expect(emitSalesEvent).not.toHaveBeenCalled()
    expect(applyConversationOutcome).not.toHaveBeenCalled()
    expect(notifySaleToOwner).not.toHaveBeenCalled()
  })

  it('emits non-closing events even when conversation already closed', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'PRODUCT_SELECTED', productName: 'Combo 1' }],
    })
    vi.mocked(hasClosingEvent).mockResolvedValue(true)

    await processSaleClosing(params)

    expect(emitSalesEvent).toHaveBeenCalledTimes(1)
    expect(applyConversationOutcome).not.toHaveBeenCalled()
  })

  it('updates customer address when provided', async () => {
    vi.mocked(hasSalesTrigger).mockReturnValue(true)
    vi.mocked(detectSaleOutcome).mockResolvedValue({
      outcome: 'sold',
      events: [{ type: 'SALE_WON' }],
      address: 'Calle 1',
    })
    vi.mocked(hasClosingEvent).mockResolvedValue(false)
    vi.mocked(getCustomerName).mockResolvedValue(null)

    await processSaleClosing(params)

    expect(mockUpdate).toHaveBeenCalled()
  })
})
