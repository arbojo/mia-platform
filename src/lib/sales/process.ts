import { detectSaleOutcome, hasSalesTrigger } from './detect'
import {
  applyConversationOutcome,
  emitSalesEvent,
  getCustomerName,
  hasClosingEvent,
  notifySaleToOwner,
} from './events'

export async function processSaleClosing(params: {
  businessId: string
  assistantId: string
  conversationId: string
  customerId: string
  messages: Array<{ role: string; content: string }>
}): Promise<void> {
  const { businessId, assistantId, conversationId, customerId, messages } = params

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUserMessage) return

  if (!hasSalesTrigger(lastUserMessage.content)) return

  const result = await detectSaleOutcome({
    businessId,
    assistantId,
    messages,
  })

  if (!result.outcome && result.events.length === 0) return

  const hasClosed = await hasClosingEvent(conversationId)

  for (const event of result.events) {
    const isClosing = event.type === 'SALE_WON' || event.type === 'SALE_LOST'
    if (isClosing && hasClosed) continue

    await emitSalesEvent({
      businessId,
      assistantId,
      conversationId,
      customerId,
      eventType: event.type,
      productName: event.productName,
      amount: event.amount,
    })
  }

  if (result.outcome && !hasClosed) {
    await applyConversationOutcome({
      conversationId,
      outcome: result.outcome,
      dealValue: result.events.find((e) => e.amount != null)?.amount ?? null,
      customerId,
      eventType: result.events.find((e) => e.type === 'SALE_WON' || e.type === 'SALE_LOST')?.type,
    })

    if (result.outcome === 'sold' || result.outcome === 'interested' || result.outcome === 'not_interested') {
      const customerName = result.customerName ?? (await getCustomerName(customerId))
      const deal = result.events.find((e) => e.amount != null)
      const product = result.events.find((e) => e.productName)?.productName ?? null

      await notifySaleToOwner({
        businessId,
        customerName,
        amount: deal?.amount ?? null,
        productName: product,
        outcome:
          result.outcome === 'sold' ? 'won' : result.outcome === 'interested' ? 'interested' : 'lost',
        conversationId,
      })

      if (result.address) {
        const supabase = await import('@/lib/supabase/admin').then((m) => m.createAdminClient())
        await supabase.from('customers').update({ address: result.address }).eq('id', customerId)
      }
    }
  }
}
