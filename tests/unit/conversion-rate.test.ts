import { describe, it, expect } from 'vitest'
import { calculateConversionRate } from '@/lib/dashboard/queries'

type Row = { outcome: string | null; sales_cancelled_at: string | null }

const row = (outcome: string | null, cancelled: string | null = null): Row => ({
  outcome,
  sales_cancelled_at: cancelled,
})

describe('calculateConversionRate', () => {
  it('returns 0 with no conversations', () => {
    expect(calculateConversionRate(null)).toBe(0)
    expect(calculateConversionRate([])).toBe(0)
  })

  it('counts sold conversations that were not cancelled', () => {
    const rows: Row[] = [row('sold'), row('pending'), row('interested'), row('sold')]
    expect(calculateConversionRate(rows)).toBe(50)
  })

  it('does not count a cancelled sale as successful conversion', () => {
    const rows: Row[] = [
      row('sold', '2026-08-24T10:00:00Z'),
      row('pending'),
      row('pending'),
      row('sold'),
    ]
    expect(calculateConversionRate(rows)).toBe(25)
  })

  it('counts every conversation in the denominator, including cancelled ones', () => {
    const rows: Row[] = [
      row('sold', '2026-08-24T10:00:00Z'),
      row('sold', '2026-08-24T11:00:00Z'),
      row('sold'),
    ]
    expect(calculateConversionRate(rows)).toBe(33.3)
  })

  it('ignores non-sold outcomes regardless of cancellation state', () => {
    const rows: Row[] = [
      row('interested', '2026-08-24T10:00:00Z'),
      row('not_interested'),
      row('needs_follow_up'),
      row(null),
    ]
    expect(calculateConversionRate(rows)).toBe(0)
  })
})
