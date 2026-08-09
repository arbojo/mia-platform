import {
  applyConversationOutcome,
  emitSalesEvent,
  hasClosingEvent,
  notifySaleToOwner,
} from './events'

export interface RecordWidgetSaleParams {
  businessId: string
  assistantId: string
  conversationId?: string | null
  customerId?: string | null
  customerName?: string | null
  productName?: string | null
  amount?: number | null
}

export interface RecordWidgetSaleResult {
  recorded: boolean
  reason?: 'no_conversation' | 'already_closed'
}

export async function recordWidgetSale(
  params: RecordWidgetSaleParams
): Promise<RecordWidgetSaleResult> {
  const { businessId, assistantId, conversationId, customerId } = params

  if (!conversationId) {
    return { recorded: false, reason: 'no_conversation' }
  }

  if (await hasClosingEvent(conversationId)) {
    return { recorded: false, reason: 'already_closed' }
  }

  await emitSalesEvent({
    businessId,
    assistantId,
    conversationId,
    customerId: customerId ?? null,
    eventType: 'SALE_WON',
    productName: params.productName ?? null,
    amount: params.amount ?? null,
    metadata: { source: 'widget', channel: 'widget' },
  })

  await applyConversationOutcome({
    conversationId,
    outcome: 'sold',
    dealValue: params.amount ?? null,
    customerId: customerId ?? null,
    eventType: 'SALE_WON',
  })

  await notifySaleToOwner({
    businessId,
    customerName: params.customerName ?? null,
    amount: params.amount ?? null,
    productName: params.productName ?? null,
    outcome: 'won',
    conversationId,
  })

  return { recorded: true }
}
