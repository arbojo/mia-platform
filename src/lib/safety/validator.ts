import type { SafetyContext, SafetyResult } from './types'
import { scanTriggers } from './triggers'
import {
  validatePrice,
  validateDelivery,
  validateGuarantee,
  validateDiscount,
  validateImmutable,
} from './checks'

export async function validateAIResponse(
  text: string,
  context: SafetyContext
): Promise<SafetyResult> {
  const triggers = scanTriggers(text)
  const violations: string[] = []

  if (triggers.length > 0) {
    const byType = groupTriggers(triggers)

    for (const type of Object.keys(byType)) {
      switch (type) {
        case 'price': {
          const { valid, reason } = validatePrice(text, context)
          if (!valid) violations.push(reason!)
          break
        }
        case 'delivery': {
          const { valid, reason } = validateDelivery(text, context)
          if (!valid) violations.push(reason!)
          break
        }
        case 'guarantee': {
          const { valid, reason } = validateGuarantee(text, context)
          if (!valid) violations.push(reason!)
          break
        }
        case 'discount': {
          const { valid, reason } = validateDiscount(text, context)
          if (!valid) violations.push(reason!)
          break
        }
      }
    }
  }

  const hasImmutableMemory = context.memory.some((m) => m.is_immutable)
  if (hasImmutableMemory) {
    const { valid, reason } = validateImmutable(text, context)
    if (!valid) violations.push(reason!)
  }

  return {
    passed: violations.length === 0,
    triggers,
    blocked: violations.length > 0,
    retriesAttempted: 0,
    finalResponse: text,
  }
}

function groupTriggers(triggers: Array<{ type: string }>): Record<string, any[]> {
  const groups: Record<string, any[]> = {}
  for (const t of triggers) {
    if (!groups[t.type]) groups[t.type] = []
    groups[t.type].push(t)
  }
  return groups
}
