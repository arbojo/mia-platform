import { createAdminClient } from '@/lib/supabase/admin'
import { loadConversationContext } from '@/lib/conversation/context'
import { resolveCustomer } from '@/lib/channels/identity'
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
export { RuntimeError } from '@/lib/conversation/resolver'
import { executeAI } from './execute-ai'
import { resolveConditionalMedia, type MediaAttachment } from './conditional-media'
import { isResendRequest } from './media'
import { isSafeMediaUrl } from './media-guard'
import { resolveRecommendedProduct } from './product-recommendation'
import { buildStructuredStreamResponse } from './stream-response'
import { detectIntent, buildInteractiveForIntent } from './intents'
import { processSaleClosing, isDiscountOfferSentinel } from '@/lib/sales/process'
import { classifyUserIntent } from '@/lib/sales/intent-classifier'
import { extractEvidenceFromCustomerMessage } from './evidence-extraction'
import type { ChannelAdapter, ChannelType, InteractiveComponent } from '@/lib/channels/types'
import type { WireMessage } from './types'
import type { LandingContext } from '@/lib/ai/knowledge'

export interface ProcessStreamingResult {
  toTextStreamResponse(): Response
  toStructuredStreamResponse(): Response
}

export interface CancellationGuards {
  cancellationContext: { orderNumber: string; hoursAgo: number } | null
  lastCancelledOrder: {
    productName: string | null
    cancelledAt: string
    hoursAgo: number
    pending?: boolean
  } | null
  userIntent: 'explicit_purchase' | 'casual' | 'order_reference' | null
}

// C1 (parity): pure helper compartido que convierte el tail DESC (los N mas
// recientes) en un transcript CRONOLOGICO. Todos los canales lo usan para que
// el detector y el core vean la ultima intervencion del cliente (misma entrada
// semantica => misma decision). Antes cada call-site hacia slice().reverse()
// inline; centralizarlo hace el invariant testeable y evita divergencias.
export function toChronologicalTranscript<
  T extends { role: string; content: string }
