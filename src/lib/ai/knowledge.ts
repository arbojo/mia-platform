import { createAdminClient } from '@/lib/supabase/admin'

export const AUTHORITY_TIER = {
  IMMUTABLE: 1,
  MANUAL: 2,
  ACTIVE_RULE: 3,
  REVIEWED_KNOWLEDGE: 4,
  DOCUMENT_KNOWLEDGE: 5,
  AUTO_INSTRUCTION: 6,
  MEMORY_PATTERN: 7,
} as const

export function authorityTag(entity: {
  source?: string | null
  is_immutable?: boolean | null
  memory_type?: string | null
}): string | null {
  if (entity.is_immutable) return 'INMUTABLE'
  if (entity.source === 'manual') return 'MANUAL'
  if (entity.source === 'correction') return 'CORRECCIÓN'
  if (entity.source === 'onboarding') return 'ONBOARDING'
  if (entity.source === 'document') return 'DOCUMENTO'
  if (entity.memory_type === 'decision') return 'DECISIÓN'
  if (entity.memory_type === 'trend' || entity.memory_type === 'pattern') return 'PATRÓN'
  if (entity.source === 'audio') return 'AUDIO'
  return null
}

export async function getBusinessContext(businessId: string) {
  const supabase = createAdminClient()

  const [brandResult, productsResult, rulesResult, instructionsResult, knowledgeResult, memoryResult] =
    await Promise.all([
      supabase
        .from('brand_identities')
        .select('*')
        .eq('business_id', businessId)
        .single(),
      supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true),
      supabase
        .from('sales_rules')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('priority', { ascending: false }),
      supabase
        .from('ai_instructions')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('priority', { ascending: false }),
      supabase
        .from('knowledge_items')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('business_memory')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true),
    ])

  const knowledgeSourceOrder: Record<string, number> = {
    manual: 0, correction: 1, onboarding: 2, document: 3, audio: 4,
  }
  const knowledge = (knowledgeResult.data ?? []).sort((a, b) => {
    const tierA = knowledgeSourceOrder[a.source ?? 'document'] ?? 9
    const tierB = knowledgeSourceOrder[b.source ?? 'document'] ?? 9
    if (tierA !== tierB) return tierA - tierB
    if (a.confidence !== b.confidence) {
      const confOrder = { high: 0, medium: 1, low: 2 }
      return (confOrder[a.confidence as keyof typeof confOrder] ?? 1) - (confOrder[b.confidence as keyof typeof confOrder] ?? 1)
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const memorySourceOrder: Record<string, number> = {
    decision: 0, insight: 1, experience: 2, pattern: 3, trend: 4,
  }
  const memory = (memoryResult.data ?? []).sort((a, b) => {
    if (a.is_immutable !== b.is_immutable) return a.is_immutable ? -1 : 1
    const tierA = memorySourceOrder[a.memory_type ?? 'pattern'] ?? 9
    const tierB = memorySourceOrder[b.memory_type ?? 'pattern'] ?? 9
    if (tierA !== tierB) return tierA - tierB
    if (a.confidence !== b.confidence) return b.confidence - a.confidence
    return b.observation_count - a.observation_count
  })

  return {
    brand: brandResult.data,
    products: productsResult.data ?? [],
    rules: rulesResult.data ?? [],
    instructions: instructionsResult.data ?? [],
    knowledge,
    memory,
  }
}

export async function getBusinessExtractionContext(businessId: string) {
  const supabase = createAdminClient()

  const [productsResult, knowledgeResult, rulesResult] = await Promise.all([
    supabase
      .from('products')
      .select('name, description')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('knowledge_items')
      .select('category, content')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('sales_rules')
      .select('category, content')
      .eq('business_id', businessId)
      .eq('is_active', true),
  ])

  return {
    existingProducts: (productsResult.data ?? []).map((p) => p.name),
    existingKnowledge: (knowledgeResult.data ?? []).map((k) => ({
      category: k.category,
      content: k.content,
    })),
    existingRules: (rulesResult.data ?? []).map((r) => ({
      category: r.category,
      content: r.content,
    })),
  }
}

export async function getRecentLessons(assistantId: string, limit: number = 10) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('learning_events')
    .select('id, original_response, corrected_response, correction_type, created_at')
    .eq('assistant_id', assistantId)
    .in('status', ['approved', 'modified'])
    .order('created_at', { ascending: false })
    .limit(limit)

  return data ?? []
}

export async function getAssistantWithBusiness(assistantId: string) {
  const supabase = createAdminClient()

  const { data: assistant, error } = await supabase
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistantId)
    .single()

  if (error) throw error

  return assistant
}

export async function recordAiUsage(params: {
  business_id: string
  assistant_id: string
  model: string
  request_type?: string
  tokens_input: number
  tokens_output: number
  cost: number
}) {
  const supabase = createAdminClient()

  await supabase.from('ai_usage').insert({
    business_id: params.business_id,
    assistant_id: params.assistant_id,
    model: params.model,
    request_type: params.request_type ?? 'live_customer',
    tokens_input: params.tokens_input,
    tokens_output: params.tokens_output,
    cost: params.cost,
  })
}
