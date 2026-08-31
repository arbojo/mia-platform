import { createAdminClient } from '@/lib/supabase/admin'
import { loadConversationContext } from '@/lib/conversation/context'
import { resolveCancellationGuards } from './runtime'
import { toChronologicalTranscript } from './runtime'
import { executeAI } from './execute-ai'
import { resolveConditionalMedia } from './conditional-media'
import { isResendRequest } from './media'
import { isSafeMediaUrl } from './media-guard'
import { resolveRecommendedProduct } from './product-recommendation'
import { extractEvidenceFromCustomerMessage } from './evidence-extraction'
import { processSaleClosing } from '@/lib/sales/process'
import type { CoreInput, CoreOutput } from '@/lib/channels/types'

export async function processCore(input: CoreInput): Promise<CoreOutput> {
  const supabase = createAdminClient()

  let customerId = input.customerId
  if (!customerId && input.conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('customer_id')
      .eq('id', input.conversationId)
      .maybeSingle()
    if (conv?.customer_id) {
      customerId = conv.customer_id
    }
  }

  let conversationOutcome: string | null = null
  if (input.conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('outcome')
      .eq('id', input.conversationId)
      .maybeSingle()
    conversationOutcome = conv?.outcome ?? null
  }

  const { cancellationContext, lastCancelledOrder, userIntent } = await resolveCancellationGuards({
    supabase,
    businessId: input.businessId,
    customerId,
    conversationId: input.conversationId ?? null,
    userContent: input.userMessage,
  })

  const { systemPrompt, usedContext } = await loadConversationContext(
    input.businessId,
    input.assistantId,
    customerId,
    input.channel === 'simulation' ? undefined : input.channel,
    input.intentTag ?? undefined,
    input.landingContext as Parameters<typeof loadConversationContext>[5],
    conversationOutcome,
    cancellationContext,
    lastCancelledOrder,
    userIntent
  )

  let chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [{ role: 'user', content: input.userMessage }]
  if (input.conversationId) {
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', input.conversationId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (history && history.length > 0) {
      chatMessages = [...toChronologicalTranscript(history), ...chatMessages]
    }
  }

  if (input.conversationId && input.userMessage) {
    try {
      await supabase.from('messages').insert({
        conversation_id: input.conversationId,
        role: 'user',
        content: input.userMessage,
      })
    } catch (err) {
      console.error('Failed to persist user message:', err)
    }
  }

  let product: Awaited<ReturnType<typeof resolveRecommendedProduct>> = null
  if (input.userMessage) {
    try {
      product = await resolveRecommendedProduct({
        businessId: input.businessId,
        userMessage: input.userMessage,
        intentTag: input.intentTag ?? null,
        productId: (input.landingContext as Record<string, unknown>)?.productId as string ?? input.preResolvedProductId ?? null,
      })
    } catch (err) {
      console.error('Failed to resolve recommended product:', err)
    }
  }

  let media: Awaited<ReturnType<typeof resolveConditionalMedia>> = null
  if (input.conversationId && input.userMessage) {
    try {
      media = await resolveConditionalMedia({
        businessId: input.businessId,
        customerId,
        conversationId: input.conversationId,
        userMessage: input.userMessage,
        intentTag: input.intentTag ?? null,
        productId: product?.productId ?? input.preResolvedProductId ?? null,
        isResend: isResendRequest(input.userMessage),
      })
    } catch (err) {
      console.error('Failed to resolve conditional media:', err)
    }
  }
  const safeMedia =
    media && media.imageUrl && isSafeMediaUrl(media.imageUrl)
      ? { imageUrl: media.imageUrl, mediaType: media.mediaType }
      : null

  if (input.mode === 'complete') {
    const result = await executeAI({
      mode: 'complete',
      businessId: input.businessId,
      assistantId: input.assistantId,
      requestType: input.requestType,
      system: systemPrompt,
      messages: chatMessages,
      maxTokens: 500,
    })

    const response = result.content

    if (input.conversationId) {
      await supabase.from('messages').insert({
        conversation_id: input.conversationId,
        role: 'assistant',
        content: response,
        metadata: {
          used_context: usedContext,
          ...(product ? { product_id: product.productId, product } : {}),
          ...(safeMedia ? { media: safeMedia } : {}),
        },
      })
    }

    if (customerId && input.conversationId && input.userMessage) {
      try {
        await extractEvidenceFromCustomerMessage({
          customerId,
          conversationId: input.conversationId,
          message: input.userMessage,
          messageId: `msg-${input.conversationId}-${Date.now()}`,
        })
      } catch (err) {
        console.error('Evidence extraction failed (non-blocking):', err)
      }
    }

    // D-DECISION-1: processSaleClosing in complete mode (parity with stream)
    if (customerId && input.conversationId) {
      try {
        await processSaleClosing({
          businessId: input.businessId,
          assistantId: input.assistantId,
          conversationId: input.conversationId,
          customerId,
          canonicalProductId: product?.productId ?? input.preResolvedProductId ?? null,
          messages: [...chatMessages, { role: 'assistant', content: response }],
        })
      } catch (err) {
        console.error('Failed to process sale closing (complete):', err)
      }
    }

    return {
      response,
      product: product ? { productId: product.productId } : null,
      media: safeMedia,
      metadata: {
        usedContext,
        conversationId: input.conversationId,
        customerId,
        deliver: true,
      },
    }
  }

  // Stream mode
  const result = await executeAI({
    mode: 'stream',
    businessId: input.businessId,
    assistantId: input.assistantId,
    requestType: input.requestType,
    system: systemPrompt,
    messages: chatMessages,
    onFinish: async ({ text }) => {
      if (input.conversationId) {
        try {
          await supabase.from('messages').insert({
            conversation_id: input.conversationId,
            role: 'assistant',
            content: text ?? '',
            metadata: {
              used_context: usedContext,
              ...(product ? { product_id: product.productId, product } : {}),
              ...(safeMedia ? { media: safeMedia } : {}),
            },
          })
        } catch (err) {
          console.error('Failed to persist assistant message:', err)
        }

        // D-DECISION-1: processSaleClosing in stream mode (parity with complete)
        if (customerId && text) {
          try {
            await processSaleClosing({
              businessId: input.businessId,
              assistantId: input.assistantId,
              conversationId: input.conversationId,
              customerId,
              canonicalProductId: product?.productId ?? input.preResolvedProductId ?? null,
              messages: [...chatMessages, { role: 'assistant', content: text }],
            })
          } catch (err) {
            console.error('Failed to process sale closing (stream):', err)
          }
        }
      }
    },
  })

  return {
    response: '',
    textStream: result.textStream,
    product: product ? { productId: product.productId } : null,
    media: safeMedia,
    metadata: {
      usedContext,
      conversationId: input.conversationId,
      customerId,
      deliver: true,
    },
  }
}
