import { createAdminClient } from '@/lib/supabase/admin'
import {
  detectSaleOutcome,
  hasCancellationTrigger,
  hasDiscountAcceptanceTrigger,
  hasPendingConfirmationRequest,
  hasSalesTrigger,
  hasShortAffirmative,
} from './detect'
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
  isRetentionConflictError,
  notifySaleToOwner,
} from './events'
import { getSalesConfig } from '@/lib/ai/knowledge'
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
import { resolveCustomer } from '@/lib/channels/identity'
import type { WireMessage } from '@/lib/runtime/types'

/**
 * Sentinel value for sales_cancelled_at indicating a discount offer was
 * extended but the customer hasn't confirmed or declined yet.
 *
 * Exposed so the runtime can detect RETENTION_PENDING and inject the
 * anti-reconstruction guard without going through the full cancel flow.
 */
export const DISCOUNT_OFFERED_SENTINEL = '0001-01-01T00:00:01Z'

/**
 * Epoch equivalent of DISCOUNT_OFFERED_SENTINEL. PostgreSQL normalizes timestamps
 * and may return the value as '0001-01-01T00:00:01+00:00' (PostgREST serialization)
 * instead of the '...Z' form written by the app. A strict string comparison
 * (`value === DISCOUNT_OFFERED_SENTINEL`) would therefore be `false` in runtime.
 * `Date.parse` yields the exact same epoch for both representations, so value-based
 * comparison is reliable regardless of timestamp serialization.
 */
const DISCOUNT_OFFERED_SENTINEL_EPOCH = Date.parse(DISCOUNT_OFFERED_SENTINEL)

/**
 * Returns true when `value` represents the discount-offer sentinel, comparing by
 * temporal value rather than textual timestamp equality. This is the single helper
 * to use for detecting the sentinel in runtime reads.
 */
export function isDiscountOfferSentinel(value: string | null | undefined): boolean {
  if (!value) return false
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && parsed === DISCOUNT_OFFERED_SENTINEL_EPOCH
}

/**
 * Early cancellation interception for the WhatsApp webhook.
 *
 * Two-step flow:
 * 1. First cancel attempt → offer 10% discount to try to save the sale.
 *    Sets sales_cancelled_at to a sentinel value to track the offer.
 * 2. Second cancel attempt (or already cancelled) → proceed with normal
 *    cancellation processing via processCancellation().
 */
