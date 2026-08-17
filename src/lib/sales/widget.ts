import {
  applyConversationOutcome,
  emitSaleConfirmed,
  emitSalesEvent,
  fetchOrderNumber,
  hasClosingEvent,
  notifySaleToOwner,
} from './events'
import { getSalesConfig } from '@/lib/ai/knowledge'

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
  confirmationMessage?: string
  orderNumber?: string
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

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  const { data: saleEventRecord } = await supabase
    .from('sales_events')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('event_type', 'SALE_WON')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!saleEventRecord) return { recorded: true }

  const orderNumber = await fetchOrderNumber(saleEventRecord.id)
  const config = await getSalesConfig(businessId)

  const productList = params.productName ?? 'N/A'
  const totalAmount = params.amount ?? 0
  const formattedTotal = totalAmount > 0 ? `$${totalAmount.toLocaleString('es-AR')}` : 'N/A'

  const confirmationMessage = config.confirmation_message
    .replace(/\{order_id\}/g, orderNumber)
    .replace(/\{customer_name\}/g, params.customerName ?? 'Cliente')
    .replace(/\{productos\}/g, productList)
    .replace(/\{total\}/g, formattedTotal)

  await emitSaleConfirmed({
    businessId,
    assistantId,
    conversationId,
    customerId: customerId ?? undefined,
    saleEventId: saleEventRecord.id,
    orderNumber,
    confirmationMessage,
  })

  return {
    recorded: true,
    confirmationMessage,
    orderNumber,
  }
}
