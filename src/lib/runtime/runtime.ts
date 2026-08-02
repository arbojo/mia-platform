import { createAdminClient } from '@/lib/supabase/admin'
import { loadConversationContext } from '@/lib/conversation/context'
import { resolveCustomer } from '@/lib/channels/identity'
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
export { RuntimeError } from '@/lib/conversation/resolver'
import { executeAI } from './execute-ai'
import { resolveConditionalMedia } from './conditional-media'
import type { ChannelAdapter } from '@/lib/channels/types'
import type { WireMessage } from './types'

export async function processStreaming(params: {
  assistantId: string
  businessId: string
  conversationId?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  requestType: string
}) {
  const { assistantId, businessId, conversationId, messages, requestType } = params

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

  const { systemPrompt, usedContext } = await loadConversationContext(businessId, assistantId, customerId)

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
            metadata: { used_context: usedContext },
          })
        } catch (err) {
          console.error('Failed to persist assistant message:', err)
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
): Promise<{
  response: string
  customerId: string
  conversationId: string
  imageUrl?: string
}> {
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

  const { systemPrompt, usedContext } = await loadConversationContext(businessId, assistantId, customer.id)

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

  const media = await resolveConditionalMedia({
    businessId,
    customerId: customer.id,
    conversationId: conversationId ?? null,
    userMessage: wireMessage.content,
  })

  return {
    response,
    customerId: customer.id,
    conversationId: conversationId ?? '',
    imageUrl: media?.imageUrl,
  }
}
