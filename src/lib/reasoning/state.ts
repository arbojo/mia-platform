import type { EvidenceItem, EvidenceDimension } from './evidence'
import { computeDecayedWeight, getDimensionForEvidence, EVIDENCE_DIMENSIONS } from './evidence'

export interface CustomerState {
  interest: number
  trust: number
  readiness: number
  clarity: number
  engagement: number
  last_updated: string
  evidence_count: number
}

export interface StateContribution {
  dimension: EvidenceDimension
  value: number
  evidence_id: string
}

export const CLOSE_GATE = {
  readiness: 0.7,
  trust: 0.6,
  interest: 0.6,
} as const

export const UNCERTAINTY_ZONE = {
  low: 0.3,
  high: 0.7,
} as const

export const PUSH_PREVENTION = {
  readiness_max: 0.5,
  trust_max: 0.4,
} as const

export const STATE_MOMENTUM = {
  new_weight: 0.7,
  previous_weight: 0.3,
} as const

export function createInitialState(): CustomerState {
  return {
    interest: 0.5,
    trust: 0.5,
    readiness: 0.5,
    clarity: 0.5,
    engagement: 0.5,
    last_updated: new Date().toISOString(),
    evidence_count: 0,
  }
}

export function computeStateContributions(evidence: EvidenceItem[]): StateContribution[] {
  const contributions: StateContribution[] = []
  const now = new Date()

  for (const item of evidence) {
    const dimension = getDimensionForEvidence(item.type)
    if (!dimension) continue

    const value = computeDecayedWeight(item, now)
    contributions.push({
      dimension,
      value,
      evidence_id: item.id,
    })
  }

  return contributions
}

export function aggregateStateFromContributions(
  contributions: StateContribution[]
): Pick<CustomerState, EvidenceDimension> {
  const sums: Record<EvidenceDimension, number> = {
    interest: 0,
    trust: 0,
    readiness: 0,
    clarity: 0,
    engagement: 0,
  }
  const counts: Record<EvidenceDimension, number> = {
    interest: 0,
    trust: 0,
    readiness: 0,
    clarity: 0,
    engagement: 0,
  }

  for (const c of contributions) {
    sums[c.dimension] += c.value
    counts[c.dimension] += 1
  }

  const result: Record<string, number> = {}
  for (const dim of EVIDENCE_DIMENSIONS) {
    if (counts[dim] > 0) {
      const raw = sums[dim] / counts[dim]
      result[dim] = clamp(Math.min(1.0, raw * 2))
    } else {
      result[dim] = 0.5
    }
  }

  return result as Pick<CustomerState, EvidenceDimension>
}

export function applyMomentum(
  previous: CustomerState,
  newContributions: StateContribution[]
): CustomerState {
  const newRaw = aggregateStateFromContributions(newContributions)
  const count = newContributions.length

  const result: CustomerState = {
    interest: 0.5,
    trust: 0.5,
    readiness: 0.5,
    clarity: 0.5,
    engagement: 0.5,
    last_updated: new Date().toISOString(),
    evidence_count: previous.evidence_count + count,
  }

  for (const dim of EVIDENCE_DIMENSIONS) {
    if (count > 0) {
      result[dim] = clamp(
        newRaw[dim] * STATE_MOMENTUM.new_weight +
        previous[dim] * STATE_MOMENTUM.previous_weight
      )
    } else {
      result[dim] = previous[dim]
    }
  }

  return result
}

export function computeCustomerState(
  previousState: CustomerState,
  evidence: EvidenceItem[]
): CustomerState {
  const contributions = computeStateContributions(evidence)
  return applyMomentum(previousState, contributions)
}

export function isCloseAllowed(state: CustomerState): boolean {
  return (
    state.readiness > CLOSE_GATE.readiness &&
    state.trust > CLOSE_GATE.trust &&
    state.interest > CLOSE_GATE.interest
  )
}

export function isPushPrevented(state: CustomerState): {
  noClose: boolean
  noPersonalData: boolean
  noCommitment: boolean
} {
  return {
    noClose: state.readiness < PUSH_PREVENTION.readiness_max,
    noPersonalData: state.readiness < PUSH_PREVENTION.readiness_max,
    noCommitment: state.trust < PUSH_PREVENTION.trust_max,
  }
}

export function isInUncertaintyZone(state: CustomerState): boolean {
  return EVIDENCE_DIMENSIONS.every(
    (dim) => state[dim] >= UNCERTAINTY_ZONE.low && state[dim] <= UNCERTAINTY_ZONE.high
  )
}

export function validateCustomerState(state: CustomerState): string[] {
  const errors: string[] = []

  for (const dim of EVIDENCE_DIMENSIONS) {
    if (state[dim] < 0 || state[dim] > 1) {
      errors.push(`${dim} out of range: ${state[dim]}`)
    }
  }

  if (state.evidence_count < 0) {
    errors.push(`negative evidence_count: ${state.evidence_count}`)
  }

  return errors
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
