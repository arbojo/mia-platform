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

  // F2 / ADR-030 — el motivo proviene del LLM (detection.reason) y es la clave de
  // partición de los índices UNIQUE parciales de la migración 060. El tag reservado
  // 'discount_offered' pertenece ÚNICAMENTE al evento de oferta (retention.ts /
  // process.ts). Si una cancelación real lo escribiera, colisionaría con el slot de
  // la oferta → 23505 → ack falso sin cancelación efectiva. Determinista: se
  // neutraliza, la variante real jamás lo transporta.
  const normalizedReason = detection.reason === 'discount_offered' ? null : detection.reason

  // F1 / ADR-030 — compensación id-scoped: el evento es el commit point. El id
  // devuelto por emitSalesEvent permite borrar SOLO el evento recién creado si una
  // escritura posterior (conversación o cliente) falla, liberando el slot de la
  // partición para que un retry idéntico re-ejecute limpio. Nunca se borra por
  // conversation_id ni eventos ajenos.
  let createdEventId: string | null = null
  // F1-b / ADR-030 — la compensación NUNCA es silenciosa: supabase-js devuelve
  // { data, error } y no lanza ante un error de DB, así que el resultado del
  // DELETE se inspecciona explícitamente. Un fallo de compensación se reporta
  // (escucha/operaciones) y el error original se re-lanza igual: el caller jamás
  // recibe un falso estado de éxito.
  const compensateCreatedEvent = async (): Promise<void> => {
    if (!createdEventId) return
    try {
      const { error } = await supabase.from('sales_events').delete().eq('id', createdEventId)
      if (error) {
        console.error(
          `Failed to compensate SALE_CANCELLED: delete returned an error`,
          { conversationId: params.conversationId, createdEventId, error: error.message }
        )
      }
    } catch (compensationError) {
      console.error(
        `Failed to compensate SALE_CANCELLED: ${compensationError instanceof Error ? compensationError.message : String(compensationError)}`,
        { conversationId: params.conversationId, createdEventId }
      )
    }
  }

  try {
    createdEventId = await emitSalesEvent({
      businessId: params.businessId,
      assistantId: params.assistantId,
      conversationId: params.conversationId,
      customerId: params.customerId,
      eventType: 'SALE_CANCELLED',
      metadata: {
        reason: normalizedReason,
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

  // RESIDUAL-R1 / Godzilla H1 — el read de conversación ocurre DESPUÉS del
  // commit del evento (emitSalesEvent) y ANTES de la compensación. Si supabase-js
  // rechaza (throw de red/transporte, no {error}), el evento creado quedaba vivo
  // (slot ocupado) y el retry caía en 23505. Misma protección que el write: ante
  // un throw se compensa id-scoped antes de re-lanzar.
  let conversation: { sales_cancelled_at: string | null; outcome: string | null; outcome_history: unknown[] } | null = null
  let conversationReadForThrow: Error | null = null
  try {
    const readResult = await supabase
      .from('conversations')
      .select('sales_cancelled_at, outcome, outcome_history')
      .eq('id', params.conversationId)
      .maybeSingle()
    conversation = readResult.data as {
      sales_cancelled_at: string | null
      outcome: string | null
      outcome_history: unknown[]
    } | null
  } catch (readError) {
    // RESIDUAL-R1: supabase-js rechazó (fallo de red/transporte)
    conversationReadForThrow = readError instanceof Error ? readError : new Error(String(readError))
    await compensateCreatedEvent()
    throw conversationReadForThrow
  }

  const history = Array.isArray(conversation?.outcome_history) ? conversation.outcome_history : []
  // Estado pre-intento: valor de sales_cancelled_at antes de este turno (null o el
  // sentinel de oferta). El revert de F1-a restaura exactamente esto.
  const previousCancelledAt = conversation?.sales_cancelled_at ?? null

  const cancelledAt = new Date().toISOString()

  // F1-a / ADR-030 — compensación de conversación id-scoped al intento actual:
  // revierte ÚNICAMENTE las columnas que ESTE intento escribió (sales_cancelled_at
  // + outcome_history) cuando el update de cliente falla tras el commit de
  // conversación. Anclado por optimisión: el guard .match({ id, sales_cancelled_at:
  // <timestamp de este intento> }) hace que el UPDATE no matchee filas si otra
  // ejecución (cancelación legítima/concurrente) ya cambió el estado → nunca pisa
  // una cancelación posterior. Un fallo del revert se reporta (no silencioso) y el
  // error original se re-lanza igual.
  const revertCancelConversationWrite = async (): Promise<void> => {
    // BUG-T3 / Godzilla H1 — si supabase-js rechaza (fallo de red/transporte,
    // no {error} sino throw), el error se captura y se reporta sin enmascarar el
    // error original del caller. Patrón idéntico a compensateCreatedEvent.
    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          sales_cancelled_at: previousCancelledAt,
          outcome_history: history,
        })
        .match({ id: params.conversationId, sales_cancelled_at: cancelledAt })
      if (error) {
        console.error(
          `Failed to revert conversation cancellation write after customer update failure`,
          { conversationId: params.conversationId, cancelledAt, error: error.message }
        )
      }
    } catch (revertError) {
      console.error(
        `Failed to revert conversation cancellation write after customer update failure: ${
          revertError instanceof Error ? revertError.message : String(revertError)
        }`,
        { conversationId: params.conversationId, cancelledAt }
      )
    }
  }

  // BUG-T2 / Godzilla H1 — si la escritura de conversación rechaza (throw, no
  // {error}), la compensación se ejecuta ANTES de re-lanzar. Patrón idéntico al
  // de conversationError (error de DB) justo abajo.
  let conversationErrorForThrow: Error | null = null
  let conversationError: { message: string } | null = null
  try {
    const result = await supabase
      .from('conversations')
      .update({
        status: 'completed',
        sales_cancelled_at: cancelledAt,
        outcome_updated_at: cancelledAt,
        outcome_history: [
          ...history,
          {
            outcome: 'cancelled',
            previous: conversation?.outcome ?? null,
            event_type: 'SALE_CANCELLED',
            reason: normalizedReason,
            at: cancelledAt,
          },
        ],
      })
      .eq('id', params.conversationId)
    conversationError = result.error
  } catch (err) {
    // BUG-T2: supabase-js rechazó (fallo de red/transporte)
    conversationErrorForThrow = err instanceof Error ? err : new Error(String(err))
    conversationError = { message: conversationErrorForThrow.message }
  }

  if (conversationError) {
    // F1 + BUG-T2: la escritura de conversación falló (DB o transporte) tras
    // crear el evento → se libera el slot con compensación id-scoped ANTES de
    // re-lanzar (retry limpio). La conversación no recibió nada de este intento:
    // no hay revert que hacer.
    await compensateCreatedEvent()
    if (conversationErrorForThrow) throw conversationErrorForThrow
    throw new Error(`Failed to persist cancellation state: ${conversationError.message}`)
  }

  if (params.customerId) {
    const lastCancelledOrder: LastCancelledOrder = {
      order_id: lastWonEvent.id,
      product_id: lastWonEvent.product_id ?? null,
      product_name: (lastWonEvent.metadata as Record<string, unknown>)?.product_name as string | null ?? null,
      cancelled_at: new Date().toISOString(),
      reason: normalizedReason,
      event_id: lastWonEvent.id,
    }

    // BUG-T1 / Godzilla H1 — si el update de cliente rechaza (throw, no {error}),
    // la compensación Y el revert se ejecutan ANTES de re-lanzar. Patrón idéntico
    // al de customerError (error de DB) justo abajo.
    let customerErrorForThrow: Error | null = null
    let customerError: { message: string } | null = null
    try {
      const result = await supabase
        .from('customers')
        .update({
          status: 'lost',
          last_cancelled_order: lastCancelledOrder as unknown as Record<string, unknown>,
        })
        .eq('id', params.customerId)
      customerError = result.error
    } catch (err) {
      // BUG-T1: supabase-js rechazó (fallo de red/transporte)
      customerErrorForThrow = err instanceof Error ? err : new Error(String(err))
      customerError = { message: customerErrorForThrow.message }
    }
    if (customerError) {
      // F1-a + BUG-T1: el update de cliente falló (DB o transporte) tras el commit
      // de conversación → se borra el evento propio Y se revierte (condicionalmente,
      // por guard de optimismo) la escritura de conversación de ESTE intento, para
      // que el retry idéntico re-ejecute limpio y converja al resultado de una
      // ejecución única.
      await compensateCreatedEvent()
      await revertCancelConversationWrite()
      if (customerErrorForThrow) throw customerErrorForThrow
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
    message: `${customerName} canceló el pedido ${orderNumber}${normalizedReason ? `. Motivo: ${normalizedReason}` : ''}.`,
    source: 'sales-cancellation',
    status: 'pending',
    action_available: 'open_conversation',
    action_payload: {
      conversation_id: params.conversationId,
      order_number: orderNumber,
      reason: normalizedReason,
    },
  })

  return {
    processed: true,
    action: 'confirmed',
    message: cancellationMessage,
    orderNumber,
  }
}
