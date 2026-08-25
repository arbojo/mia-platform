import { randomUUID } from 'crypto'

export const EVIDENCE_TYPES = [
  'interest',
  'trust',
  'readiness',
  'clarity',
  'engagement',
  'hesitation',
  'price_sensitivity',
  'urgency',
  'confusion',
  'objection',
] as const

export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

export const EVIDENCE_DIMENSIONS = [
  'interest',
  'trust',
  'readiness',
  'clarity',
  'engagement',
] as const

export type EvidenceDimension = (typeof EVIDENCE_DIMENSIONS)[number]

export interface EvidenceItem {
  id: string
  message_id: string
  conversation_id: string
  customer_id: string
  timestamp: string
  type: EvidenceType
  weight: number
  confidence: number
  decay_rate: number
  metadata: Record<string, unknown>
}

export interface EvidenceExtractionResult {
  evidence: EvidenceItem[]
  extraction_method: string
  extracted_at: string
}

export const DEFAULT_DECAY_RATES: Record<EvidenceType, number> = {
  interest: Math.log(2) / 72,
  trust: Math.log(2) / 168,
  readiness: Math.log(2) / 48,
  clarity: Math.log(2) / 96,
  engagement: Math.log(2) / 24,
  hesitation: Math.log(2) / 36,
  price_sensitivity: Math.log(2) / 48,
  urgency: Math.log(2) / 12,
  confusion: Math.log(2) / 24,
  objection: Math.log(2) / 72,
}

const EVIDENCE_TO_DIMENSION: Record<EvidenceType, EvidenceDimension | null> = {
  interest: 'interest',
  trust: 'trust',
  readiness: 'readiness',
  clarity: 'clarity',
  engagement: 'engagement',
  hesitation: null,
  price_sensitivity: null,
  urgency: null,
  confusion: null,
  objection: null,
}

export function getDimensionForEvidence(type: EvidenceType): EvidenceDimension | null {
  return EVIDENCE_TO_DIMENSION[type]
}

export function computeDecayedWeight(item: EvidenceItem, now: Date): number {
  const elapsed = (now.getTime() - new Date(item.timestamp).getTime()) / (1000 * 60 * 60)
  const decayFactor = Math.exp(-item.decay_rate * elapsed)
  return item.weight * item.confidence * decayFactor
}

export function validateEvidenceItem(item: EvidenceItem): string[] {
  const errors: string[] = []

  if (!item.id) errors.push('missing id')
  if (!item.message_id) errors.push('missing message_id')
  if (!item.conversation_id) errors.push('missing conversation_id')
  if (!item.customer_id) errors.push('missing customer_id')
  if (!item.timestamp) errors.push('missing timestamp')
  if (!EVIDENCE_TYPES.includes(item.type)) errors.push(`invalid type: ${item.type}`)
  if (item.weight < 0 || item.weight > 1) errors.push(`weight out of range: ${item.weight}`)
  if (item.confidence < 0 || item.confidence > 1) errors.push(`confidence out of range: ${item.confidence}`)
  if (item.decay_rate < 0) errors.push(`negative decay_rate: ${item.decay_rate}`)

  return errors
}

export function createEvidenceItem(
  params: Omit<EvidenceItem, 'id' | 'decay_rate'> & { decay_rate?: number }
): EvidenceItem {
  return {
    id: randomUUID(),
    decay_rate: params.decay_rate ?? DEFAULT_DECAY_RATES[params.type],
    ...params,
  }
}

export function extractEvidenceFromLLM(
  extractionResult: EvidenceExtractionResult
): EvidenceItem[] {
  const validated: EvidenceItem[] = []

  for (const item of extractionResult.evidence) {
    const errors = validateEvidenceItem(item)
    if (errors.length === 0) {
      validated.push(item)
    }
  }

  return validated
}

export function mergeEvidenceItems(
  existing: EvidenceItem[],
  newItems: EvidenceItem[]
): EvidenceItem[] {
  const combined = [...existing, ...newItems]
  const byMessageId = new Map<string, EvidenceItem[]>()

  for (const item of combined) {
    const key = `${item.message_id}:${item.type}`
    const group = byMessageId.get(key) ?? []
    group.push(item)
    byMessageId.set(key, group)
  }

  const merged: EvidenceItem[] = []
  for (const group of byMessageId.values()) {
    const best = group.reduce((a, b) =>
      a.confidence >= b.confidence ? a : b
    )
    merged.push(best)
  }

  return merged
}
