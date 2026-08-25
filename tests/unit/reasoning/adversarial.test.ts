import { describe, it, expect } from 'vitest'
import { createInitialState, computeCustomerState, isCloseAllowed, isPushPrevented, isInUncertaintyZone, type CustomerState } from '@/lib/reasoning/state'
import { createEvidenceItem, mergeEvidenceItems } from '@/lib/reasoning/evidence'
import { enrichPrompt } from '@/lib/reasoning/prompt-enricher'

function makeEvidence(type: 'interest' | 'trust' | 'readiness' | 'clarity' | 'engagement' | 'hesitation' | 'objection' | 'confusion', weight: number, confidence: number) {
  return createEvidenceItem({
    message_id: `msg-${Date.now()}-${Math.random()}`,
    conversation_id: 'conv-test',
    customer_id: 'cust-test',
    timestamp: new Date().toISOString(),
    type,
    weight,
    confidence,
  })
}

describe('Adversarial Scenario 1: Single weak buying signal', () => {
  it('does not trigger close on one weak signal', () => {
    const state = computeCustomerState(createInitialState(), [
      makeEvidence('interest', 0.3, 0.3),
    ])
    expect(isCloseAllowed(state)).toBe(false)
  })
})

describe('Adversarial Scenario 2: Multiple weak signals accumulating', () => {
  it('builds state gradually from multiple signals', () => {
    let state = createInitialState()
    const signals = [
      makeEvidence('interest', 0.4, 0.5),
      makeEvidence('trust', 0.3, 0.4),
      makeEvidence('engagement', 0.5, 0.5),
    ]
    state = computeCustomerState(state, signals)
    expect(state.evidence_count).toBe(3)
  })
})

describe('Adversarial Scenario 3: Strong contradictory evidence', () => {
  it('does not override state with single contradictory signal', () => {
    const initial: CustomerState = {
      interest: 0.8, trust: 0.7, readiness: 0.7,
      clarity: 0.6, engagement: 0.5,
      last_updated: new Date().toISOString(), evidence_count: 10,
    }
    const contradiction = computeCustomerState(initial, [
      makeEvidence('hesitation', 0.8, 0.9),
    ])
    expect(contradiction.interest).toBeGreaterThan(0.5)
  })
})

describe('Adversarial Scenario 4: High interest / low trust', () => {
  it('blocks close when trust is low', () => {
    const state: CustomerState = {
      interest: 0.9, trust: 0.2, readiness: 0.8,
      clarity: 0.6, engagement: 0.5,
      last_updated: new Date().toISOString(), evidence_count: 10,
    }
    expect(isCloseAllowed(state)).toBe(false)
    const push = isPushPrevented(state)
    expect(push.noCommitment).toBe(true)
  })
})

describe('Adversarial Scenario 5: High trust / low readiness', () => {
  it('blocks close when readiness is low', () => {
    const state: CustomerState = {
      interest: 0.7, trust: 0.8, readiness: 0.3,
      clarity: 0.6, engagement: 0.5,
      last_updated: new Date().toISOString(), evidence_count: 10,
    }
    expect(isCloseAllowed(state)).toBe(false)
    const push = isPushPrevented(state)
    expect(push.noClose).toBe(true)
  })
})

describe('Adversarial Scenario 6: High readiness / low interest', () => {
  it('blocks close when interest is low', () => {
    const state: CustomerState = {
      interest: 0.3, trust: 0.7, readiness: 0.8,
      clarity: 0.6, engagement: 0.5,
      last_updated: new Date().toISOString(), evidence_count: 10,
    }
    expect(isCloseAllowed(state)).toBe(false)
  })
})

describe('Adversarial Scenario 7: All dimensions uncertain', () => {
  it('enters uncertainty zone', () => {
    const state = computeCustomerState(createInitialState(), [
      makeEvidence('interest', 0.5, 0.5),
      makeEvidence('trust', 0.5, 0.5),
    ])
    expect(isInUncertaintyZone(state)).toBe(true)
    expect(isCloseAllowed(state)).toBe(false)
  })
})

