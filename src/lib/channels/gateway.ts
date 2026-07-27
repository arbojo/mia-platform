import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOpenAIClient, MODEL, TOKEN_COSTS } from '@/lib/ai/client'
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
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
} from './types'

export class GatewayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

const adapters: Record<ChannelType, ChannelAdapter> = {
  web: new WebChatAdapter(),
  whatsapp: new WhatsAppAdapter(),
  messenger: new WebChatAdapter(),
  instagram: new WebChatAdapter(),
}

export function getAdapter(channel: ChannelType): ChannelAdapter {
  return adapters[channel]
}

async function buildChatContext(businessId: string, assistantId: string) {
  const supabase = createAdminClient()

  const { data: fullAssistant } = await supabase
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistantId)
    .single()

  if (!fullAssistant) {
    throw new GatewayError('Assistant not found', 'ASSISTANT_NOT_FOUND', 404)
  }

  const context = await getBusinessContext(businessId)

  const systemPrompt = buildMasterPrompt({
    business: fullAssistant.businesses,
    brand: context.brand,
    assistant: fullAssistant,
    products: context.products,
    rules: context.rules,
    instructions: context.instructions,
    knowledge: context.knowledge,
  })

  const usedContext: Array<{ type: string; id: string }> = []
  context.products.forEach((p) => usedContext.push({ type: 'product', id: p.id }))
  context.rules.forEach((r) => usedContext.push({ type: 'sales_rule', id: r.id }))
  context.instructions.forEach((i) => usedContext.push({ type: 'ai_instruction', id: i.id }))
  context.knowledge.forEach((k) => usedContext.push({ type: 'knowledge_item', id: k }))

  return { systemPrompt, usedContext, fullAssistant }
}

function calculateCost(promptTokens: number, completionTokens: number): number {
  const costs = TOKEN_COSTS[MODEL] ?? TOKEN_COSTS['gpt-4o-mini']
  return (promptTokens * costs.input + completionTokens * costs.output) / 1000
}

function extractTokenUsage(usage: unknown): { promptTokens: number; completionTokens: number } {
  const u = usage as Record<string, unknown>
  const promptTokens = (u.promptTokens as number) ?? (u.inputTokens as number) ?? 0
  const completionTokens = (u.completionTokens as number) ?? (u.outputTokens as number) ?? 0
  return { promptTokens, completionTokens }
}

export async function processChatMessage(params: {
  assistantId: string
  conversationId?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  requestType?: string
}) {
  const { assistantId, conversationId, messages, requestType = 'live_customer' } = params

  const supabase = createAdminClient()

  const { data: assistant } = await supabase
    .from('assistants')
    .select('id, business_id')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    throw new GatewayError('Assistant not found', 'ASSISTANT_NOT_FOUND', 404)
  }

  const businessId = assistant.business_id

  if (conversationId) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('assistant_id', assistantId)
      .single()

    if (!conversation) {
      throw new GatewayError('Conversation not found', 'CONVERSATION_NOT_FOUND', 404)
    }
  }

  const { systemPrompt, usedContext } = await buildChatContext(businessId, assistantId)

  const result = streamText({
    model: openai(MODEL),
    system: systemPrompt,
    messages,
    onFinish: async ({ usage, text }) => {
      const { promptTokens, completionTokens } = extractTokenUsage(usage)

      if (promptTokens > 0 || completionTokens > 0) {
        const cost = calculateCost(promptTokens, completionTokens)
        await recordAiUsage({
          business_id: businessId,
          assistant_id: assistantId,
          model: MODEL,
          request_type: requestType,
          tokens_input: promptTokens,
          tokens_output: completionTokens,
          cost,
        }).catch((err) => console.error('Failed to record AI usage:', err))
      }

      if (conversationId) {
        const lastUserMessage = messages[messages.length - 1]
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

async function resolveBusinessIdFromChannel(
  channel: ChannelType,
  normalized: NormalizedMessage
): Promise<string> {
  const metadata = normalized.metadata

  if (metadata.businessId) {
    return metadata.businessId as string
  }

  const supabase = createAdminClient()

  if (channel === 'whatsapp' && metadata.phoneNumberId) {
    const { data: connection } = await supabase
      .from('channel_connections')
      .select('business_id')
      .eq('channel', 'whatsapp')
      .eq('status', 'connected')
      .contains('credentials', { phone_number_id: metadata.phoneNumberId as string })
      .limit(1)
      .single()

    if (connection) {
      return connection.business_id
    }
  }

  throw new GatewayError(
    `Cannot resolve business for ${channel} channel. Ensure channel_connections is configured.`,
    'BUSINESS_NOT_FOUND',
    400
  )
}

export async function processIncomingMessage(
  channel: ChannelType,
  webhookBody: unknown,
  headers?: Record<string, string>
): Promise<{ response: string; customerId: string; conversationId: string }> {
  const adapter = getAdapter(channel)
  const normalized = await adapter.receiveMessage(webhookBody, headers)

  const businessId = await resolveBusinessIdFromChannel(channel, normalized)

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
    throw new GatewayError('No active assistant found for business', 'NO_ASSISTANT', 404)
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

  const { systemPrompt, usedContext } = await buildChatContext(businessId, assistant.id)

  const chatHistory = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20)

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

  const { promptTokens, completionTokens } = {
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  }

  if (promptTokens > 0 || completionTokens > 0) {
    const cost = calculateCost(promptTokens, completionTokens)
    await recordAiUsage({
      business_id: businessId,
      assistant_id: assistant.id,
      model: MODEL,
      request_type: 'live_customer',
      tokens_input: promptTokens,
      tokens_output: completionTokens,
      cost,
    }).catch((err) => console.error('Failed to record AI usage:', err))
  }

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
