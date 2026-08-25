import { describe, it, expect } from 'vitest'
import {
  createEvidenceItem,
  validateEvidenceItem,
  computeDecayedWeight,
  mergeEvidenceItems,
  extractEvidenceFromLLM,
  EVIDENCE_TYPES,
  DEFAULT_DECAY_RATES,
  type EvidenceItem,
} from '@/lib/reasoning/evidence'

describe('Evidence Item', () => {
  it('creates a valid evidence item with defaults', () => {
    const item = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-25T12:00:00Z',
      type: 'interest',
      weight: 0.6,
      confidence: 0.7,
    })
    expect(item.id).toBeDefined()
    expect(item.type).toBe('interest')
    expect(item.weight).toBe(0.6)
    expect(item.confidence).toBe(0.7)
    expect(item.decay_rate).toBe(DEFAULT_DECAY_RATES.interest)
  })

  it('allows custom decay_rate', () => {
    const item = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-25T12:00:00Z',
      type: 'trust',
      weight: 0.5,
      confidence: 0.5,
      decay_rate: 0.01,
    })
    expect(item.decay_rate).toBe(0.01)
  })
})

describe('Evidence Validation', () => {
  const validItem: EvidenceItem = {
    id: 'test-id',
    message_id: 'msg-1',
    conversation_id: 'conv-1',
    customer_id: 'cust-1',
    timestamp: '2026-08-25T12:00:00Z',
    type: 'interest',
    weight: 0.6,
    confidence: 0.7,
    decay_rate: 0.01,
    metadata: {},
  }

  it('validates a correct item', () => {
    expect(validateEvidenceItem(validItem)).toHaveLength(0)
  })

  it('rejects missing message_id', () => {
    const errors = validateEvidenceItem({ ...validItem, message_id: '' })
    expect(errors).toContain('missing message_id')
  })

  it('rejects missing conversation_id', () => {
    const errors = validateEvidenceItem({ ...validItem, conversation_id: '' })
    expect(errors).toContain('missing conversation_id')
  })

  it('rejects missing customer_id', () => {
    const errors = validateEvidenceItem({ ...validItem, customer_id: '' })
    expect(errors).toContain('missing customer_id')
  })

  it('rejects invalid type', () => {
    const errors = validateEvidenceItem({ ...validItem, type: 'invalid' as EvidenceItem['type'] })
    expect(errors).toContain('invalid type: invalid')
  })

  it('rejects weight out of range', () => {
    const errors = validateEvidenceItem({ ...validItem, weight: 1.5 })
    expect(errors).toContain('weight out of range: 1.5')
  })

  it('rejects confidence out of range', () => {
    const errors = validateEvidenceItem({ ...validItem, confidence: -0.1 })
    expect(errors).toContain('confidence out of range: -0.1')
  })

  it('rejects negative decay_rate', () => {
    const errors = validateEvidenceItem({ ...validItem, decay_rate: -1 })
    expect(errors).toContain('negative decay_rate: -1')
  })
})

describe('Time Decay', () => {
  it('computes full weight at time zero', () => {
    const item = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-25T12:00:00Z',
      type: 'interest',
      weight: 0.8,
      confidence: 0.9,
      decay_rate: Math.log(2) / 72,
    })
    const now = new Date('2026-08-25T12:00:00Z')
    const decayed = computeDecayedWeight(item, now)
    expect(decayed).toBeCloseTo(0.72, 1)
  })

  it('decays weight over time', () => {
    const item = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-25T12:00:00Z',
      type: 'interest',
      weight: 1.0,
      confidence: 1.0,
      decay_rate: Math.log(2) / 72,
    })
    const now = new Date('2026-08-28T12:00:00Z')
    const decayed = computeDecayedWeight(item, now)
    expect(decayed).toBeCloseTo(0.5, 1)
  })

  it('decays to near zero after many half-lives', () => {
    const item = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-10T12:00:00Z',
      type: 'interest',
      weight: 1.0,
      confidence: 1.0,
      decay_rate: Math.log(2) / 72,
    })
    const now = new Date('2026-08-25T12:00:00Z')
    const decayed = computeDecayedWeight(item, now)
    expect(decayed).toBeLessThan(0.1)
  })
})

describe('Evidence Merging', () => {
  it('merges evidence from same message, keeps higher confidence', () => {
    const base = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-25T12:00:00Z',
      type: 'interest',
      weight: 0.5,
      confidence: 0.6,
    })
    const better = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-25T12:00:00Z',
      type: 'interest',
      weight: 0.7,
      confidence: 0.9,
    })
    const merged = mergeEvidenceItems([base], [better])
    expect(merged).toHaveLength(1)
    expect(merged[0].confidence).toBe(0.9)
  })

  it('keeps different types from same message', () => {
    const interest = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-25T12:00:00Z',
      type: 'interest',
      weight: 0.5,
      confidence: 0.6,
    })
    const trust = createEvidenceItem({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      customer_id: 'cust-1',
      timestamp: '2026-08-25T12:00:00Z',
      type: 'trust',
      weight: 0.4,
      confidence: 0.5,
    })
    const merged = mergeEvidenceItems([], [interest, trust])
    expect(merged).toHaveLength(2)
  })
})

describe('LLM Extraction Validation', () => {
  it('filters out invalid evidence from LLM output', () => {
    const result = extractEvidenceFromLLM({
      evidence: [
        {
          id: '1',
          message_id: 'msg-1',
          conversation_id: 'conv-1',
          customer_id: 'cust-1',
          timestamp: '2026-08-25T12:00:00Z',
          type: 'interest',
          weight: 0.5,
          confidence: 0.5,
          decay_rate: 0.01,
          metadata: {},
        },
        {
          id: '2',
          message_id: '',
          conversation_id: 'conv-1',
          customer_id: 'cust-1',
          timestamp: '2026-08-25T12:00:00Z',
          type: 'interest',
          weight: 0.5,
          confidence: 0.5,
          decay_rate: 0.01,
          metadata: {},
        },
      ],
      extraction_method: 'test',
      extracted_at: '2026-08-25T12:00:00Z',
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('returns empty for all-invalid extraction', () => {
    const result = extractEvidenceFromLLM({
      evidence: [
        {
          id: '',
          message_id: '',
          conversation_id: '',
          customer_id: '',
          timestamp: '',
          type: 'invalid' as EvidenceItem['type'],
          weight: 5,
          confidence: 5,
          decay_rate: -1,
          metadata: {},
        },
      ],
      extraction_method: 'test',
      extracted_at: '2026-08-25T12:00:00Z',
    })
    expect(result).toHaveLength(0)
  })
})
