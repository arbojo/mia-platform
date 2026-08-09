import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/sales/events', () => ({
  applyConversationOutcome: vi.fn(),
  emitSalesEvent: vi.fn(),
  hasClosingEvent: vi.fn(),
  notifySaleToOwner: vi.fn(),
}))

import { recordWidgetSale } from '@/lib/sales/widget'
import {
  applyConversationOutcome,
  emitSalesEvent,
  hasClosingEvent,
  notifySaleToOwner,
} from '@/lib/sales/events'

const params = {
  businessId: 'biz-1',
  assistantId: 'assistant-1',
  conversationId: 'conv-1',
  customerId: 'cust-1',
  customerName: 'Juan',
  productName: 'Combo 1',
  amount: 120,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recordWidgetSale', () => {
  it('registra SALE_WON y aplica outcome sold', async () => {
    vi.mocked(hasClosingEvent).mockResolvedValue(false)

    const result = await recordWidgetSale(params)

    expect(result).toEqual({ recorded: true })
    expect(hasClosingEvent).toHaveBeenCalledWith('conv-1')
    expect(emitSalesEvent).toHaveBeenCalledWith({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
      eventType: 'SALE_WON',
      productName: 'Combo 1',
      amount: 120,
      metadata: { source: 'widget', channel: 'widget' },
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
  })

  it('no registra nada sin conversationId', async () => {
    const result = await recordWidgetSale({ ...params, conversationId: null })

    expect(result).toEqual({ recorded: false, reason: 'no_conversation' })
    expect(hasClosingEvent).not.toHaveBeenCalled()
    expect(emitSalesEvent).not.toHaveBeenCalled()
    expect(applyConversationOutcome).not.toHaveBeenCalled()
    expect(notifySaleToOwner).not.toHaveBeenCalled()
  })

  it('deduplica cuando la conversacion ya tiene evento de cierre', async () => {
    vi.mocked(hasClosingEvent).mockResolvedValue(true)

    const result = await recordWidgetSale(params)

    expect(result).toEqual({ recorded: false, reason: 'already_closed' })
    expect(emitSalesEvent).not.toHaveBeenCalled()
    expect(applyConversationOutcome).not.toHaveBeenCalled()
    expect(notifySaleToOwner).not.toHaveBeenCalled()
  })

  it('permite venta sin producto ni monto', async () => {
    vi.mocked(hasClosingEvent).mockResolvedValue(false)

    const result = await recordWidgetSale({
      businessId: 'biz-1',
      assistantId: 'assistant-1',
      conversationId: 'conv-1',
      customerId: 'cust-1',
    })

    expect(result).toEqual({ recorded: true })
    const emitPayload = vi.mocked(emitSalesEvent).mock.calls[0][0]
    expect(emitPayload.productName).toBeNull()
    expect(emitPayload.amount).toBeNull()
  })
})
