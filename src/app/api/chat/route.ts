import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MODEL, TOKEN_COSTS } from '@/lib/ai/client'
import { buildMasterPrompt } from '@/lib/ai/prompts'
import { getBusinessContext, recordAiUsage } from '@/lib/ai/knowledge'

export const runtime = 'nodejs'
export const maxDuration = 60

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  assistantId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  requestType: z.enum(['live_customer', 'simulation', 'training']).optional().default('live_customer'),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { messages, assistantId, conversationId, requestType } = parsed.data

    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('*, businesses(*)')
      .eq('id', assistantId)
      .single()

    if (assistantError || !assistant) {
      return Response.json({ error: 'Assistant not found' }, { status: 404 })
    }

    if (assistant.businesses.owner_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
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
        return Response.json({ error: 'Conversation not found' }, { status: 404 })
      }
    }
    const context = await getBusinessContext(businessId)

    const usedContext: Array<{ type: string; id: string }> = []
    context.products.forEach((p) => usedContext.push({ type: 'product', id: p.id }))
    context.rules.forEach((r) => usedContext.push({ type: 'sales_rule', id: r.id }))
    context.instructions.forEach((i) => usedContext.push({ type: 'ai_instruction', id: i.id }))
    context.knowledge.forEach((k) => usedContext.push({ type: 'knowledge_item', id: k.id }))

    const systemPrompt = buildMasterPrompt({
      business: assistant.businesses,
      brand: context.brand,
      assistant,
      products: context.products,
      rules: context.rules,
      instructions: context.instructions,
      knowledge: context.knowledge,
    })

    const result = streamText({
      model: openai(MODEL),
      system: systemPrompt,
      messages,
      onFinish: async ({ usage, text }) => {
        const costs = TOKEN_COSTS[MODEL] ?? TOKEN_COSTS['gpt-4o-mini']
        const promptTokens = (usage as { promptTokens?: number; inputTokens?: number }).promptTokens ?? (usage as { inputTokens?: number }).inputTokens ?? 0
        const completionTokens = (usage as { completionTokens?: number; outputTokens?: number }).completionTokens ?? (usage as { outputTokens?: number }).outputTokens ?? 0
        const cost =
          (promptTokens * costs.input +
            completionTokens * costs.output) /
          1000

        await recordAiUsage({
          business_id: businessId,
          assistant_id: assistantId,
          model: MODEL,
          request_type: requestType,
          tokens_input: promptTokens,
          tokens_output: completionTokens,
          cost,
        })

        if (conversationId) {
          const admin = createAdminClient()
          const lastUserMessage = messages[messages.length - 1]
          await admin.from('messages').insert([
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
        }
      },
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Chat error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
