import { createAdminClient } from '@/lib/supabase/admin'
import { getBusinessContext, getRecentLessons } from '@/lib/ai/knowledge'
import { buildMasterPrompt } from '@/lib/ai/prompts'
import type { SafetyContext } from '@/lib/safety/types'

export class ContextError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'ContextError'
  }
}

export interface LoadedContext {
  systemPrompt: string
  usedContext: Array<{ type: string; id: string }>
  fullAssistant: unknown
  businessId: string
  assistantId: string
  safetyContext: SafetyContext
}

export async function loadConversationContext(
  businessId: string,
  assistantId: string
): Promise<LoadedContext> {
  const supabase = createAdminClient()

  const { data: fullAssistant } = await supabase
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistantId)
    .single()

  if (!fullAssistant) {
    throw new ContextError('Assistant not found', 'ASSISTANT_NOT_FOUND', 404)
  }

  const [context, recentLessons] = await Promise.all([
    getBusinessContext(businessId),
    getRecentLessons(assistantId, 10),
  ])

  const systemPrompt = buildMasterPrompt({
    business: fullAssistant.businesses,
    brand: context.brand,
    assistant: fullAssistant,
    products: context.products,
    rules: context.rules,
    instructions: context.instructions,
    knowledge: context.knowledge,
    memory: context.memory,
    recentLessons,
  })

  const usedContext: Array<{ type: string; id: string }> = []
  context.products.forEach((p) => usedContext.push({ type: 'product', id: p.id }))
  context.rules.forEach((r) => usedContext.push({ type: 'sales_rule', id: r.id }))
  context.instructions.forEach((i) => usedContext.push({ type: 'ai_instruction', id: i.id }))
  context.knowledge.forEach((k) => usedContext.push({ type: 'knowledge_item', id: k }))
  if (context.memory) context.memory.forEach((m) => usedContext.push({ type: 'business_memory', id: m.id }))

  return {
    systemPrompt,
    usedContext,
    fullAssistant,
    businessId,
    assistantId,
    safetyContext: {
      products: context.products.map((p) => ({ id: p.id, name: p.name, price: p.price })),
      rules: context.rules.map((r) => ({ id: r.id, category: r.category, content: r.content })),
      memory: context.memory.map((m) => ({ id: m.id, content: m.content, is_immutable: m.is_immutable })),
    },
  }
}
