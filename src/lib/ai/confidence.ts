const HALF_LIFE_DAYS: Record<string, number> = {
  decision: 180,
  pattern: 90,
  experience: 60,
  insight: 120,
  trend: 45,
  mistake_prevention: 365,
}

const DECAY_FACTOR = 0.5
const CONFIDENCE_FLOOR = 10

export function calculateEffectiveConfidence(
  baseConfidence: number,
  memoryType: string,
  lastObservedAt: string | Date,
  referenceDate?: string | Date
): number {
  const now = referenceDate ? new Date(referenceDate) : new Date()
  const lastObserved = new Date(lastObservedAt)
  const daysSinceLastObserved = (now.getTime() - lastObserved.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceLastObserved <= 0) return baseConfidence

  const halfLife = HALF_LIFE_DAYS[memoryType] ?? 90

  const effective = baseConfidence * Math.pow(DECAY_FACTOR, daysSinceLastObserved / halfLife)

  return Math.round(Math.max(CONFIDENCE_FLOOR, Math.min(100, effective)))
}

export function isExpired(
  expiresAt: string | Date | null | undefined,
  referenceDate?: string | Date
): boolean {
  if (!expiresAt) return false
  const now = referenceDate ? new Date(referenceDate) : new Date()
  return new Date(expiresAt) <= now
}

export function getConfidenceBoostFactor(observationCount: number): number {
  if (observationCount <= 0) return 1
  if (observationCount >= 50) return 1.15
  if (observationCount >= 20) return 1.10
  if (observationCount >= 10) return 1.05
  return 1
}
