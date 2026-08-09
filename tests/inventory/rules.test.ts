import { describe, it, expect } from 'vitest'
import {
  stockStatus,
  daysSince,
  unitsSoldInWindow,
  computeSuggestedQty,
  buildRestockReason,
} from '@/lib/inventory/rules'

describe('stockStatus', () => {
  it('returns out when quantity is zero or negative', () => {
    expect(stockStatus(0, 5)).toBe('out')
    expect(stockStatus(-3, 5)).toBe('out')
  })

  it('returns low when quantity is within the threshold', () => {
    expect(stockStatus(5, 5)).toBe('low')
    expect(stockStatus(1, 5)).toBe('low')
  })

  it('returns ok when quantity exceeds the threshold', () => {
    expect(stockStatus(6, 5)).toBe('ok')
  })
})

describe('daysSince', () => {
  it('returns null when there was no sale', () => {
    expect(daysSince(null)).toBeNull()
  })

  it('returns 0 for a recent sale', () => {
    expect(daysSince(new Date().toISOString())).toBe(0)
  })

  it('returns the elapsed days for an older sale', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    expect(daysSince(threeDaysAgo)).toBe(3)
  })
})

describe('unitsSoldInWindow', () => {
  const now = Date.now()
  const sales = [
    { created_at: new Date(now - 1 * 86_400_000).toISOString(), quantity: 2 },
    { created_at: new Date(now - 10 * 86_400_000).toISOString(), quantity: 5 },
  ]

  it('sums only the sales inside the window', () => {
    expect(unitsSoldInWindow(sales, 7, now)).toBe(2)
    expect(unitsSoldInWindow(sales, 30, now)).toBe(7)
  })

  it('ignores negative quantities', () => {
    expect(unitsSoldInWindow([{ created_at: new Date(now).toISOString(), quantity: -4 }], 7, now)).toBe(0)
  })
})

describe('computeSuggestedQty', () => {
  it('computes restock from daily velocity and lead time minus current stock', () => {
    expect(computeSuggestedQty({ velocity7d: 14, leadTimeDays: 3, quantity: 0, threshold: 5 })).toBe(6)
  })

  it('never suggests less than the threshold', () => {
    expect(computeSuggestedQty({ velocity7d: 0, leadTimeDays: 3, quantity: 2, threshold: 5 })).toBe(5)
  })
})

describe('buildRestockReason', () => {
  it('flags low stock and carries the suggested quantity', () => {
    const reason = buildRestockReason({
      quantity: 2,
      threshold: 5,
      daysOut: 1,
      velocity7d: 7,
      velocity30d: 30,
      leadTimeDays: 3,
    })
    expect(reason.low_stock).toBe(true)
    expect(reason.days_out).toBe(1)
    expect(reason.velocity7d).toBe(7)
    expect(reason.velocity30d).toBe(30)
    expect(reason.suggested_qty).toBe(5)
  })

  it('does not flag low stock above the threshold', () => {
    const reason = buildRestockReason({
      quantity: 20,
      threshold: 5,
      daysOut: null,
      velocity7d: 0,
      velocity30d: 0,
      leadTimeDays: 3,
    })
    expect(reason.low_stock).toBe(false)
    expect(reason.suggested_qty).toBe(5)
  })
})
