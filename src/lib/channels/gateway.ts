import { createAdminClient } from '@/lib/supabase/admin'
import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import type { ChatCompletionMessageParam } from 'openai/resources'
import { buildMasterPrompt } from '@/lib/ai/prompts'
import { getBusinessContext, recordAiUsage } from '@/lib/ai/knowledge'
import { resolveCustomer } from './identity'
import { WebChatAdapter } from './adapters/web'
import { WhatsAppAdapter } from './adapters/whatsapp'
import type {
  ChannelAdapter,
  ChannelConnection,
  ChannelType,
  OutgoingMessage,
  SendResult,
} from './types'

const adapters: Record<ChannelType, ChannelAdapter> = {
  web: new WebChatAdapter(),
  whatsapp: new WhatsAppAdapter(),
  messenger: new WebChatAdapter(),
  instagram: new WebChatAdapter(),
}

export function getAdapter(channel: ChannelType): ChannelAdapter {
  return adapters[channel]
}

export async function processIncomingMessage(
  channel: ChannelType,
  webhookBody: unknown,
  headers?: Record<string, string>
): Promise<{ response: string; customerId: string; conversationId: string }> {
  const adapter = getAdapter(channel)
  const normalized = await adapter.receiveMessage(webhookBody, headers)

  const businessId = (normalized.metadata.businessId as string) ?? ''

  if (!businessId) {
    throw new Error('businessId required in metadata')
  }

  const customer = await resolveCustomer(businessId, normalized)

  const supabase = createAdminClient()

  const { data: assistant } = await supabase
    .from('assistants')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!assistant) {
    throw new Error('No active assistant found for business')
  }

  let conversationId: string | null = null

  const { data: existingConversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('assistant_id', assistant.id)
    .eq('customer_id', customer.id)
    .eq('status', 'active')
    .eq('type', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingConversation) {
    conversationId = existingConversation.id
  } else {
    const { data: newConversation } = await supabase
      .from('conversations')
      .insert({
        assistant_id: assistant.id,
        customer_id: customer.id,
        type: 'live',
        status: 'active',
      })
      .select()
      .single()

    conversationId = newConversation?.id ?? null
  }

  if (conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: normalized.content,
      metadata: {
        channel,
        external_id: normalized.externalId,
      },
    })
  }

  const context = await getBusinessContext(businessId)

  const { data: fullAssistant } = await supabase
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistant.id)
    .single()

  if (!fullAssistant) {
    throw new Error('Assistant not found')
  }

  const systemPrompt = buildMasterPrompt({
    business: fullAssistant.businesses,
    brand: context.brand,
    assistant: fullAssistant,
    products: context.products,
    rules: context.rules,
    instructions: context.instructions,
    knowledge: context.knowledge,
  })

  const chatHistory = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...(chatHistory.data ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  const completion = await getOpenAIClient().chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 500,
  })

  const response = completion.choices[0]?.message?.content ?? ''

  const tokensInput = completion.usage?.prompt_tokens ?? 0
  const tokensOutput = completion.usage?.completion_tokens ?? 0

  if (tokensInput > 0 || tokensOutput > 0) {
    const cost = (tokensInput * 0.00015 + tokensOutput * 0.0006) / 1000
    await recordAiUsage({
      business_id: businessId,
      assistant_id: assistant.id,
      model: MODEL,
      request_type: 'live_customer',
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      cost,
    }).catch(() => {})
  }

  if (conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: response,
      metadata: {
        channel,
        used_context: [],
      },
    })
  }

  await supabase.from('channel_messages').insert({
    business_id: businessId,
    customer_id: customer.id,
    channel,
    direction: 'incoming',
    content: normalized.content,
    external_id: normalized.externalId,
    external_customer_id: normalized.customerExternalId,
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

export async function sendOutgoingMessage(
  channel: ChannelType,
  connectionId: string,
  message: OutgoingMessage
): Promise<SendResult> {
  const adapter = getAdapter(channel)
  const supabase = createAdminClient()

  const { data: connection } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (!connection) {
    return { success: false, error: 'Connection not found' }
  }

  const channelConnection: ChannelConnection = {
    id: connection.id,
    businessId: connection.business_id,
    assistantId: connection.assistant_id,
    channel: connection.channel as ChannelType,
    status: connection.status,
    credentials: connection.credentials as Record<string, unknown>,
    configuration: connection.configuration as Record<string, unknown>,
    lastSync: connection.last_sync,
    errorMessage: connection.error_message,
  }

  return adapter.sendMessage(channelConnection, message)
}