>(historyDesc: T[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return historyDesc.slice().reverse().map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
}

// P1 (parity): compute los guards de cancelacion (cancellationContext,
// lastCancelledOrder, userIntent) de forma IDENTICA para todos los canales
// (Web Chat streaming y WhatsApp/mensajeria). Antes solo los computaba
// processIncomingMessage; processStreaming no los pasaba a loadConversationContext
// y por eso el Web Chat no activaba los guards de post-venta/RETENTION_PENDING.
// Sin esto, el mismo input semantico en canales distintos producia decisiones
// distintas (violacion del objetivo parity "mismo input + mismo estado = misma decision").
export async function resolveCancellationGuards(params: {
  supabase: ReturnType<typeof createAdminClient>
  businessId: string
  customerId: string | undefined
  conversationId: string | null
  userContent: string
}): Promise<CancellationGuards> {
  const { supabase, businessId, customerId, conversationId, userContent } = params

  let cancellationContext: CancellationGuards['cancellationContext'] = null
  if (customerId) {
    const { data: lastConv } = await supabase
      .from('conversations')
      .select('id, sales_cancelled_at')
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .not('sales_cancelled_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastConv?.sales_cancelled_at) {
      const cancelledAt = new Date(lastConv.sales_cancelled_at).getTime()
      const hoursAgo = (Date.now() - cancelledAt) / (1000 * 60 * 60)
      if (hoursAgo < 24) {
        const { data: cancelEvent } = await supabase
          .from('sales_events')
          .select('metadata')
          .eq('conversation_id', lastConv.id)
          .eq('event_type', 'SALE_CANCELLED')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const orderNumber = (cancelEvent?.metadata as Record<string, unknown>)?.order_number as string | undefined
        cancellationContext = { orderNumber: orderNumber ?? 'desconocido', hoursAgo: Math.round(hoursAgo * 10) / 10 }
      }
    }
  }

  let lastCancelledOrder: CancellationGuards['lastCancelledOrder'] = null
  let userIntent: CancellationGuards['userIntent'] = null

  if (customerId) {
    const { data: customerData } = await supabase
      .from('customers')
      .select('last_cancelled_order')
      .eq('id', customerId)
      .maybeSingle()

    const rawOrder = customerData?.last_cancelled_order
    if (rawOrder && typeof rawOrder === 'object' && 'cancelled_at' in rawOrder) {
      const cancelledAt = new Date(rawOrder.cancelled_at as string).getTime()
      const hoursAgo = (Date.now() - cancelledAt) / (1000 * 60 * 60)

      const { getSalesConfig } = await import('@/lib/ai/knowledge')
      const salesConfig = await getSalesConfig(businessId)
      const windowHours = salesConfig.cancellation_window_hours ?? 24

      if (hoursAgo < windowHours) {
        lastCancelledOrder = {
          productName: (rawOrder.product_name as string) ?? null,
          cancelledAt: rawOrder.cancelled_at as string,
          hoursAgo: Math.round(hoursAgo * 10) / 10,
        }
        userIntent = classifyUserIntent(userContent)
      }
    }
  }

  // RETENTION_PENDING: si la conversacion actual tiene el sentinel (descuento
  // ofrecido, decision pendiente del cliente), se construye lastCancelledOrder
  // para activar el guard anti-reconstruccion.
  if (!lastCancelledOrder && conversationId) {
    const { data: currentConv } = await supabase
      .from('conversations')
      .select('sales_cancelled_at, outcome_updated_at')
      .eq('id', conversationId)
      .maybeSingle()

    if (currentConv && isDiscountOfferSentinel(currentConv.sales_cancelled_at)) {
      const { data: cancelEvent } = await supabase
        .from('sales_events')
        .select('metadata, created_at')
        .eq('conversation_id', conversationId)
        .eq('event_type', 'SALE_CANCELLED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const productName = (cancelEvent?.metadata as Record<string, unknown>)?.product_name as string | undefined
      const eventTime = cancelEvent?.created_at ?? currentConv.outcome_updated_at

      if (eventTime) {
        const pendingSince = new Date(eventTime).getTime()
        const hoursAgo = (Date.now() - pendingSince) / (1000 * 60 * 60)

        const { getSalesConfig } = await import('@/lib/ai/knowledge')
        const salesConfig = await getSalesConfig(businessId)
        const windowHours = salesConfig.cancellation_window_hours ?? 24

        if (hoursAgo < windowHours) {
          lastCancelledOrder = {
            productName: productName ?? null,
            cancelledAt: eventTime,
            hoursAgo: Math.round(hoursAgo * 10) / 10,
            pending: true,
          }
          userIntent = classifyUserIntent(userContent)
        }
      }
    }
  }

  return { cancellationContext, lastCancelledOrder, userIntent }
}

export async function processStreaming(params: {
  assistantId: string
  businessId: string
  conversationId?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  requestType: string
  landingContext?: LandingContext
  intentTag?: string | null
  channel?: ChannelType | 'simulation'
}): Promise<ProcessStreamingResult> {
  const { assistantId, businessId, conversationId, messages, requestType, landingContext, intentTag, channel } = params

  const supabase = createAdminClient()
  let customerId: string | undefined
  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('customer_id')
      .eq('id', conversationId)
      .maybeSingle()
    if (conv?.customer_id) {
      customerId = conv.customer_id
    }
  }

  let conversationOutcome: string | null = null
  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('outcome')
      .eq('id', conversationId)
      .maybeSingle()
    conversationOutcome = conv?.outcome ?? null
  }

  // P1 (parity): computar los guards de cancelacion tambien en el flujo streaming
  // (Web Chat). Antes solo los computaba processIncomingMessage; sin esto, el Web
  // Chat no activaba los guards de post-venta/RETENTION_PENDING y divergia de
  // WhatsApp. Ahora ambos canales usan la misma funcion compartida.
  const { cancellationContext, lastCancelledOrder, userIntent } = await resolveCancellationGuards({
    supabase,
    businessId,
    customerId,
    conversationId: conversationId ?? null,
    userContent: messages[messages.length - 1]?.content ?? '',
  })

  const { systemPrompt, usedContext } = await loadConversationContext(
    businessId,
    assistantId,
    customerId,
    channel,
    intentTag ?? undefined,
    landingContext,
    conversationOutcome,
    cancellationContext,
    lastCancelledOrder,
    userIntent
  )

  let chatMessages = messages
  if (conversationId) {
    // C1 (parity): el transcript debe ser el tail RECIENTE de la conversacion.
    // .order(desc)+limit(N) entrega los N mas recientes; invertimos el orden
    // para que queden cronologicos y el detector reciba la ultima intervencion.
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (history && history.length > 0) {
      chatMessages = [...toChronologicalTranscript(history), ...messages]
    }
  }

  const lastUserMessage = messages[messages.length - 1]
  if (conversationId && lastUserMessage) {
    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: lastUserMessage.content,
      })
    } catch (err) {
      console.error('Failed to persist user message:', err)
    }
  }

  let product: Awaited<ReturnType<typeof resolveRecommendedProduct>> = null
  if (lastUserMessage) {
    try {
      product = await resolveRecommendedProduct({
        businessId,
        userMessage: lastUserMessage.content,
        intentTag: intentTag ?? null,
        productId: landingContext?.productId ?? null,
      })
    } catch (err) {
      console.error('Failed to resolve recommended product:', err)
    }
  }

  // Media condicional (imagenes por trigger): se resuelve tambien en el flujo
  // streaming (incluido el laboratorio con channel=simulation). El re-pedido
  // explicito del cliente salta los guards de envio unico.
  let media: MediaAttachment | null = null
  if (conversationId && lastUserMessage) {
    try {
      media = await resolveConditionalMedia({
        businessId,
        customerId,
        conversationId,
        userMessage: lastUserMessage.content,
        intentTag: intentTag ?? null,
        productId: product?.productId ?? landingContext?.productId ?? null,
        isResend: isResendRequest(lastUserMessage.content),
      })
    } catch (err) {
      console.error('Failed to resolve conditional media:', err)
    }
  }
  const safeMedia =
    media && media.imageUrl && isSafeMediaUrl(media.imageUrl)
      ? { imageUrl: media.imageUrl, mediaType: media.mediaType }
      : null

  const result = await executeAI({
    mode: 'stream',
    businessId,
    assistantId,
    requestType,
    system: systemPrompt,
    messages: chatMessages,
    onFinish: async ({ text }) => {
      if (conversationId) {
        try {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: text ?? '',
            metadata: {
              used_context: usedContext,
              ...(product
                ? { product_id: product.productId, product }
                : {}),
              ...(safeMedia ? { media: safeMedia } : {}),
            },
          })
        } catch (err) {
          console.error('Failed to persist assistant message:', err)
        }
      }
    },
  })

  return {
    toTextStreamResponse: () => result.toTextStreamResponse(),
    toStructuredStreamResponse: () =>
      buildStructuredStreamResponse({ textStream: result.textStream, product, media: safeMedia }),
  }
}

