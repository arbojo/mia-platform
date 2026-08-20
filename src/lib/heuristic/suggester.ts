import { createAdminClient } from '@/lib/supabase/admin'

interface SuggestionResult {
  suggestionsCreated: number
}

interface IndustryPattern {
  id: string
  pattern_key: string
}

interface BusinessMemory {
  pattern_key: string
}

interface ExistingSuggestion {
  parent_memory_id: string
}

/**
 * Busca patrones industriales de alto rendimiento (> 70% conversión)
 * que el negocio aún no tiene y genera sugerencias pendientes (Opt-In).
 */
export async function generateIndustrySuggestions(
  businessId: string,
  industry: string,
): Promise<SuggestionResult> {
  const supabase = createAdminClient()

  const { data: industryPatterns } = await supabase
    .from('experience_memory')
    .select('id, pattern_key')
    .eq('scope', 'industry')
    .eq('industry', industry)
    .gt('conversion_probability', 0.70)

  if (!industryPatterns || industryPatterns.length === 0) {
    return { suggestionsCreated: 0 }
  }

  const typedPatterns = industryPatterns as IndustryPattern[]

  const [bizMemoriesResult, existingSuggestionsResult] = await Promise.all([
    supabase
      .from('experience_memory')
      .select('pattern_key')
      .eq('business_id', businessId),
    supabase
      .from('experience_suggestions')
      .select('parent_memory_id')
      .eq('business_id', businessId),
  ])

  const registeredKeys = new Set(
    (bizMemoriesResult.data as BusinessMemory[] | null ?? []).map((m) => m.pattern_key),
  )
  const suggestedIds = new Set(
    (existingSuggestionsResult.data as ExistingSuggestion[] | null ?? []).map((s) => s.parent_memory_id),
  )

  const toInsert = typedPatterns.filter(
    (p) => !registeredKeys.has(p.pattern_key) && !suggestedIds.has(p.id),
  )

  if (toInsert.length === 0) {
    return { suggestionsCreated: 0 }
  }

  const { error } = await supabase.from('experience_suggestions').insert(
    toInsert.map((p) => ({
      business_id: businessId,
      parent_memory_id: p.id,
      status: 'pending' as const,
    })),
  )

  if (error) throw error

  return { suggestionsCreated: toInsert.length }
}
