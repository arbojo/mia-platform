import { MODEL, TOKEN_COSTS } from '@/lib/ai/client'
import { recordAiUsage } from '@/lib/ai/knowledge'

export function calculateCost(promptTokens: number, completionTokens: number): number {
  const costs = TOKEN_COSTS[MODEL] ?? TOKEN_COSTS['gpt-4o-mini']
  return (promptTokens * costs.input + completionTokens * costs.output) / 1000
}

export function extractTokenUsage(usage: unknown): { promptTokens: number; completionTokens: number } {
  const u = usage as Record<string, unknown>
  return {
    promptTokens: (u.promptTokens as number) ?? (u.inputTokens as number) ?? 0,
    completionTokens: (u.completionTokens as number) ?? (u.outputTokens as number) ?? 0,
  }
}

export async function trackAiUsage(params: {
  business_id: string
  assistant_id: string
  promptTokens: number
  completionTokens: number
  request_type?: string
  conversation_id?: string
}): Promise<void> {
  const { promptTokens, completionTokens, ...rest } = params
  if (promptTokens > 0 || completionTokens > 0) {
    const cost = calculateCost(promptTokens, completionTokens)
    await recordAiUsage({
      ...rest,
      model: MODEL,
      tokens_input: promptTokens,
      tokens_output: completionTokens,
      cost,
    }).catch((err) => console.error('Failed to record AI usage:', err))
  }
}
