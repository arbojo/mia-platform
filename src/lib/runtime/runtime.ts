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
import { processSaleClosing } from '@/lib/sales/process'
import type { ChannelAdapter, ChannelType, InteractiveComponent } from '@/lib/channels/types'
import type { WireMessage } from './types'
import type { LandingContext } from '@/lib/ai/knowledge'

export interface ProcessStreamingResult {
  toTextStreamResponse(): Response
  toStructuredStreamResponse(): Response
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

  const { systemPrompt, usedContext } = await loadConversationContext(
    businessId,
    assistantId,
    customerId,
    channel,
    intentTag ?? undefined,
    landingContext
  )

  let chatMessages = messages
  if (conversationId) {
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(30)

    if (history && history.length > 0) {
      const pastMessages = history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      chatMessages = [...pastMessages, ...messages]
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

  const { systemPrompt, usedContext, productId } = await loadConversationContext(
    businessId,
    assistantId,
    customer.id,
    channel === 'whatsapp' || channel === 'web' || channel === 'widget' || channel === 'messenger' || channel === 'instagram'
      ? channel
      : undefined,
    intentTag
  )

  const chatHistory = conversationId
    ? await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20)
    : { data: [] }

  const chatMessages = (chatHistory.data ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

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

  if (mode === 'active' && conversationId) {
    try {
      await processSaleClosing({
        businessId,
        assistantId,
        conversationId,
        customerId: customer.id,
        messages: [...chatMessages, { role: 'user', content: wireMessage.content }, { role: 'assistant', content: response }],
      })
    } catch (err) {
      console.error('Failed to process sale closing:', err)
    }
  }

  // Resolver producto recomendado para asociar la imagen correcta al producto
  // que el cliente está preguntando (sin esto, la imagen podía ser de otro producto).
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
