export type ExperienceScope = 'global' | 'industry' | 'business'

export interface ExperienceMemoryItem {
  id: string
  business_id: string | null
  scope: ExperienceScope
  industry: string | null
  pattern_key: string
  customer_objection: string
  sample_raw_query: string | null
  suggested_response: string
  conversion_probability: number
  confidence_level: number
  observation_count: number
  created_at: string
  updated_at: string
}

export interface ExperienceSuggestion {
  id: string
  business_id: string
  parent_memory_id: string
  status: 'pending' | 'approved' | 'dismissed'
  customized_response: string | null
  created_at: string
  updated_at: string
  parent?: ExperienceMemoryItem
}

export interface BlendedPattern {
  patternKey: string
  customerObjection: string
  finalResponse: string
  blendedProbability: number
}
