import { detectSaleOutcome, hasCancellationTrigger, hasSalesTrigger } from './detect'
import { processCancellation } from './cancel'
import {
  applyConversationOutcome,
  emitSaleConfirmed,
  emitSalesEvent,
  fetchOrderNumber,
  getCustomerData,
  getCustomerName,
  hasCancellationLock,
  hasClosingEvent,
  notifySaleToOwner,
} from './events'
import { getSalesConfig } from '@/lib/ai/knowledge'

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

  // === STEP 0: Cancellation check (before sales detection) ===
  if (hasCancellationTrigger(lastUserMessage.content)) {
    const alreadyCancelled = await hasCancellationLock(conversationId)
    if (alreadyCancelled) return

    await processCancellation({
      businessId,
      assistantId,
      conversationId,
      customerId,
      lastUserMessage: lastUserMessage.content,
      messages,
    })
    // Blindaje: cancelación tiene prioridad absoluta sobre detección de ventas
    return
  }

  // === STEP 1: Anti-loop — skip if closing event already exists ===
  const hasClosed = await hasClosingEvent(conversationId)
  if (hasClosed) return

  // === STEP 2: Sales detection (existing flow) ===
  if (!hasSalesTrigger(lastUserMessage.content)) return

  const result = await detectSaleOutcome({
    businessId,
    assistantId,
    messages,
  })

  if (!result.outcome && result.events.length === 0) return

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

  // === STEP 3: Outcome application ===
  if (result.outcome && !hasClosed) {
    await applyConversationOutcome({
      conversationId,
      outcome: result.outcome,
      dealValue: result.events.find((e) => e.amount != null)?.amount ?? null,
      customerId,
      eventType: result.events.find((e) => e.type === 'SALE_WON' || e.type === 'SALE_LOST')?.type,
    })

    if (result.outcome === 'sold' || result.outcome === 'interested' || result.outcome === 'not_interested') {
      const customerData = await getCustomerData(customerId)
      const customerName =
        result.customerName ??
        (customerData?.name ?? (await getCustomerName(customerId)))
      const deal = result.events.find((e) => e.amount != null)
      const product = result.events.find((e) => e.productName)?.productName ?? null

      const resolved = {
        phone: result.phone ?? customerData?.phone ?? null,
        city: result.city ?? customerData?.city ?? null,
        address: result.address ?? customerData?.address ?? null,
      }

      await notifySaleToOwner({
        businessId,
        customerName,
        amount: deal?.amount ?? null,
        productName: product,
        products: result.products,
        phone: resolved.phone,
        city: resolved.city,
        address: resolved.address,
        outcome:
          result.outcome === 'sold' ? 'won' : result.outcome === 'interested' ? 'interested' : 'lost',
        conversationId,
      })

      const supabase = await import('@/lib/supabase/admin').then((m) => m.createAdminClient())
      const customerUpdate: Record<string, string> = {}
      if (resolved.phone) customerUpdate.phone = resolved.phone
      if (resolved.city) customerUpdate.city = resolved.city
      if (resolved.address) customerUpdate.address = resolved.address
      if (Object.keys(customerUpdate).length > 0) {
        await supabase.from('customers').update(customerUpdate).eq('id', customerId)
      }

      // Pedido confirmado pero sin dirección: el equipo debe coordinar la entrega.
      if (result.outcome === 'sold' && !resolved.address) {
        await emitSalesEvent({
          businessId,
          assistantId,
          conversationId,
          customerId,
          eventType: 'FOLLOWUP_REQUIRED',
          productName: product,
          metadata: { reason: 'missing_address' },
        })
      }

      // === STEP 4: Post-SALE_WON confirmation ===
      if (result.outcome === 'sold') {
        const saleWonEvent = result.events.find((e) => e.type === 'SALE_WON')
        if (saleWonEvent) {
          const { data: saleEventRecord } = await supabase
            .from('sales_events')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('event_type', 'SALE_WON')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (saleEventRecord) {
            const orderNumber = await fetchOrderNumber(saleEventRecord.id)
            const config = await getSalesConfig(businessId)

            const productList = result.products
              ?.map((p) => `${p.name}${p.amount ? ` x${p.amount}` : ''}`)
              .join(', ') ?? product ?? 'N/A'

            const totalAmount = deal?.amount ?? 0
            const formattedTotal = totalAmount > 0 ? `$${totalAmount.toLocaleString('es-AR')}` : 'N/A'

            const confirmationMessage = config.confirmation_message
              .replace(/\{order_id\}/g, orderNumber)
              .replace(/\{customer_name\}/g, customerName ?? 'Cliente')
              .replace(/\{productos\}/g, productList)
              .replace(/\{total\}/g, formattedTotal)

            await emitSaleConfirmed({
              businessId,
              assistantId,
              conversationId,
              customerId,
              saleEventId: saleEventRecord.id,
              orderNumber,
              confirmationMessage,
            })
          }
        }
      }
    }
  }
}
