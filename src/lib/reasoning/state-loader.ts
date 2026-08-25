import { getCustomerMemory } from '@/lib/ai/customer-memory'
import { createInitialState, type CustomerState } from '@/lib/reasoning/state'
import { enrichPrompt, type PromptEnrichment } from '@/lib/reasoning/prompt-enricher'

export async function getCustomerStateFromMemory(
  customerId: string
): Promise<PromptEnrichment | undefined> {
  const memory = await getCustomerMemory(customerId)
  if (!memory) return undefined

  const state: CustomerState = memory.evidence?.state ?? createInitialState()
  const evidence = memory.evidence?.items ?? []

  return enrichPrompt(state, evidence)
}
