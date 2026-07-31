import { createAdminClient } from '@/lib/supabase/admin'
import type { SafetyTrigger } from './types'

export async function logSafetyEvent(params: {
  businessId: string
  assistantId: string
  originalResponse: string
  correctedResponse: string | null
  triggers: SafetyTrigger[]
  outcome: 'passed' | 'blocked_with_retry' | 'pending_ai'
}): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase.from('safety_events').insert({
    business_id: params.businessId,
    assistant_id: params.assistantId,
    original_response: params.originalResponse,
    corrected_response: params.correctedResponse,
    triggers: JSON.parse(JSON.stringify(params.triggers)),
    trigger_types: [...new Set(params.triggers.map((t) => t.type))],
    outcome: params.outcome,
  })

  if (error) {
    console.error('Failed to log safety event:', error)
  }
}

export async function logPendingAiSignal(params: {
  businessId: string
  assistantId: string
  originalResponse: string
  triggers: SafetyTrigger[]
}): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase.from('safety_events').insert({
    business_id: params.businessId,
    assistant_id: params.assistantId,
    original_response: params.originalResponse,
    corrected_response: null,
    triggers: JSON.parse(JSON.stringify(params.triggers)),
    trigger_types: [...new Set(params.triggers.map((t) => t.type))],
    outcome: 'pending_ai',
  })

  if (error) {
    console.error('Failed to log pending AI signal:', error)
  }
}
