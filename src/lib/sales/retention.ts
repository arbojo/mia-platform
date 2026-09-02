import { createAdminClient } from '@/lib/supabase/admin'
import { getSalesConfig } from '@/lib/ai/knowledge'
import { hasCancellationTrigger } from './detect'
import { DISCOUNT_OFFERED_SENTINEL, isDiscountOfferSentinel } from './process'
import { processCancellation } from './cancel'
import { emitSalesEvent, getCustomerName } from './events'

/**
 * T1-2 — Retention Engine (módulo canal-agnóstico).
 *
 * Porta la semántica de `handleCancellationWebhook` (process.ts:66-331) a un
 * motor determinístico gobernado por `business_sales_config` (T1-1). La
 * decisión de retención vive AQUÍ y no en el canal (Decisión Especial + D5).
 *
 * Estados normativos (D5): none → discount_offered (sentinel) → cancelled.
 *
 * Ramas:
 * - sin trigger de cancelación → `none` (flujo AI normal).
 * - sin SALE_WON activo (RC6) → `none` (frases sin venta no se tragan).
 * - primera cancelación + venta activa → `discount_offer` (UNA vez; sentinel).
 * - segunda cancelación (sentinel) → `confirm_cancel` → `processCancellation`.
 * - ya cancelado → `ack`.
 *
 * Invariantes heredadas del interceptor:
 * - Event-first: `SALE_CANCELLED` se emite ANTES del sentinel; si la escritura
 *   de conversación falla se compensa borrando SOLO el evento id-scoped.
 * - Anti-loop: el sentinel impide ofertar dos veces; el lock de cancelación
 *   (`sales_cancelled_at`) bloquea cierres posteriores (hasCancellationLock).
 * - Este motor NO persiste mensajes ni channel_messages: eso es responsabilidad
 *   del wiring del Core (T1-3). NO llama al LLM para decidir.
 *
 * La reactivación por aceptación del descuento (T1-5) no está incluida.
 */
export type RetentionAction = 'none' | 'discount_offer' | 'confirm_cancel' | 'ack'

export interface RetentionDecision {
  action: RetentionAction
  response?: string
}

export interface RetentionContext {
  businessId: string
  assistantId: string
  conversationId: string
  customerId: string | null
  lastUserMessage: string
}

const ACK_ALREADY_CANCELLED =
  'Tu pedido ya fue cancelado anteriormente. ¿Hay algo más en lo que te pueda ayudar?'
const ACK_NOT_CANCELLATION =
  'No detecté que quisieras cancelar tu pedido. Si efectivamente quieres cancelarlo, responde "sí, quiero cancelar" y lo proceso de inmediato.'

export async function resolveRetentionDecision(
  ctx: RetentionContext
): Promise<RetentionDecision> {
  const { businessId, conversationId, lastUserMessage } = ctx

  if (!hasCancellationTrigger(lastUserMessage)) {
    return { action: 'none' }
  }

  const config = await getSalesConfig(businessId)

  // RC6: sin venta activa (SALE_WON) la frase es conversación normal, no retención.
  const supabase = createAdminClient()
  const { data: activeSale } = await supabase
    .from('sales_events')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('event_type', 'SALE_WON')
    .limit(1)
    .maybeSingle()
  if (!activeSale) {
    return { action: 'none' }
  }

  const { data: conversationState } = await supabase
    .from('conversations')
    .select('sales_cancelled_at, outcome')
    .eq('id', conversationId)
    .maybeSingle()

  const alreadyCancelled =
    conversationState?.sales_cancelled_at &&
    !isDiscountOfferSentinel(conversationState.sales_cancelled_at)

  if (alreadyCancelled) {
    return { action: 'ack', response: ACK_ALREADY_CANCELLED }
  }

  const discountAlreadyOffered = isDiscountOfferSentinel(
    conversationState?.sales_cancelled_at
  )

  if (!discountAlreadyOffered) {
    return await offerDiscount(ctx, config)
  }

  return await confirmCancellation(ctx)
}

async function offerDiscount(
  ctx: RetentionContext,
  config: Awaited<ReturnType<typeof getSalesConfig>>
): Promise<RetentionDecision> {
  const { businessId, assistantId, conversationId, customerId } = ctx
  const supabase = createAdminClient()

  const customerName = customerId ? (await getCustomerName(customerId)) ?? 'Cliente' : 'Cliente'

  const response = config.retention_discount_message
    .replace(/\{customer_name\}/g, customerName)
    .replace(/\{discount_percent\}/g, String(config.retention_discount_percent))

  // Atomicidad event-first: el evento se emite ANTES del sentinel y abajo se
  // compensa id-scoped si la escritura de conversación falla (nunca un sentinel
  // huérfano ni borrado de SALE_CANCELLED históricos de la conversación).
  const createdEventId = await emitSalesEvent({
    businessId,
    assistantId,
    conversationId,
    customerId,
    eventType: 'SALE_CANCELLED',
    metadata: { reason: 'discount_offered' },
  })

  const { data: convHistory } = await supabase
    .from('conversations')
    .select('outcome, outcome_history')
    .eq('id', conversationId)
    .maybeSingle()

  const history = Array.isArray(convHistory?.outcome_history) ? convHistory.outcome_history : []

  const { error: discountStateError } = await supabase
    .from('conversations')
    .update({
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
    })
    .eq('id', conversationId)

  if (discountStateError) {
    try {
      if (createdEventId) {
        await supabase.from('sales_events').delete().eq('id', createdEventId)
      }
    } catch (compensationError) {
      console.error(
        `Failed to compensate SALE_CANCELLED after conversation write failure: ${compensationError instanceof Error ? compensationError.message : String(compensationError)}`,
        { conversationId, createdEventId }
      )
    }
    throw new Error(`Failed to persist cancellation state: ${discountStateError.message}`)
  }

  return { action: 'discount_offer', response }
}

async function confirmCancellation(ctx: RetentionContext): Promise<RetentionDecision> {
  const { businessId, assistantId, conversationId, customerId, lastUserMessage } = ctx
  const supabase = createAdminClient()

  // C1 (paridad): leer el tail RECIENTE (desc+limit), no los más antiguos.
  const messages =
    (
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
    customerId,
    lastUserMessage,
    messages: chatMessages,
  })

  // RC1: nunca afirmar una cancelación que no ocurrió.
  if (!result.processed || result.action === 'not_cancelation') {
    return { action: 'confirm_cancel', response: ACK_NOT_CANCELLATION }
  }

  return { action: 'confirm_cancel', response: result.message ?? 'Tu solicitud de cancelación ha sido procesada.' }
}