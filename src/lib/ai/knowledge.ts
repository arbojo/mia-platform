import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types'

type Tables = Database['public']['Tables']

export async function getBusinessContext(businessId: string) {
  const supabase = createAdminClient()

  const [brandResult, productsResult, rulesResult, instructionsResult, knowledgeResult] =
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
        .eq('is_active', true),
    ])

  return {
    brand: brandResult.data,
    products: productsResult.data ?? [],
    rules: rulesResult.data ?? [],
    instructions: instructionsResult.data ?? [],
    knowledge: knowledgeResult.data ?? [],
  }
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
  tokens_input: number
  tokens_output: number
  cost: number
}) {
  const supabase = createAdminClient()

  await supabase.from('ai_usage').insert({
    business_id: params.business_id,
    assistant_id: params.assistant_id,
    model: params.model,
    tokens_input: params.tokens_input,
    tokens_output: params.tokens_output,
    cost: params.cost,
  })
}
