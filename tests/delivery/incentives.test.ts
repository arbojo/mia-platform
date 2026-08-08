import { describe, it, expect } from 'vitest'
import { computeIncentives } from '@/lib/delivery/incentives'
import type { ClosureStats } from '@/lib/delivery/closure'

const emptyStats: ClosureStats = {
  total_orders: 0,
  delivered_count: 0,
  incidence_count: 0,
  revisit_count: 0,
  total_collected: 0,
  pending_count: 0,
}

describe('computeIncentives', () => {
  it('computes the driver share from the collected gross', () => {
    const result = computeIncentives(
      { daily_goal_amount: 1000, driver_share_percent: 10 },
      { ...emptyStats, total_collected: 500 }
    )
    expect(result.gross).toBe(500)
    expect(result.driver_share).toBe(50)
  })

  it('rounds the driver share to 2 decimals', () => {
    const result = computeIncentives(
      { daily_goal_amount: 1000, driver_share_percent: 7 },
      { ...emptyStats, total_collected: 333.33 }
    )
    expect(result.driver_share).toBe(23.33)
  })

  it('computes goal progress as a fraction of the daily goal', () => {
    const result = computeIncentives(
      { daily_goal_amount: 2000, driver_share_percent: 10 },
      { ...emptyStats, total_collected: 1000 }
    )
    expect(result.goal_progress).toBe(0.5)
  })

  it('returns 0 goal progress when the daily goal is 0', () => {
    const result = computeIncentives(
      { daily_goal_amount: 0, driver_share_percent: 10 },
      { ...emptyStats, total_collected: 800 }
    )
    expect(result.goal_progress).toBe(0)
  })

  it('computes effectiveness percentage with one decimal', () => {
    const result = computeIncentives(
      { daily_goal_amount: 1000, driver_share_percent: 10 },
      { ...emptyStats, total_orders: 3, delivered_count: 2 }
    )
    expect(result.effectiveness_percent).toBe(66.7)
  })

  it('returns 0 effectiveness when there are no orders', () => {
    const result = computeIncentives(
      { daily_goal_amount: 1000, driver_share_percent: 10 },
      emptyStats
    )
    expect(result.effectiveness_percent).toBe(0)
    expect(result.driver_share).toBe(0)
  })
})
