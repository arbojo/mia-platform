import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
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

    const { messages, assistantId, conversationId } = parsed.data

    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('*, businesses(*)')
      .eq('id', assistantId)
      .single()

    if (assistantError || !assistant) {
      return Response.json({ error: 'Assistant not found' }, { status: 404 })
    }

    const businessId = assistant.business_id
    const context = await getBusinessContext(businessId)

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
      onFinish: async ({ usage }) => {
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
          tokens_input: promptTokens,
          tokens_output: completionTokens,
          cost,
        })

        if (conversationId) {
          const lastUserMessage = messages[messages.length - 1]
          await supabase.from('messages').insert([
            {
              conversation_id: conversationId,
              role: 'user',
              content: lastUserMessage.content,
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
