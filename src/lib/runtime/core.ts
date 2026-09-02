import { createAdminClient } from '@/lib/supabase/admin'
import { loadConversationContext } from '@/lib/conversation/context'
import { resolveCancellationGuards } from './runtime'
import { toChronologicalTranscript } from './runtime'
import { executeAI } from './execute-ai'
import { resolveScopeContext } from './context-scope'
import {
  resolveContextMedia,
  setMediaClaimState,
  logMediaDecision,
  emptyMediaDecision,
  type ContextMediaResult,
} from './context-media'
import { isResendRequest } from './media'
import { isSafeMediaUrl } from './media-guard'
import { withMediaResolutionFeedback } from '@/lib/ai/prompts'
import { resolveRecommendedProduct } from './product-recommendation'
import { extractEvidenceFromCustomerMessage } from './evidence-extraction'
import { processSaleClosing } from '@/lib/sales/process'
import { resolveRetentionDecision } from '@/lib/sales/retention'
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

  // ── T1-3 / ADR-029: retención en el Core, UNA vez por turno ──────────────────
  // Se evalúa después de persistir el mensaje de usuario y ANTES de
  // producto/media/prompt/executeAI (punto de entrada ADR-029 §1). La respuesta
  // canónica corta el pipeline: sin LLM, sin producto/media y sin
  // processSaleClosing, para que el safety-net nunca interprete este turno como
  // cancelación real (§5). El flag RETENTION_CORE_ENABLED permite rollback sin
  // tocar canales. Los IDs ya resueltos se reutilizan tal cual.
  const retentionEnabled = process.env.RETENTION_CORE_ENABLED !== '0'
  if (retentionEnabled && input.conversationId && input.userMessage && customerId) {
    try {
      const retention = await resolveRetentionDecision({
        businessId: input.businessId,
        assistantId: input.assistantId,
        conversationId: input.conversationId,
        customerId: customerId ?? null,
        lastUserMessage: input.userMessage,
      })

      if (retention.action !== 'none') {
        const retentionResponse = retention.response ?? ''
        if (input.conversationId) {
          try {
            await supabase.from('messages').insert({
              conversation_id: input.conversationId,
              role: 'assistant',
              content: retentionResponse,
              metadata: { retention: true },
            })
          } catch (err) {
            console.error('Failed to persist retention response:', err)
          }
        }

        return {
          response: retentionResponse,
          textStream: undefined,
          product: null,
          media: null,
          metadata: {
            usedContext,
            conversationId: input.conversationId,
            customerId,
            deliver: true,
            retention: true,
          },
        }
      }
    } catch (err) {
      // Un fallo de la decisión de retención no debe tumbar el turno:
      // se degrada al pipeline normal (AI/product/media intactos).
      console.error('Retention decision failed (falling back to normal pipeline):', err)
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

  // ── P1-1/P1-2/P1-3: contexto + explicit scope + evaluación de media SCOPED ──
  // El pipeline normativo (doc 25 §1): MESSAGE → CONTEXT → EXPLICIT SCOPE →
  // TRIGGER EVALUATION (dentro del scope) → ELIGIBILITY → ATOMIC CLAIM → retorno.
  // El LLM recibe feedback de la resolución (P1-6) porque la resolución ocurre
  // ANTES de la generación de texto.
  let mediaResolution: ContextMediaResult = { attachment: null, decision: emptyMediaDecision() }
  const ranMediaResolution = Boolean(input.conversationId && input.userMessage)
  if (ranMediaResolution) {
    try {
      const scopeContext = await resolveScopeContext({
        supabase,
        businessId: input.businessId,
        conversationId: input.conversationId ?? null,
        userMessage: input.userMessage,
        landingProductId:
          (input.landingContext as Record<string, unknown>)?.productId as string ??
          input.preResolvedProductId ??
          null,
      })

      mediaResolution = await resolveContextMedia({
        businessId: input.businessId,
        customerId,
        conversationId: input.conversationId ?? null,
        userMessage: input.userMessage,
        intentTag: input.intentTag ?? null,
        scope: scopeContext.messageScope,
        scopeSource: scopeContext.source,
        explicitSource: scopeContext.explicit[0]?.source ?? null,
        isResend: isResendRequest(input.userMessage),
      })

      // P1-7: decisión de media siempre tiene registro del porqué.
      logMediaDecision({
        businessId: input.businessId,
        conversationId: input.conversationId ?? null,
        userMessage: input.userMessage,
        decision: mediaResolution.decision,
      })
    } catch (err) {
      console.error('Failed to resolve context media:', err)
    }
  }

  const media = mediaResolution.attachment
  const safeMedia =
    media && media.imageUrl && isSafeMediaUrl(media.imageUrl)
      ? { imageUrl: media.imageUrl, mediaType: media.mediaType }
      : null

  // P1-4: reflejar en el claim el handoff al transport ('dispatched') o el
  // fallo ('failed'). CLAIMED ≠ DISPATCHED ≠ DELIVERED (doc 26 §1).
  if (input.conversationId && mediaResolution.attachment) {
    try {
      await setMediaClaimState(
        supabase,
        input.conversationId,
        mediaResolution.attachment.knowledgeItemId,
        safeMedia ? 'dispatched' : 'failed'
      )
    } catch (err) {
      console.error('Failed to persist media claim state:', err)
    }
  }

  // P1-6: feedback mínimo de media resolvida adjunto al prompt (doc 28 §3).
  const systemPromptForAI = ranMediaResolution
    ? withMediaResolutionFeedback(systemPrompt, {
        scope: mediaResolution.decision.scope,
        explicitScope: mediaResolution.decision.explicitScope,
        eligible: mediaResolution.decision.eligible,
        assetSelected: mediaResolution.decision.assetSelected,
        claim: mediaResolution.decision.claim,
        dispatched: mediaResolution.decision.dispatched,
        delivered: mediaResolution.decision.delivered,
      })
    : systemPrompt

  if (input.mode === 'complete') {
    const result = await executeAI({
      mode: 'complete',
      businessId: input.businessId,
      assistantId: input.assistantId,
      requestType: input.requestType,
      system: systemPromptForAI,
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
    system: systemPromptForAI,
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