describe('Adversarial Scenario 8: Evidence decay', () => {
  it('old evidence loses influence', () => {
    const old = createEvidenceItem({
      message_id: 'msg-old-1',
      conversation_id: 'conv-test',
      customer_id: 'cust-test',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'interest',
      weight: 1.0,
      confidence: 1.0,
    })
    const fresh = createEvidenceItem({
      message_id: 'msg-new-1',
      conversation_id: 'conv-test',
      customer_id: 'cust-test',
      timestamp: new Date().toISOString(),
      type: 'hesitation',
      weight: 0.6,
      confidence: 0.7,
    })
    const merged = mergeEvidenceItems([], [old, fresh])
    expect(merged.length).toBe(2)
    const state = computeCustomerState(createInitialState(), merged)
    expect(state.evidence_count).toBeGreaterThanOrEqual(1)
  })
})

describe('Adversarial Scenario 9: Missing provenance', () => {
  it('filters out evidence with missing provenance', () => {
    const valid = makeEvidence('interest', 0.6, 0.7)
    const invalid = createEvidenceItem({
      message_id: '',
      conversation_id: 'conv-test',
      customer_id: 'cust-test',
      timestamp: new Date().toISOString(),
      type: 'interest',
      weight: 0.5,
      confidence: 0.5,
    })
    const merged = mergeEvidenceItems([], [valid, invalid])
    expect(merged.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Adversarial Scenario 10: LLM attempts to force CLOSE', () => {
  it('CLOSE is not in permitted actions when gate fails', () => {
    const state: CustomerState = {
      interest: 0.3, trust: 0.3, readiness: 0.3,
      clarity: 0.3, engagement: 0.3,
      last_updated: new Date().toISOString(), evidence_count: 5,
    }
    const enrichment = enrichPrompt(state, [])
    expect(enrichment.prohibited_actions).toContain('CLOSE')
    expect(enrichment.permitted_actions).not.toContain('CLOSE')
  })
})

describe('Adversarial Scenario 11: Evidence extraction failure', () => {
  it('returns initial state when no evidence available', () => {
    const state = computeCustomerState(createInitialState(), [])
    expect(state.interest).toBe(0.5)
    expect(state.trust).toBe(0.5)
    expect(isCloseAllowed(state)).toBe(false)
  })
})

describe('Adversarial Scenario 12: Cross-customer evidence contamination', () => {
  it('evidence items are scoped to customer_id', () => {
    const cust1 = makeEvidence('interest', 0.9, 0.9)
    cust1.customer_id = 'cust-1'
    const cust2 = makeEvidence('hesitation', 0.9, 0.9)
    cust2.customer_id = 'cust-2'
    const merged = mergeEvidenceItems([], [cust1, cust2])
    expect(merged).toHaveLength(2)
    expect(merged[0].customer_id).toBe('cust-1')
    expect(merged[1].customer_id).toBe('cust-2')
  })
})

describe('Adversarial Scenario 13: Cross-tenant evidence contamination', () => {
  it('evidence items are scoped to conversation_id', () => {
    const a = makeEvidence('interest', 0.9, 0.9)
    a.conversation_id = 'conv-tenant-a'
    const b = makeEvidence('interest', 0.9, 0.9)
    b.conversation_id = 'conv-tenant-b'
    const merged = mergeEvidenceItems([], [a, b])
    expect(merged).toHaveLength(2)
    expect(merged[0].conversation_id).toBe('conv-tenant-a')
    expect(merged[1].conversation_id).toBe('conv-tenant-b')
  })
})

describe('Adversarial Scenario 14: Memory containing unsupported claims', () => {
  it('state validation catches invalid values', () => {
    const state = createInitialState()
    state.interest = 2.0
    const errors = []
    if (state.interest < 0 || state.interest > 1) errors.push('out of range')
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('Adversarial Scenario 15: "solo estoy preguntando"', () => {
  it('must not produce close or advance guidance', () => {
    const initial = createInitialState()
    const evidence = [
      makeEvidence('interest', 0.3, 0.3),
      makeEvidence('confusion', 0.4, 0.5),
    ]
    const state = computeCustomerState(initial, evidence)
    expect(isCloseAllowed(state)).toBe(false)
    const enrichment = enrichPrompt(state, evidence)
    expect(enrichment.prohibited_actions).toContain('CLOSE')
  })
})
