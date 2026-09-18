import { createAdminClient } from '@/lib/supabase/admin'
import {
  detectSaleOutcome,
  hasCancellationTrigger,
  hasDiscountAcceptanceTrigger,
  hasPendingConfirmationRequest,
  hasSalesTrigger,
  hasShortAffirmative,
  isExplicitNewPurchaseIntent,
} from './detect'
import type { SaleDetectionResult } from './detect'
import { processCancellation } from './cancel'
import {
  applyConversationOutcome,
  emitDeliveryIssueSignal,
  emitSaleConfirmed,
  emitSalesEvent,
  fetchOrderNumber,
  getCustomerData,
  getCustomerName,
  getSaleCycleState,
  hasCancellationLock,
  isRetentionConflictError,
  notifySaleToOwner,
} from './events'
import type { DetectedSaleEvent } from './events'
import { getSalesConfig } from '@/lib/ai/knowledge'
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
import { resolveCustomer } from '@/lib/channels/identity'
import type { WireMessage } from '@/lib/runtime/types'
import { detectExplicitScopes } from '@/lib/runtime/context-scope'

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
 * FASE 1 — Contrato Comercial Real (decisión C): resuelve la cantidad vendida de
 * un SALE_WON.
 *
 * El LLM puede extraer una cantidad explícita (products[].quantity o
 * events[].quantity, ya sanitizada en detect.ts a entero >= 1). Cuando no hay
 * cantidad explícita, el default contractual es 1 (una unidad) — este 1 es un
 * valor determinístico de la plataforma, NUNCA una "cantidad detectada" por el LLM.
 */
const DEFAULT_QUANTITY = 1

