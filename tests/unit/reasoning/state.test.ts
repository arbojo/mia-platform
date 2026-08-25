import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  computeCustomerState,
  isCloseAllowed,
  isPushPrevented,
  isInUncertaintyZone,
  validateCustomerState,
  CLOSE_GATE,
  PUSH_PREVENTION,
  type CustomerState,
} from '@/lib/reasoning/state'
import { createEvidenceItem } from '@/lib/reasoning/evidence'

describe('Initial State', () => {
  it('creates state with all dimensions at 0.5', () => {
    const state = createInitialState()
    expect(state.interest).toBe(0.5)
    expect(state.trust).toBe(0.5)
    expect(state.readiness).toBe(0.5)
    expect(state.clarity).toBe(0.5)
    expect(state.engagement).toBe(0.5)
    expect(state.evidence_count).toBe(0)
  })
})

describe('State Computation', () => {
  it('moves state toward evidence direction', () => {
    const initial = createInitialState()
    const evidence = [
      createEvidenceItem({
        message_id: 'msg-1',
        conversation_id: 'conv-1',
        customer_id: 'cust-1',
        timestamp: new Date().toISOString(),
        type: 'interest',
        weight: 0.9,
        confidence: 0.9,
      }),
    ]
    const result = computeCustomerState(initial, evidence)
    expect(result.interest).toBeGreaterThan(0.5)
  })

  it('preserves previous state with momentum', () => {
    const previous: CustomerState = {
      interest: 0.8,
      trust: 0.7,
      readiness: 0.6,
      clarity: 0.5,
      engagement: 0.4,
      last_updated: new Date().toISOString(),
      evidence_count: 10,
    }
    const evidence = [
      createEvidenceItem({
        message_id: 'msg-1',
        conversation_id: 'conv-1',
        customer_id: 'cust-1',
        timestamp: new Date().toISOString(),
        type: 'interest',
        weight: 0.8,
        confidence: 0.9,
      }),
    ]
    const result = computeCustomerState(previous, evidence)
    expect(result.interest).toBeGreaterThanOrEqual(0.5)
    expect(result.interest).toBeLessThanOrEqual(1.0)
  })

  it('maintains state with no new evidence', () => {
    const previous: CustomerState = {
      interest: 0.7,
      trust: 0.6,
      readiness: 0.5,
      clarity: 0.4,
      engagement: 0.3,
      last_updated: new Date().toISOString(),
      evidence_count: 5,
    }
    const result = computeCustomerState(previous, [])
    expect(result.interest).toBe(0.7)
    expect(result.trust).toBe(0.6)
  })
})

describe('CLOSE Gate', () => {
  it('allows close when all conditions met', () => {
    const state: CustomerState = {
      interest: 0.8,
      trust: 0.7,
      readiness: 0.8,
      clarity: 0.6,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 10,
    }
    expect(isCloseAllowed(state)).toBe(true)
  })

  it('blocks close when readiness too low', () => {
    const state: CustomerState = {
      interest: 0.8,
      trust: 0.7,
      readiness: 0.5,
      clarity: 0.6,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 10,
    }
    expect(isCloseAllowed(state)).toBe(false)
  })

  it('blocks close when trust too low', () => {
    const state: CustomerState = {
      interest: 0.8,
      trust: 0.4,
      readiness: 0.8,
      clarity: 0.6,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 10,
    }
    expect(isCloseAllowed(state)).toBe(false)
  })

  it('blocks close when interest too low', () => {
    const state: CustomerState = {
      interest: 0.4,
      trust: 0.7,
      readiness: 0.8,
      clarity: 0.6,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 10,
    }
    expect(isCloseAllowed(state)).toBe(false)
  })
})

describe('Push Prevention', () => {
  it('prevents close when readiness < 0.5', () => {
    const state: CustomerState = {
      interest: 0.8,
      trust: 0.7,
      readiness: 0.3,
      clarity: 0.6,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 10,
    }
    const push = isPushPrevented(state)
    expect(push.noClose).toBe(true)
    expect(push.noPersonalData).toBe(true)
  })

  it('prevents commitment when trust < 0.4', () => {
    const state: CustomerState = {
      interest: 0.8,
      trust: 0.2,
      readiness: 0.7,
      clarity: 0.6,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 10,
    }
    const push = isPushPrevented(state)
    expect(push.noCommitment).toBe(true)
  })

  it('allows normal actions when state is high', () => {
    const state: CustomerState = {
      interest: 0.8,
      trust: 0.7,
      readiness: 0.7,
      clarity: 0.6,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 10,
    }
    const push = isPushPrevented(state)
    expect(push.noClose).toBe(false)
    expect(push.noPersonalData).toBe(false)
    expect(push.noCommitment).toBe(false)
  })
})

describe('Uncertainty Zone', () => {
  it('detects uncertainty when all dimensions in 0.3-0.7', () => {
    const state: CustomerState = {
      interest: 0.5,
      trust: 0.5,
      readiness: 0.5,
      clarity: 0.5,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 5,
    }
    expect(isInUncertaintyZone(state)).toBe(true)
  })

  it('detects non-uncertainty when dimension is high', () => {
    const state: CustomerState = {
      interest: 0.8,
      trust: 0.5,
      readiness: 0.5,
      clarity: 0.5,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 5,
    }
    expect(isInUncertaintyZone(state)).toBe(false)
  })

  it('detects non-uncertainty when dimension is low', () => {
    const state: CustomerState = {
      interest: 0.5,
      trust: 0.2,
      readiness: 0.5,
      clarity: 0.5,
      engagement: 0.5,
      last_updated: new Date().toISOString(),
      evidence_count: 5,
    }
    expect(isInUncertaintyZone(state)).toBe(false)
  })
})

describe('State Validation', () => {
  it('validates correct state', () => {
    const state = createInitialState()
    expect(validateCustomerState(state)).toHaveLength(0)
  })

  it('rejects out-of-range dimension', () => {
    const state = createInitialState()
    state.interest = 1.5
    const errors = validateCustomerState(state)
    expect(errors).toContain('interest out of range: 1.5')
  })

  it('rejects negative evidence count', () => {
    const state = createInitialState()
    state.evidence_count = -1
    const errors = validateCustomerState(state)
    expect(errors).toContain('negative evidence_count: -1')
  })
})

describe('Adversarial: "solo estoy preguntando"', () => {
  it('must not produce close guidance for pure inquiry', () => {
    const initial = createInitialState()
    const evidence = [
      createEvidenceItem({
        message_id: 'msg-1',
        conversation_id: 'conv-1',
        customer_id: 'cust-1',
        timestamp: new Date().toISOString(),
        type: 'interest',
        weight: 0.3,
        confidence: 0.3,
      }),
      createEvidenceItem({
        message_id: 'msg-2',
        conversation_id: 'conv-1',
        customer_id: 'cust-1',
        timestamp: new Date().toISOString(),
        type: 'confusion',
        weight: 0.4,
        confidence: 0.5,
      }),
    ]
    const state = computeCustomerState(initial, evidence)
    expect(isCloseAllowed(state)).toBe(false)
  })
})
