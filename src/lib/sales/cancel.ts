import { createAdminClient } from '@/lib/supabase/admin'
import { getSalesConfig } from '@/lib/ai/knowledge'
import { purgeCancelledOrderFromMemory } from '@/lib/ai/customer-memory'
import { detectCancellation } from './detect'
import { emitSalesEvent, isRetentionConflictError } from './events'
import type { LastCancelledOrder } from '@/lib/types'

export interface ProcessCancellationParams {
  businessId: string
  assistantId: string
  conversationId: string
  customerId: string | null
  lastUserMessage: string
  messages: Array<{ role: string; content: string }>
}

export interface ProcessCancellationResult {
  processed: boolean
  action: 'confirmed' | 'escalated' | 'denied' | 'not_cancelation'
  message?: string
  orderNumber?: string
}

// H1 / ADR-030 — perdedor de la carrera por el slot único de cancelación real
// (23505): otro request concurrente ya canceló; ack determinista sin evento,
// sin mia_signals y sin updates duplicados.
const CANCELLATION_ALREADY_PROCESSED = 'Tu pedido ya fue cancelado.'

export async function processCancellation(
  params: ProcessCancellationParams
): Promise<ProcessCancellationResult> {
  const supabase = createAdminClient()
  const config = await getSalesConfig(params.businessId)

  if (!config.allow_cancellation) {
    return {
      processed: true,
      action: 'denied',
      message: config.cancellation_message,
    }
  }

  const detection = await detectCancellation({
    businessId: params.businessId,
    assistantId: params.assistantId,
    messages: params.messages,
  })

  if (!detection.confirmed) {
    return {
      processed: false,
      action: 'not_cancelation',
    }
  }

  const { data: lastWonEvent } = await supabase
    .from('sales_events')
    .select('id, created_at, amount, metadata, product_id')
    .eq('conversation_id', params.conversationId)
    .eq('event_type', 'SALE_WON')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastWonEvent) {
    return {
      processed: true,
      action: 'denied',
      message: 'No se encontró una venta reciente para cancelar.',
    }
  }

  const createdAt = new Date(lastWonEvent.created_at)
  const windowMs = config.cancellation_window_hours * 60 * 60 * 1000
  const withinWindow = Date.now() - createdAt.getTime() < windowMs

  if (!withinWindow) {
    return {
      processed: true,
      action: 'escalated',
      message: 'La ventana de cancelación ha expirado. Escalaré esto a atención humana.',
    }
  }

  let orderNumber = `VTA-${lastWonEvent.id.slice(0, 6).toUpperCase()}`
  try {
    const { data: deliveryOrder } = await supabase
      .schema('delivery')
      .from('orders')
      .select('order_number')
      .eq('sales_event_id', lastWonEvent.id)
      .single()
    if (deliveryOrder?.order_number) {
      orderNumber = deliveryOrder.order_number
    }
  } catch {
    // Delivery schema not available or no order — use fallback
  }

  const cancellationMessage = config.cancellation_message
    .replace(/\{order_id\}/g, orderNumber)
    .replace(/\{customer_name\}/g, 'Cliente')

  try {
    await emitSalesEvent({
      businessId: params.businessId,
      assistantId: params.assistantId,
      conversationId: params.conversationId,
      customerId: params.customerId,
      eventType: 'SALE_CANCELLED',
      metadata: {
        reason: detection.reason,
        original_sale_event_id: lastWonEvent.id,
        order_number: orderNumber,
        within_window: withinWindow,
      },
    })
  } catch (error) {
    // H1 / ADR-030: otro request concurrente ya emitió la cancelación real para
    // esta conversación (23505). ACK determinista: sin duplicar evento ni
    // mia_signals, sin reescribir la conversación.
    if (isRetentionConflictError(error)) {
      return { processed: true, action: 'confirmed', message: CANCELLATION_ALREADY_PROCESSED }
    }
    throw error
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('outcome, outcome_history')
    .eq('id', params.conversationId)
    .maybeSingle()

  const history = Array.isArray(conversation?.outcome_history) ? conversation.outcome_history : []

  const { error: conversationError } = await supabase
    .from('conversations')
    .update({
      status: 'completed',
      sales_cancelled_at: new Date().toISOString(),
      outcome_updated_at: new Date().toISOString(),
      outcome_history: [
        ...history,
        {
          outcome: 'cancelled',
          previous: conversation?.outcome ?? null,
          event_type: 'SALE_CANCELLED',
          reason: detection.reason,
          at: new Date().toISOString(),
        },
      ],
    })
    .eq('id', params.conversationId)

  if (conversationError) {
    throw new Error(`Failed to persist cancellation state: ${conversationError.message}`)
  }

  if (params.customerId) {
    const lastCancelledOrder: LastCancelledOrder = {
      order_id: lastWonEvent.id,
      product_id: lastWonEvent.product_id ?? null,
      product_name: (lastWonEvent.metadata as Record<string, unknown>)?.product_name as string | null ?? null,
      cancelled_at: new Date().toISOString(),
      reason: detection.reason ?? null,
      event_id: lastWonEvent.id,
    }

    const { error: customerError } = await supabase
      .from('customers')
      .update({
        status: 'lost',
        last_cancelled_order: lastCancelledOrder as unknown as Record<string, unknown>,
      })
      .eq('id', params.customerId)
    if (customerError) {
      throw new Error(`Failed to update customer status after cancellation: ${customerError.message}`)
    }

    // RC2/RC4 fix: purgar la memoria del pedido cancelado y resetear la
    // evidencia para que conversaciones futuras no re-confirman el pedido.
    // Non-blocking: una falla de purga no debe revertir la cancelación.
    try {
      await purgeCancelledOrderFromMemory(params.customerId, orderNumber)
    } catch (err) {
      console.error('Failed to purge cancelled order from memory (non-blocking):', err)
    }
  }

  const customerData = params.customerId
    ? (() => {
        const supabase2 = createAdminClient()
        return supabase2
          .from('customers')
          .select('name')
          .eq('id', params.customerId)
          .maybeSingle()
      })()
    : null

  const customerResult = await customerData
  const customerName = customerResult?.data?.name ?? 'Cliente'

  await supabase.from('mia_signals').insert({
    business_id: params.businessId,
    type: 'SALES',
    priority: 'atencion',
    title: 'Pedido cancelado',
    message: `${customerName} canceló el pedido ${orderNumber}${detection.reason ? `. Motivo: ${detection.reason}` : ''}.`,
    source: 'sales-cancellation',
    status: 'pending',
    action_available: 'open_conversation',
    action_payload: {
      conversation_id: params.conversationId,
      order_number: orderNumber,
      reason: detection.reason,
    },
  })

  return {
    processed: true,
    action: 'confirmed',
    message: cancellationMessage,
    orderNumber,
  }
}