export function resolveSaleQuantity(
  event: DetectedSaleEvent,
  products?: SaleDetectionResult['products']
): number {
  if (
    typeof event.quantity === 'number' &&
    Number.isInteger(event.quantity) &&
    event.quantity >= 1
  ) {
    return event.quantity
  }
  // Fuente alternativa del LLM: products[].quantity. Igualamos por nombre
  // normalizado contra el productName del evento (ambos texto LLM).
  if (event.productName && products?.length) {
    const target = event.productName.trim().toLowerCase()
    const match = products.find((p) => p.name.trim().toLowerCase() === target)
    if (
      match &&
      typeof match.quantity === 'number' &&
      Number.isInteger(match.quantity) &&
      match.quantity >= 1
    ) {
      return match.quantity
    }
  }
  return DEFAULT_QUANTITY
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
        // BUG-T5 / Godzilla H1 — si el update del sentinel rechaza (throw, no
        // {error}), la compensación se ejecuta ANTES de re-lanzar. Patrón idéntico
        // al de discountStateError (error de DB) justo abajo.
        let discountStateErrorForThrow: Error | null = null
        let discountStateError: { message: string } | null = null
        try {
          const result = await supabase.from('conversations').update({
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
          discountStateError = result.error
        } catch (err) {
          // BUG-T5: supabase-js rechazó (fallo de red/transporte)
          discountStateErrorForThrow = err instanceof Error ? err : new Error(String(err))
          discountStateError = { message: discountStateErrorForThrow.message }
        }

        if (discountStateError) {
          // The event was already created above; the conversation write failed.
          // Compensate by deleting ONLY the exact event we created (id-scoped),
          // then propagate the error. This never removes other SALE_CANCELLED
          // events of the conversation.
          try {
            if (createdEventId) {
              const { error: compensateError } = await supabase.from('sales_events')
                .delete()
                .eq('id', createdEventId)
              // F1-b / ADR-030 — supabase-js no lanza ante un error de DB: el
              // resultado del DELETE se inspecciona. Una compensación fallida se
              // reporta y el error original se re-lanza igual (nunca silenciosa).
              if (compensateError) {
                console.error(
                  'Failed to compensate SALE_CANCELLED: delete returned an error',
                  { conversationId, createdEventId, error: compensateError.message }
                )
              }
            }
          } catch (compensationError) {
            console.error(
              `Failed to compensate SALE_CANCELLED after conversation write failure: ${
                compensationError instanceof Error ? compensationError.message : String(compensationError)
              }`,
              { conversationId, createdEventId }
            )
          }
          if (discountStateErrorForThrow) throw discountStateErrorForThrow
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
  productContextId?: string | null
  messages: Array<{ role: string; content: string }>
}): Promise<void> {
  const {
    businessId,
    assistantId,
    conversationId,
    customerId,
    canonicalProductId,
    productContextId,
    messages,
  } = params
  const supabaseAdmin = createAdminClient()

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUserMessage) return

  // Contexto de producto del turno: el id del producto recomendado del turno (query
  // directa a DB) o, en su defecto, el anchor del producto activo del scope. En la
  // recompra ("quiero comprarlo") el id canónico del turno puede ser null pero el
  // anchor del scope resuelve al producto en diálogo.
  const productId = canonicalProductId ?? productContextId ?? null

  // === STEP 0.5: Cancellation Intention Gate — structural turn block ===
  // If the CURRENT customer message expresses cancellation intent, this turn
  // never proceeds to sales detection: no SALE_WON/SALE_STARTED/PRODUCT_SELECTED
  // is emitted, regardless of what the customer said before. Unlike the RC6 guard
  // in handleCancellationWebhook/retention, this gate does NOT require a prior
  // SALE_WON: cancellation intent in the current turn blocks sale closing whether
  // or not there is a sale to cancel. (Root cause ORD-000012: "Cancelo la compra"
  // missed CANCELLATION_KEYWORDS → hasCancellationTrigger=false → this gate never
  // fired → detectSaleOutcome emitted a spurious SALE_WON. Fixed in detect.ts by
  // adding the first-person conjugations.)
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

    // No prior sale → processCancellation returns denied ("No se encontró una
    // venta reciente para cancelar.") without emitting anything. In BOTH cases
    // (denied/confirmed) the turn stays blocked: it never degrades to detection.
    await processCancellation({
      businessId,
      assistantId,
      conversationId,
      customerId,
      lastUserMessage: lastUserMessage.content,
      messages,
    })
    return
  }

  // === STEP 1: Estado del ciclo de venta (anti-loop + recompra legítima) ===
  // La conversación es UN hilo de WhatsApp para siempre (resolver.ts); los ciclos
  // de venta son múltiples y permitidos por C1/ADR. Se lee el estado en UNA
  // consulta: cierre previo + ciclo nuevo abierto DESPUÉS de ese cierre.
  const cycleState = await getSaleCycleState(conversationId)

  // === STEP 1.1: Queja de entrega fallida (post-cierre) — señal, nunca silenciosa ===
  // No abre ciclo de venta, pero dispara mia_signals para que David/el equipo
  // actúe. Se detecta ANTES del pre-gate porque frases como "no me llegó nada"
  // no pasan el pre-gate de ventas y no deben silenciarse igualmente.
  let newPurchaseIntent: 'explicit' | 'followup' | 'delivery_issue' | 'ambiguous' | null = null
  if (cycleState.hasClosed) {
    newPurchaseIntent = isExplicitNewPurchaseIntent(lastUserMessage.content, productId)
    if (newPurchaseIntent === 'delivery_issue') {
      await emitDeliveryIssueSignal({
        businessId,
        conversationId,
        customerId,
        complaint: lastUserMessage.content,
      })
      return
    }
    // Anti-loop: cierre previo y SIN ciclo nuevo abierto → solo procede recompra
    // explícita. Seguimiento/reconfirmación del pedido cerrado (followup) queda
    // bloqueado sin pagar LLM. La afirmativa "ok" sobre un pedido viejo también
    // se quiebra aquí si no hay SALE_STARTED posterior al cierre.
    if (!cycleState.hasOpenCycle && newPurchaseIntent === 'followup') return
  }

  // === STEP 1.5: Cancellation lock — blocks sale closing on cancelled conversations ===
  const isCancelled = await hasCancellationLock(conversationId)
  if (isCancelled) return

  // === STEP 2: Sales detection (existing flow) ===
  // Gate contextual de afirmativas cortas (TASK-20260830-005512058):
  // una afirmativa corta ("sí", "claro", "dale", ...) SOLO dispara la detección
  // cuando existe un ciclo de venta abierto esperando confirmación explícita.
  const affirmative = hasShortAffirmative(lastUserMessage.content)
  if (!hasSalesTrigger(lastUserMessage.content) && !affirmative) return
  if (affirmative && !hasPendingConfirmationRequest(messages)) return
  if (affirmative && !cycleState.hasOpenCycle) return

  const result = await detectSaleOutcome({
    businessId,
    assistantId,
    messages,
  })

  if (!result.outcome && result.events.length === 0) return

  // === STEP 2.5: ¿Se permite cerrar un nuevo ciclo desde el estado detectado? ===
  // Recompra/cierre solo cuando: (a) no hubo cierre previo, (b) hay un ciclo nuevo
  // abierto tras el cierre, (c) intención EXPLICITA de compra nueva (reorden
  // autocontenido / verbo de compra con producto), o (d) intención ambigua con
  // EVIDENCIA de flujo nuevo en ESTE resultado (SALE_STARTED/PRODUCT_SELECTED).
  // Sin eso, un resultado SALE_WON sobre una conversación cerrada es
  // reconfirmación del pedido viejo → se descarta (RC5c).
  const newCycleFlow = result.events.some(
    (e) => e.type === 'SALE_STARTED' || e.type === 'PRODUCT_SELECTED'
  )
  const allowClosing =
    !cycleState.hasClosed ||
    cycleState.hasOpenCycle ||
    newPurchaseIntent === 'explicit' ||
    (newPurchaseIntent === 'ambiguous' && newCycleFlow)

  // CLOSING-EVENT CUSTOMER PAYLOAD (TASK-20260908):
  // detectSaleOutcome ya extrajo nombre/teléfono/ciudad/dirección. El SALE_WON
  // debe nacer con esos datos EN su metadata (delivery.handle_sale_won lee
  // metadata->'customer'), sin esperar al update de public.customers del final.
  // Fallback a closingProfile cubre el caso "perfil ya enriquecido" (recompra);
  // la ventana de re-extracción del transcript cubre captura <= últimas 12 msgs.
  const isClosingFlow = result.events.some(
    (e) => e.type === 'SALE_WON' || e.type === 'SALE_LOST'
  )
  const closingProfile =
    isClosingFlow ? await getCustomerData(customerId) : null
  const closingCustomer =
    isClosingFlow
      ? {
          name:
            result.customerName ??
            closingProfile?.name ??
            (await getCustomerName(customerId)) ??
            null,
          phone: result.phone ?? closingProfile?.phone ?? null,
          city: result.city ?? closingProfile?.city ?? null,
          address: result.address ?? closingProfile?.address ?? null,
        }
      : undefined

  for (const event of result.events) {
    const isClosing = event.type === 'SALE_WON' || event.type === 'SALE_LOST'
    if (isClosing && !allowClosing) continue

    // MEDIUM-1: per-event product attribution.
    // Always prefer canonicalProductId (resolved by resolveRecommendedProduct,
    // a direct DB query). Previously bypassed when productName was present,
    // causing emitSalesEvent to fall through to the broken RPC resolver.
    const eventProductId = productId ?? null

    // Snapshot comercial del SALE_WON (estructura que ya consumen los triggers
    // delivery.handle_sale_won e inventory.handle_sale_won via metadata->'items').
    // Se resuelve SOLO para SALE_WON y nunca muta la identidad canónica (C4).
    //
    // FASE 1 — Contrato Comercial Real (decisiones A/C/D):
    //   - items[].unit_price = precio de catálogo congelado al cierre (precio
    //     vendido histórico), unidad de referencia para el total determinista.
    //   - items[].quantity = cantidad explícita (LLM, sanitizada int >= 1) o el
    //     default contractual 1. Nunca un total "comercial" inventado.
    //   - totals = { subtotal, discount, total } calculado DETERMINISTICAMENTE en
    //     código: subtotal = unit_price × quantity; discount = 0 (F3 más adelante);
    //     total = subtotal. sales_events.amount := totals.total.
    //   - El amount del LLM (event.amount) NUNCA determina el total final: es solo
    //     dato de interpretación; el precio ganador es el de catálogo (A).
    //   - Sin producto resoluble o sin precio verificable => NO hay total
    //     determinista => amount null (nunca sustituir con amount LLM, no inventar precio).
    //
    // FASE 2 — Multi-producto: un pedido puede llevar N items. Se materializa UN
    // item por cada products[] del LLM que resuelve a catálogo (canonical o match
    // determinístico de hit único). Si no hay products[] se conserva el flujo
    // single-product de FASE 1 (event.productName). Items sin precio se incluyen
    // en el snapshot (con unit_price null) pero no contribuyen al total.
    const items: Array<{
      product_id: string
      name: string
      unit_price: number | null
      quantity: number
    }> = []
    let totals: { subtotal: number | null; discount: number; total: number | null } | null = null

    if (event.type === 'SALE_WON') {
      try {
        // Catálogo de candidatos: products[] del LLM, o si la lista está vacía,
        // el propio event.productName como candidato único (compat FASE 1).
        const candidates = result.products?.length
          ? result.products
          : event.productName
            ? [{ name: event.productName, quantity: event.quantity }]
            : []

        for (const candidate of candidates) {
          // Identidad canónica estricta (C4): si el candidato coincide con el
          // producto del evento y hay canonicalProductId, se usa directamente.
          let productIdForItem: string | null = null
          if (candidate.name === event.productName && eventProductId) {
            productIdForItem = eventProductId
          } else {
            // Matcher determinístico del runtime (literal/SKU/alias/compacto/
            // fuzzy). Solo un hit único es aceptable; ambigüedad o sin-match =>
            // se omite ese item (no fabricar).
            const hits = await detectExplicitScopes(supabaseAdmin, businessId, candidate.name)
            if (hits.length === 1) productIdForItem = hits[0].productId
          }

          if (!productIdForItem) continue

          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('id, name, price')
            .eq('business_id', businessId)
            .eq('id', productIdForItem)
            .single()
          if (prod) {
            items.push({
              product_id: prod.id,
              name: prod.name,
              unit_price: prod.price,
              quantity: candidate.quantity ?? DEFAULT_QUANTITY,
            })
          }
        }

        // Fallback conservador: si no se materializó ningún item (p.ej. products[]
        // con textos que el matcher no resolvió), match EXACTO por nombre del evento
        // (precio + snapshot sin identidad permisiva) — compat FASE 1.
        if (items.length === 0 && event.productName) {
          const name = event.productName.trim()
          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('id, name, price')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .ilike('name', name)
            .limit(1)
            .maybeSingle()
          if (prod) {
            items.push({
              product_id: prod.id,
              name: prod.name,
              unit_price: prod.price,
              quantity: resolveSaleQuantity(event, result.products),
            })
          }
        }

        // Total determinista: Σ(unit_price × quantity) sobre los items CON precio.
        // Items sin precio verificable no contribuyen; si NINGUNO tiene precio =>
        // sin totals => amount null (no inventar).
        const pricedItems = items.filter((i) => i.unit_price !== null)
        if (pricedItems.length > 0) {
          const subtotal = pricedItems.reduce(
            (acc, i) => acc + (i.unit_price as number) * i.quantity,
            0
          )
          totals = { subtotal, discount: 0, total: subtotal }
        }
      } catch (err) {
        console.error('Product snapshot/price lookup failed:', err)
      }
    }

    // Monto comercial final: SIEMPRE el total determinista para SALE_WON
    // (decisión A). El amount LLM se conserva solo como dato de interpretación;
    // para otros eventos (no-close) el amount sigue siendo la detección del LLM.
    let amount: number | null
    if (event.type === 'SALE_WON') {
      amount = totals?.total ?? null
    } else {
      amount = event.amount ?? null
    }

    // El amount resuelto alimenta tanto el evento como el deal del STEP 3
    // (confirmación con "Total: $X" y conversations.deal_value).
    event.amount = amount

    const saleMetadata =
      event.type === 'SALE_WON' && closingCustomer
        ? { customer: closingCustomer }
        : undefined

    await emitSalesEvent({
      businessId,
      assistantId,
      conversationId,
      customerId,
      eventType: event.type,
      productName: event.productName,
      // Identidad canónica estricta (C4): solo eventProductId. El snapshot
      // permisivo viaja en metadata->items, nunca en sales_events.product_id.
      productId: eventProductId ?? undefined,
      amount,
      metadata:
        event.type === 'SALE_WON' && items.length > 0
          ? { ...saleMetadata, items, totals }
          : saleMetadata,
    })
  }

  // === STEP 3: Outcome application ===
  // 'cancelled' is never a valid conversations.outcome (CHECK, migration 025).
  // Cancellation state lives exclusively in sales_cancelled_at + SALE_CANCELLED
  // event and is handled by the interception paths above.
  if (result.outcome && result.outcome !== 'cancelled' && allowClosing) {
    // FASE 1 (decisión A): en ventas ganadas el deal SIEMPRE es el total
    // determinista del SALE_WON (puede ser null: sin producto/precio resoluble).
    // Nunca caer al amount LLM de otro evento como sustituto del total comercial.
    const saleWonEvent = result.outcome === 'sold'
      ? result.events.find((e) => e.type === 'SALE_WON')
      : undefined
    const deal = saleWonEvent ?? result.events.find((e) => e.amount != null)
    const dealValue = saleWonEvent ? (saleWonEvent.amount ?? null) : (deal?.amount ?? null)

    await applyConversationOutcome({
      conversationId,
      outcome: result.outcome,
      dealValue,
      customerId,
      eventType: result.events.find((e) => e.type === 'SALE_WON' || e.type === 'SALE_LOST')?.type,
    })

    if (result.outcome === 'sold' || result.outcome === 'interested' || result.outcome === 'not_interested') {
      const customerData = await getCustomerData(customerId)
      const customerName =
        result.customerName ??
        (customerData?.name ?? (await getCustomerName(customerId)))
      const product = result.events.find((e) => e.productName)?.productName ?? null

      const resolved = {
        phone: result.phone ?? customerData?.phone ?? null,
        city: result.city ?? customerData?.city ?? null,
        address: result.address ?? customerData?.address ?? null,
      }

      await notifySaleToOwner({
        businessId,
        customerName,
        amount: dealValue,
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

            const totalAmount = dealValue ?? 0
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
