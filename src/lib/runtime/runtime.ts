import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import { trackAiUsage } from '@/lib/ai/cost'
import { loadConversationContext } from '@/lib/conversation/context'
import { resolveCustomer } from '@/lib/channels/identity'
import type { ChannelAdapter } from '@/lib/channels/types'
import type { ChatCompletionMessageParam } from 'openai/resources'
import type { WireMessage } from './types'

export class RuntimeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'RuntimeError'
  }
}

export async function processStreaming(params: {
  assistantId: string
  businessId: string
  conversationId?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  requestType: string
}) {
  const { assistantId, businessId, conversationId, messages, requestType } = params

  const { systemPrompt, usedContext } = await loadConversationContext(businessId, assistantId)

  const result = streamText({
    model: openai(MODEL),
    system: systemPrompt,
    messages,
    onFinish: async ({ usage, text }) => {
      const u = usage as { promptTokens?: number; completionTokens?: number }
      const promptTokens = u.promptTokens ?? 0
      const completionTokens = u.completionTokens ?? 0

      await trackAiUsage({
        business_id: businessId,
        assistant_id: assistantId,
        promptTokens,
        completionTokens,
        request_type: requestType,
      })

      if (conversationId) {
        const lastUserMessage = messages[messages.length - 1]
        const supabase = createAdminClient()
        try {
          await supabase.from('messages').insert([
            {
              conversation_id: conversationId,
              role: 'user',
              content: lastUserMessage.content,
            },
            {
              conversation_id: conversationId,
              role: 'assistant',
              content: text ?? '',
              metadata: { used_context: usedContext },
            },
          ])
        } catch (err) {
          console.error('Failed to persist messages:', err)
        }
      }
    },
  })

  return result
}

export async function processIncomingMessage(
  channel: string,
  wireMessage: WireMessage,
  _adapter: ChannelAdapter
): Promise<{ response: string; customerId: string; conversationId: string }> {
  const supabase = createAdminClient()

  const connection = await resolveConnection(channel, wireMessage)
  const businessId = connection.business_id
  const assistantId = connection.assistant_id

  const customer = await resolveCustomer(businessId, wireMessage)

  const conversationId = await resolveConversation(assistantId, customer.id)

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

  const { systemPrompt, usedContext } = await loadConversationContext(businessId, assistantId)

  const chatHistory = conversationId
    ? await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20)
    : { data: [] }

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...(chatHistory.data ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  const completion = await getOpenAIClient().chat.completions.create({
    model: MODEL,
    messages: openaiMessages,
    max_tokens: 500,
  })

  const response = completion.choices[0]?.message?.content ?? ''

  const promptTokens = completion.usage?.prompt_tokens ?? 0
  const completionTokens = completion.usage?.completion_tokens ?? 0

  await trackAiUsage({
    business_id: businessId,
    assistant_id: assistantId,
    promptTokens,
    completionTokens,
    request_type: 'live_customer',
  })

  if (conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: response,
      metadata: {
        channel,
        used_context: usedContext,
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

  await supabase.from('channel_messages').insert({
    business_id: businessId,
    customer_id: customer.id,
    channel,
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
    conversationId: conversationId ?? '',
  }
}

async function resolveConnection(
  channel: string,
  wireMessage: WireMessage
): Promise<{ business_id: string; assistant_id: string }> {
  const metadata = wireMessage.metadata

  if (metadata.businessId) {
    const supabase = createAdminClient()
    const { data: assistant } = await supabase
      .from('assistants')
      .select('id, business_id')
      .eq('business_id', metadata.businessId as string)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (assistant) {
      return { business_id: assistant.business_id, assistant_id: assistant.id }
    }
    throw new RuntimeError('No active assistant found for business', 'NO_ASSISTANT', 404)
  }

  if (channel === 'whatsapp' && metadata.phoneNumberId) {
    const supabase = createAdminClient()
    const { data: connection } = await supabase
      .from('channel_connections')
      .select('business_id, assistant_id')
      .eq('channel', 'whatsapp')
      .eq('status', 'connected')
      .contains('credentials', { phone_number_id: metadata.phoneNumberId as string })
      .limit(1)
      .single()

    if (connection) {
      return { business_id: connection.business_id, assistant_id: connection.assistant_id }
    }
  }

  throw new RuntimeError(
    `Cannot resolve connection for ${channel} channel. Ensure channel_connections is configured.`,
    'CONNECTION_NOT_FOUND',
    400
  )
}

async function resolveConversation(
  assistantId: string,
  customerId: string
): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: existingConversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('assistant_id', assistantId)
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .eq('type', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingConversation) {
    return existingConversation.id
  }

  const { data: newConversation } = await supabase
    .from('conversations')
    .insert({
      assistant_id: assistantId,
      customer_id: customerId,
      type: 'live',
      status: 'active',
    })
    .select()
    .single()

  return newConversation?.id ?? null
}
