import { createAdminClient } from '@/lib/supabase/admin'

interface DailySales {
  date: string
  qty: number
}

interface ForecastResult {
  product_id: string
  product_name: string
  horizon_days: number
  forecast_qty: number
  baseline_qty: number
  model_used: 'exp_smoothing' | 'baseline'
  confidence: number
  lower_bound: number
  upper_bound: number
  mae_model: number
  mae_baseline: number
  accuracy_vs_baseline: number
  daily_rate: number
}

function exponentialSmoothing(
  series: number[],
  alpha: number = 0.3,
  beta: number = 0.1
): { level: number; trend: number } {
  if (series.length < 2) {
    return { level: series[0] ?? 0, trend: 0 }
  }

  let level = series[0]
  let trend = series[1] - series[0]

  for (let i = 1; i < series.length; i++) {
    const prevLevel = level
    level = alpha * series[i] + (1 - alpha) * (prevLevel + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
  }

  return { level, trend }
}

function movingAverage(series: number[], window: number = 30): number {
  const recent = series.slice(-window)
  if (recent.length === 0) return 0
  return recent.reduce((sum, v) => sum + v, 0) / recent.length
}

function computeMAE(
  actual: number[],
  forecastFn: (i: number) => number
): number {
  if (actual.length === 0) return Infinity
  let sum = 0
  for (let i = 0; i < actual.length; i++) {
    sum += Math.abs(actual[i] - forecastFn(i))
  }
  return sum / actual.length
}

export async function generateDemandForecasts(
  businessId: string,
  horizons: number[] = [7, 14, 30]
): Promise<ForecastResult[]> {
  const admin = createAdminClient()
  const results: ForecastResult[] = []

  const since90d = new Date()
  since90d.setDate(since90d.getDate() - 90)
  const since90dIso = since90d.toISOString()

  const { data: salesEvents } = await admin
    .from('sales_events')
    .select('product_id, amount, metadata, created_at')
    .eq('business_id', businessId)
    .eq('event_type', 'SALE_WON')
    .gte('created_at', since90dIso)
    .order('created_at', { ascending: true })

  if (!salesEvents || salesEvents.length === 0) {
    return []
  }

  const productSales = new Map<string, DailySales[]>()

  for (const event of salesEvents) {
    const pid = event.product_id
    if (!pid) continue

    const date = event.created_at.slice(0, 10)
    const items = (event.metadata as Record<string, unknown>)?.items
    let qty = 1
    if (Array.isArray(items)) {
      qty = items.reduce((sum: number, item: Record<string, unknown>) =>
        sum + ((item.quantity as number) ?? 1), 0)
    }

    const existing = productSales.get(pid) ?? []
    const dayEntry = existing.find((d) => d.date === date)
    if (dayEntry) {
      dayEntry.qty += qty
    } else {
      existing.push({ date, qty })
    }
    productSales.set(pid, existing)
  }

  const productIds = Array.from(productSales.keys())
  const { data: products } = await admin
    .from('products')
    .select('id, name')
    .in('id', productIds)

  const productMap = new Map((products ?? []).map((p) => [p.id, p.name]))

  for (const [pid, dailySales] of productSales) {
    const sorted = dailySales.sort((a, b) => a.date.localeCompare(b.date))

    const fullSeries: number[] = []
    const startDate = new Date(sorted[0].date)
    const endDate = new Date()
    const dayMs = 86400000

    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + dayMs)) {
      const dateStr = d.toISOString().slice(0, 10)
      const entry = sorted.find((s) => s.date === dateStr)
      fullSeries.push(entry?.qty ?? 0)
    }

    if (fullSeries.length < 14) continue

    const { level, trend } = exponentialSmoothing(fullSeries)
    const baseline = movingAverage(fullSeries, 30)

    const maeExpSmooth = computeMAE(fullSeries, (i) => {
      if (i < 2) return fullSeries[i]
      const { level: l, trend: t } = exponentialSmoothing(fullSeries.slice(0, i + 1))
      return l + t
    })

    const maeBaseline = computeMAE(fullSeries, () => baseline)

    const useExpSmooth = maeExpSmooth < maeBaseline

    const avgDaily = baseline
    const variance = fullSeries.reduce((sum, v) => sum + Math.pow(v - avgDaily, 2), 0) / fullSeries.length
    const stdDev = Math.sqrt(variance)

    for (const horizon of horizons) {
      const forecastQty = useExpSmooth
        ? Math.round((level + trend * horizon) * horizon)
        : Math.round(baseline * horizon)

      const confidence = avgDaily > 0
        ? Math.max(0, Math.min(1, 1 - (stdDev / (avgDaily + 1))))
        : 0

      const margin = 1.96 * stdDev * Math.sqrt(horizon)
      const lowerBound = Math.max(0, Math.round(forecastQty - margin))
      const upperBound = Math.round(forecastQty + margin)

      results.push({
        product_id: pid,
        product_name: productMap.get(pid) ?? 'Unknown',
        horizon_days: horizon,
        forecast_qty: forecastQty,
        baseline_qty: Math.round(baseline * horizon),
        model_used: useExpSmooth ? 'exp_smoothing' : 'baseline',
        confidence: Math.round(confidence * 1000) / 1000,
        lower_bound: lowerBound,
        upper_bound: upperBound,
        mae_model: Math.round(maeExpSmooth * 100) / 100,
        mae_baseline: Math.round(maeBaseline * 100) / 100,
        accuracy_vs_baseline: maeBaseline > 0
          ? Math.round((1 - maeExpSmooth / maeBaseline) * 1000) / 1000
          : 0,
        daily_rate: Math.round(avgDaily * 100) / 100,
      })
    }
  }

  return results
}
