import type { ClosureStats } from './closure'
import type { DeliveryBusinessSettings } from './types'

export interface IncentiveTotals {
  gross: number
  driver_share: number
  goal_progress: number
  effectiveness_percent: number
  delivered: number
  total: number
}

export function computeIncentives(
  settings: Pick<DeliveryBusinessSettings, 'daily_goal_amount' | 'driver_share_percent'>,
  stats: ClosureStats
): IncentiveTotals {
  const gross = Math.round(stats.total_collected * 100) / 100
  const share =
    Math.round((gross * settings.driver_share_percent) / 100 * 100) / 100
  const goalProgress =
    settings.daily_goal_amount > 0 ? gross / settings.daily_goal_amount : 0
  const effectivenessPercent =
    stats.total_orders > 0
      ? Math.round((stats.delivered_count / stats.total_orders) * 1000) / 10
      : 0

  return {
    gross,
    driver_share: share,
    goal_progress: goalProgress,
    effectiveness_percent: effectivenessPercent,
    delivered: stats.delivered_count,
    total: stats.total_orders,
  }
}