export async function handleCancellationWebhook(
  wireMessage: WireMessage
): Promise<{
  response: string
  customerId: string
  conversationId: string
  deliver: boolean
} | null> {
  // === DISCOUNT ACCEPTANCE: re-activate conversation ===
  if (hasDiscountAcceptanceTrigger(wireMessage.content)) {
    const supabase = createAdminClient()
    const connection = await resolveConnection('whatsapp', wireMessage)
    if (connection.mode === 'paused') return null

    const businessId = connection.business_id
    const assistantId = connection.assistant_id
    const customer = await resolveCustomer(businessId, wireMessage)
    const conversationId = await resolveConversation(assistantId, customer.id)
    if (!conversationId) return null

    const { data: conv } = await supabase
      .from('conversations')
      .select('sales_cancelled_at, outcome')
      .eq('id', conversationId)
      .maybeSingle()

    if (isDiscountOfferSentinel(conv?.sales_cancelled_at)) {
      // Re-activate conversation
      await supabase.from('conversations').update({
        outcome: 'interested',
        sales_cancelled_at: null,
        outcome_updated_at: new Date().toISOString(),
      }).eq('id', conversationId)

      // Remove SALE_CANCELLED event so sales pipeline can resume
      await supabase.from('sales_events')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('event_type', 'SALE_CANCELLED')

      // Return null → normal AI flow handles confirmation with discount
      return null
    }

    // No pending discount offer — fall through to normal flow
    return null
  }

  if (!hasCancellationTrigger(wireMessage.content)) return null

  const supabase = createAdminClient()
  const connection = await resolveConnection('whatsapp', wireMessage)
  if (connection.mode === 'paused') return null

  const businessId = connection.business_id
  const assistantId = connection.assistant_id
  const customer = await resolveCustomer(businessId, wireMessage)
  const conversationId = await resolveConversation(assistantId, customer.id)
  if (!conversationId) return null

  // RC6 fix: la intercepción solo procede si hay una venta activa (SALE_WON)
  // en esta conversación. Sin pedido, frases como "no gracias" o "no quiero"
  // son conversación normal y deben llegar al AI en vez de ser tragadas aquí.
  const { data: activeSale } = await supabase
    .from('sales_events')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('event_type', 'SALE_WON')
    .limit(1)
    .maybeSingle()
  if (!activeSale) return null

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

  // --- Check conversation state for two-step flow ---
  const { data: conversationState } = await supabase
    .from('conversations')
    .select('sales_cancelled_at, outcome')
    .eq('id', conversationId)
    .maybeSingle()

  const alreadyCancelled =
    conversationState?.sales_cancelled_at &&
    !isDiscountOfferSentinel(conversationState.sales_cancelled_at)

  const discountAlreadyOffered = isDiscountOfferSentinel(
    conversationState?.sales_cancelled_at
  )

  let response: string

  if (alreadyCancelled) {
    // Already fully cancelled — just acknowledge
    response = 'Tu pedido ya fue cancelado anteriormente. ¿Hay algo más en lo que te pueda ayudar?'
  } else if (!discountAlreadyOffered) {
    // === FIRST CANCEL ATTEMPT: offer 10% discount ===
    // Check if there's an active sale to save
    const { data: lastWonEvent } = await supabase
      .from('sales_events')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('event_type', 'SALE_WON')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastWonEvent) {
      // No active sale — just acknowledge
      response = 'Entiendo. ¿Hay algo más en lo que te pueda ayudar?'
    } else {
      response =
        'Entiendo tu preocupación. Para agradecerte tu interés, puedo ofrecerte un *10% de descuento* en tu pedido. ¿Te gustaría que te aplique el descuento y confirmemos tu compra?'

      // Mark conversation as cancelled immediately — the customer expressed
      // intent to cancel. The discount is a rescue attempt, not a state revert.
      const { data: convHistory } = await supabase
        .from('conversations')
        .select('outcome, outcome_history')
        .eq('id', conversationId)
        .maybeSingle()

      const history = Array.isArray(convHistory?.outcome_history) ? convHistory.outcome_history : []

      // Atomicity: emit SALE_CANCELLED FIRST, capturing its id. If it fails, it throws
      // and the sentinel is never written, so an orphan sentinel cannot occur. The id is
      // used exclusively for id-scoped compensation (never by conversation_id/event_type,
      // so a historical SALE_CANCELLED of the same conversation is never touched).
      let createdEventId: string | null = null
      let offerLostRace = false
      try {
        createdEventId = await emitSalesEvent({
          businessId,
          assistantId,
          conversationId,
          customerId: customer.id,
          eventType: 'SALE_CANCELLED',
          metadata: { reason: 'discount_offered' },
        })
      } catch (error) {
        // H1 / ADR-030: otro request concurrente ya reclamó el slot único de oferta
        // para esta conversación (23505). ACK determinista: sin segundo evento, sin
        // rescribir el sentinel (el ganador ya lo persiste) y sin LLM.
        if (!isRetentionConflictError(error)) throw error
        response =
          'Ya procesé tu solicitud de cancelación. Revisá mi mensaje anterior, por favor.'
        offerLostRace = true
      }

      if (!offerLostRace) {
        // Only after the event is confirmed, persist the sentinel + outcome history.
        const { error: discountStateError } = await supabase.from('conversations').update({
          sales_cancelled_at: DISCOUNT_OFFERED_SENTINEL,
          outcome_updated_at: new Date().toISOString(),
          outcome_history: [
            ...history,
            {
              outcome: 'cancelled',
              previous: convHistory?.outcome ?? null,
              event_type: 'SALE_CANCELLED',
              reason: 'discount_offered',
              at: new Date().toISOString(),
            },
          ],
        }).eq('id', conversationId)

        if (discountStateError) {
          // The event was already created above; the conversation write failed. Compensate
          // by deleting ONLY the exact event we created (id-scoped), then propagate the error.
          // This never removes other SALE_CANCELLED events of the conversation.
          try {
            if (createdEventId) {
              await supabase.from('sales_events')
                .delete()
                .eq('id', createdEventId)
            }
          } catch (compensationError) {
            console.error(
              `Failed to compensate SALE_CANCELLED after conversation write failure: ${
                compensationError instanceof Error ? compensationError.message : String(compensationError)
              }`,
              { conversationId, createdEventId }
            )
          }
          throw new Error(`Failed to persist cancellation state: ${discountStateError.message}`)
        }
      }
    }
  } else {
    // === SECOND CANCEL ATTEMPT: proceed with cancellation ===
    // C1 (parity): leer el tail RECIENTE (desc+limit), no los mas antiguos.
    // Sin esto, en conversaciones >20 mensajes la senal real de cancelacion
    // del usuario se pierde y el detector (slice(-8)) no la detecta.
    const messages = (
      await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20)
    ).data ?? []

    const chatMessages = messages
      .slice()
      .reverse()
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const result = await processCancellation({
      businessId,
      assistantId,
      conversationId,
      customerId: customer.id,
      lastUserMessage: wireMessage.content,
      messages: chatMessages,
    })

    // RC1 fix: nunca afirmar una cancelación que no ocurrió. Si el detector
    // no confirmó la intención (not_cancelation), el pedido sigue activo y el
    // cliente debe saberlo en lugar de recibir un falso "cancelación procesada".
    if (!result.processed || result.action === 'not_cancelation') {
      response =
        'No detecté que quisieras cancelar tu pedido. Si efectivamente quieres cancelarlo, responde "sí, quiero cancelar" y lo proceso de inmediato.'
    } else {
      response = result.message ?? 'Tu solicitud de cancelación ha sido procesada.'
    }
  }

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
  canonicalProductId?: string | null
  messages: Array<{ role: string; content: string }>
}): Promise<void> {
  const { businessId, assistantId, conversationId, customerId, canonicalProductId, messages } = params

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUserMessage) return

  // SAFETY NET: primary interception is in webhook/route.ts via
  // handleCancellationWebhook(). This check exists as belt-and-suspenders
  // in case a cancellation message reaches this path (e.g., training chat).
  if (hasCancellationTrigger(lastUserMessage.content)) {
    const supabaseClient = createAdminClient()
    const { data: convState } = await supabaseClient
      .from('conversations')
      .select('sales_cancelled_at')
      .eq('id', conversationId)
      .maybeSingle()

    const isFullyCancelled =
      convState?.sales_cancelled_at &&
      !isDiscountOfferSentinel(convState.sales_cancelled_at)
    if (isFullyCancelled) return

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

  // === STEP 1.5: Cancellation lock — blocks sale closing on cancelled conversations ===
  const isCancelled = await hasCancellationLock(conversationId)
  if (isCancelled) return

  // === STEP 2: Sales detection (existing flow) ===
  // Gate contextual de afirmativas cortas (TASK-20260830-005512058):
  // una afirmativa corta ("sí", "claro", "dale", ...) SOLO dispara la detección
  // cuando existe una venta pendiente esperando confirmación explícita.
  const affirmative = hasShortAffirmative(lastUserMessage.content)
  if (!hasSalesTrigger(lastUserMessage.content) && !affirmative) return
  if (affirmative && !hasPendingConfirmationRequest(messages)) return
  if (affirmative) {
    // Contrato: outcome === 'pending' + SALE_STARTED existente + sin cierre posterior.
    // (Sin SALE_WON/SALE_CANCELLED posterior ya está garantizado por steps 1 y 1.5.)
    const supabaseState = createAdminClient()
    const [{ data: conv }, { data: started }] = await Promise.all([
      supabaseState
        .from('conversations')
        .select('outcome')
        .eq('id', conversationId)
        .maybeSingle(),
      supabaseState
        .from('sales_events')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('event_type', 'SALE_STARTED')
        .limit(1)
        .maybeSingle(),
    ])
    if (conv?.outcome !== 'pending' || !started) return
  }

  const result = await detectSaleOutcome({
    businessId,
    assistantId,
    messages,
  })

  if (!result.outcome && result.events.length === 0) return

  for (const event of result.events) {
    const isClosing = event.type === 'SALE_WON' || event.type === 'SALE_LOST'
    if (isClosing && hasClosed) continue

    // MEDIUM-1: per-event product attribution.
    // Each event carries the product_id of ITS product, not a global one.
    // If the event has a productName, let emitSalesEvent resolve the product_id
    // from the name (single query per event). This ensures multi-product
    // conversations attribute the correct product to each event.
    // In single-product conversations, all events resolve to the same product_id.
    await emitSalesEvent({
      businessId,
      assistantId,
      conversationId,
      customerId,
      eventType: event.type,
      productName: event.productName,
      productId: event.productName ? undefined : canonicalProductId ?? undefined,
      amount: event.amount,
    })
  }

  // === STEP 3: Outcome application ===
  // 'cancelled' is never a valid conversations.outcome (CHECK, migration 025).
  // Cancellation state lives exclusively in sales_cancelled_at + SALE_CANCELLED
  // event and is handled by the interception paths above.
  if (result.outcome && result.outcome !== 'cancelled' && !hasClosed) {
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
      if (!customerData?.name?.trim() && result.customerName?.trim()) {
        customerUpdate.name = result.customerName.trim()
      }
      if (resolved.phone) customerUpdate.phone = resolved.phone
      if (resolved.city) customerUpdate.city = resolved.city
      if (resolved.address) customerUpdate.address = resolved.address
      if (Object.keys(customerUpdate).length > 0) {
        const { error: customerUpdateError } = await supabase
          .from('customers')
          .update(customerUpdate)
          .eq('id', customerId)
        if (customerUpdateError) {
          throw new Error(`Failed to persist customer data at sale closing: ${customerUpdateError.message}`)
        }
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
          productId: canonicalProductId ?? undefined,
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
