import { createAdminClient } from '@/lib/supabase/admin'
import { createEvidenceItem, type EvidenceItem } from '@/lib/reasoning/evidence'
import { extractEvidenceWithLLM } from '@/lib/reasoning/evidence-extraction-llm'
import { computeCustomerState, createInitialState } from '@/lib/reasoning/state'
import { getCustomerMemory } from '@/lib/ai/customer-memory'
import { mergeEvidenceItems } from '@/lib/reasoning/evidence'

export interface EvidenceExtractionParams {
  customerId: string
  conversationId: string
  message: string
  messageId: string
}

export async function extractEvidenceFromCustomerMessage(
  params: EvidenceExtractionParams
): Promise<EvidenceItem[]> {
  const { customerId, conversationId, message, messageId } = params

  const llmResults = await extractEvidenceWithLLM(message)

  const evidenceItems: EvidenceItem[] = llmResults.map((signal) =>
    createEvidenceItem({
      message_id: messageId,
      conversation_id: conversationId,
      customer_id: customerId,
      timestamp: new Date().toISOString(),
      type: signal.type,
      weight: signal.weight,
      confidence: signal.confidence,
      metadata: { source: 'llm_extraction', model: 'gpt-4o-mini' },
    })
  )

  if (evidenceItems.length === 0) return []

  const supabase = createAdminClient()
  const memory = await getCustomerMemory(customerId)
  const existingEvidence = memory?.evidence?.items ?? []
  const mergedEvidence = mergeEvidenceItems(existingEvidence, evidenceItems)

  const previousState = memory?.evidence?.state ?? createInitialState()
  const newState = computeCustomerState(previousState, evidenceItems)

  const updatedMemory: Record<string, unknown> = {
    ...(memory ?? {}),
    evidence: {
      items: mergedEvidence.slice(-200),
      state: newState,
    },
  }

  await supabase
    .from('customers')
    .update({ memory: updatedMemory })
    .eq('id', customerId)

  return evidenceItems
}
