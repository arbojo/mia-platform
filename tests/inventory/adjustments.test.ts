import { describe, it, expect } from 'vitest'
import { applyDelta } from '@/lib/inventory/adjustments'

describe('applyDelta', () => {
  it('returns the sum when the result is not negative', () => {
    expect(applyDelta(10, 5)).toBe(15)
    expect(applyDelta(10, -3)).toBe(7)
  })

  it('returns null when the result would be negative', () => {
    expect(applyDelta(2, -5)).toBeNull()
    expect(applyDelta(0, -1)).toBeNull()
  })

  it('accepts a zero-result delta', () => {
    expect(applyDelta(5, -5)).toBe(0)
  })
})