export async function processIncomingMessage(
  channel: string,
  wireMessage: WireMessage,
  _adapter: ChannelAdapter
): Promise<{
  response: string
  customerId: string
  conversationId: string
  imageUrl?: string
  mediaType?: 'image' | 'testimonial'
  interactive?: InteractiveComponent
  deliver: boolean
}> {
  const supabase = createAdminClient()

  const connection = await resolveConnection(channel, wireMessage)
  const businessId = connection.business_id
  const assistantId = connection.assistant_id
  const mode = connection.mode

  const customer = await resolveCustomer(businessId, wireMessage)

  const conversationId = await resolveConversation(assistantId, customer.id)

  // P1 (parity): guards de cancelacion compartidos (idénticos para todos los
  // canales). Reemplaza los tres bloques que antes computaban cancellationContext,
  // lastCancelledOrder y userIntent de forma inline en processIncomingMessage.
  const { cancellationContext, lastCancelledOrder, userIntent } = await resolveCancellationGuards({
    supabase,
    businessId,
    customerId: customer.id,
    conversationId,
    userContent: wireMessage.content,
  })

  const intentTag = detectIntent(wireMessage.content, wireMessage.payload)

  if (conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: wireMessage.content,
      metadata: {
        channel,
        external_id: wireMessage.externalId,
      },
    })
  }

  await supabase.from('channel_messages').insert({
    business_id: businessId,
    customer_id: customer.id,
    channel,
    direction: 'incoming',
    content: wireMessage.content,
    external_id: wireMessage.externalId,
    external_customer_id: wireMessage.customerExternalId,
    status: 'received',
  })

  // PAUSED: the channel is inactive. The message is stored but MIA does not
  // process it (no AI call, no response, no outgoing record).
  if (mode === 'paused') {
    await supabase
      .from('customers')
      .update({ last_interaction: new Date().toISOString() })
      .eq('id', customer.id)

    return {
      response: '',
      customerId: customer.id,
      conversationId: conversationId ?? '',
      deliver: false,
    }
  }

  let conversationOutcome: string | null = null
  if (conversationId) {
    const { data: convOutcome } = await supabase
      .from('conversations')
      .select('outcome')
      .eq('id', conversationId)
      .maybeSingle()
    conversationOutcome = convOutcome?.outcome ?? null
  }

  const { systemPrompt, usedContext, productId } = await loadConversationContext(
    businessId,
    assistantId,
    customer.id,
    channel === 'whatsapp' || channel === 'web' || channel === 'widget' || channel === 'messenger' || channel === 'instagram'
      ? channel
      : undefined,
    intentTag,
    undefined,
    conversationOutcome,
    cancellationContext,
    lastCancelledOrder,
    userIntent
  )

  const chatHistory = conversationId
    ? await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] }

  const chatMessages = toChronologicalTranscript(chatHistory.data ?? [])

  const result = await executeAI({
    mode: 'complete',
    businessId,
    assistantId,
    requestType: 'live_customer',
    system: systemPrompt,
    messages: chatMessages,
    maxTokens: 500,
  })

  const response = result.content

  if (conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: response,
      metadata: {
        channel,
        used_context: usedContext,
        ...(mode === 'shadow' ? { shadow: true, delivered: false } : {}),
      },
    })
  }

  await supabase.from('channel_messages').insert({
    business_id: businessId,
    customer_id: customer.id,
    channel,
    direction: 'outgoing',
    content: response,
    status: mode === 'shadow' ? 'processing' : 'sent',
    sent_at: mode === 'shadow' ? null : new Date().toISOString(),
    metadata: mode === 'shadow' ? { shadow: true, delivered: false } : {},
  })

  await supabase
    .from('customers')
    .update({ last_interaction: new Date().toISOString() })
    .eq('id', customer.id)

  if (conversationId && customer.id) {
    try {
      await extractEvidenceFromCustomerMessage({
        customerId: customer.id,
        conversationId,
        message: wireMessage.content,
        messageId: `msg-${conversationId}-${Date.now()}`,
      })
    } catch (err) {
      console.error('Evidence extraction failed (non-blocking):', err)
    }
  }

  // Resolver producto recomendado (canónico) para asociar la imagen correcta
  // al producto que el cliente está preguntando (sin esto, la imagen podía ser
  // de otro producto). Se resuelve ANTES de processSaleClosing para que los
  // eventos de cierre lleven el selected_product.id canónico (B1b: los eventos
  // no deben re-resolver el producto por texto libre cuando ya hay selección).
  let resolvedProduct: Awaited<ReturnType<typeof resolveRecommendedProduct>> = null
  if (wireMessage.content) {
    try {
      resolvedProduct = await resolveRecommendedProduct({
        businessId,
        userMessage: wireMessage.content,
        intentTag: intentTag ?? null,
        productId: productId ?? null,
      })
    } catch (err) {
      console.error('Failed to resolve recommended product:', err)
    }
  }

  if (mode === 'active' && conversationId) {
    try {
      await processSaleClosing({
        businessId,
        assistantId,
        conversationId,
        customerId: customer.id,
        canonicalProductId: resolvedProduct?.productId ?? productId ?? null,
        messages: [...chatMessages, { role: 'user', content: wireMessage.content }, { role: 'assistant', content: response }],
      })
    } catch (err) {
      console.error('Failed to process sale closing:', err)
    }
  }

  const media = mode === 'shadow' ? undefined : await resolveConditionalMedia({
    businessId,
    customerId: customer.id,
    conversationId: conversationId ?? null,
    userMessage: wireMessage.content,
    intentTag: intentTag ?? null,
    productId: resolvedProduct?.productId ?? productId ?? null,
  })

  // SHADOW: the reply is generated and stored for learning but never sent.
  const deliver = mode !== 'shadow'

  let interactive: InteractiveComponent | undefined
  if (channel === 'whatsapp' && mode !== 'shadow' && intentTag) {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    interactive =
      buildInteractiveForIntent(intentTag, products ?? [], response) ?? undefined
  }

  return {
    response,
    customerId: customer.id,
    conversationId: conversationId ?? '',
    imageUrl: media?.imageUrl && isSafeMediaUrl(media.imageUrl) ? media.imageUrl : undefined,
    mediaType: media?.mediaType,
    interactive,
    deliver,
  }
}
