import { createAdminClient } from '@/lib/supabase/admin'
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
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
import { resolveCustomer } from '@/lib/channels/identity'
import type { WireMessage } from '@/lib/runtime/types'

/**
 * Early cancellation interception for the WhatsApp webhook.
 *
 * When a cancellation keyword is detected, handles the entire flow
 * (resolution, persistence, cancellation processing) and returns a
 * response — bypassing executeAI() entirely. Returns null if the message
 * is NOT a cancellation, so the caller proceeds with the normal flow.
 */
export async function handleCancellationWebhook(
  wireMessage: WireMessage
): Promise<{
  response: string
  customerId: string
  conversationId: string
  deliver: boolean
} | null> {
  if (!hasCancellationTrigger(wireMessage.content)) return null

  const supabase = createAdminClient()
  const connection = await resolveConnection('whatsapp', wireMessage)
  if (connection.mode === 'paused') return null

  const businessId = connection.business_id
  const assistantId = connection.assistant_id
  const customer = await resolveCustomer(businessId, wireMessage)
  const conversationId = await resolveConversation(assistantId, customer.id)
  if (!conversationId) return null

  try {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: wireMessage.content,
    })
  } catch (err) {
    console.error('Failed to persist cancellation user message:', err)
  }

  await supabase.from('channel_messages').insert({
    business_id: businessId,
    customer_id: customer.id,
    channel: 'whatsapp',
    direction: 'incoming',
    content: wireMessage.content,
    external_id: wireMessage.externalId,
    external_customer_id: wireMessage.customerExternalId,
    status: 'received',
  })

  const chatHistory = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20)

  const messages = (chatHistory.data ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const result = await processCancellation({
    businessId,
    assistantId,
    conversationId,
    customerId: customer.id,
    lastUserMessage: wireMessage.content,
    messages,
  })

  const response = result.message ?? 'Tu solicitud de cancelación ha sido procesada.'

  try {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: response,
    })
  } catch (err) {
    console.error('Failed to persist cancellation response:', err)
  }

  await supabase.from('channel_messages').insert({
    business_id: businessId,
    customer_id: customer.id,
    channel: 'whatsapp',
    direction: 'outgoing',
    content: response,
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  await supabase
    .from('customers')
    .update({ last_interaction: new Date().toISOString() })
    .eq('id', customer.id)

  return {
    response,
    customerId: customer.id,
    conversationId,
    deliver: true,
  }
}

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

  // SAFETY NET: primary interception is in webhook/route.ts via
  // handleCancellationWebhook(). This check exists as belt-and-suspenders
  // in case a cancellation message reaches this path (e.g., training chat).
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
