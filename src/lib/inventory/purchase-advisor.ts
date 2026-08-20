import { createAdminClient } from '@/lib/supabase/admin'
import { generateDemandForecasts } from './forecasting'

interface PurchaseRecommendation {
  product_id: string
  product_name: string
  current_qty: number
  reorder_point: number
  lead_time_days: number
  daily_velocity: number
  velocity_7d: number
  velocity_30d: number
  forecast_qty_7d: number
  forecast_qty_30d: number
  forecast_model: string
  stockout_risk: number
  margin_pct: number
  unit_cost: number
  estimated_cost: number
  suggested_qty: number
  priority_score: number
  priority_rank: number
  reasoning: {
    stock_level: string
    velocity_trend: string
    margin_status: string
    stockout_warning: string
    forecast_note: string
    budget_impact: string
  }
}

interface BudgetStatus {
  monthly_budget: number | null
  current_spend: number
  remaining_budget: number
  recommendations: PurchaseRecommendation[]
  total_estimated_cost: number
  items_funded: number
  items_unfunded: number
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

function computeStockoutRisk(
  currentQty: number,
  reorderPoint: number,
  leadTimeDays: number,
  dailyVelocity: number
): number {
  if (dailyVelocity === 0) return 0

  const daysOfStock = currentQty / dailyVelocity
  const coverageRatio = daysOfStock / (leadTimeDays + 7)

  if (coverageRatio <= 0) return 1.0
  if (coverageRatio >= 1) return Math.max(0, 1 - coverageRatio * 0.5)
  return 1 - coverageRatio
}

function buildReasoning(
  rec: Omit<PurchaseRecommendation, 'reasoning' | 'priority_score' | 'priority_rank'>
): PurchaseRecommendation['reasoning'] {
  const stockLevel = rec.current_qty === 0
    ? 'SIN STOCK — utterly out of stock'
    : rec.current_qty <= rec.reorder_point
    ? `Below ROP (${rec.current_qty} <= ${rec.reorder_point})`
    : `Healthy (${rec.current_qty} units, ROP: ${rec.reorder_point})`

  const velocityTrend = rec.velocity_7d > rec.velocity_30d * 1.2
    ? 'Accelerating — 7d velocity > 30d average by 20%+'
    : rec.velocity_7d < rec.velocity_30d * 0.8
    ? 'Decelerating — 7d velocity < 30d average by 20%+'
    : 'Stable — velocity consistent with 30d trend'

  const marginStatus = rec.margin_pct >= 30
    ? `Healthy margin (${rec.margin_pct}%)`
    : rec.margin_pct >= 15
    ? `Moderate margin (${rec.margin_pct}%) — review pricing`
    : rec.margin_pct < 15
    ? `Low margin (${rec.margin_pct}%) — consider repricing or discontinuing`
    : `No margin data — verify cost registration`

  const stockoutWarning = rec.stockout_risk >= 0.8
    ? `HIGH RISK — ${Math.round(rec.stockout_risk * 100)}% stockout probability within lead time`
    : rec.stockout_risk >= 0.5
    ? `MODERATE RISK — ${Math.round(rec.stockout_risk * 100)}% stockout probability`
    : `LOW RISK — ${Math.round(rec.stockout_risk * 100)}% stockout probability`

  const forecastNote = rec.forecast_model === 'exp_smoothing'
    ? `Forecast: ${rec.forecast_qty_7d} units in 7d, ${rec.forecast_qty_30d} in 30d (exponential smoothing)`
    : `Forecast: ${rec.forecast_qty_7d} units in 7d, ${rec.forecast_qty_30d} in 30d (30d moving average baseline)`

  const budgetImpact = `Estimated cost: $${rec.estimated_cost.toFixed(2)} (${rec.suggested_qty} units × $${rec.unit_cost.toFixed(2)}/unit)`

  return {
    stock_level: stockLevel,
    velocity_trend: velocityTrend,
    margin_status: marginStatus,
    stockout_warning: stockoutWarning,
    forecast_note: forecastNote,
    budget_impact: budgetImpact,
  }
}

export async function generatePurchaseRecommendations(
  businessId: string
): Promise<BudgetStatus> {
  const admin = createAdminClient()

  const { data: settings } = await admin
    .from('inventory.business_settings')
    .select('*')
    .eq('business_id', businessId)
    .single()

  const leadTimeDays = settings?.lead_time_days ?? 3
  const safetyStockDays = settings?.safety_stock_days ?? 2
  const monthlyBudget = settings?.monthly_purchase_budget ?? null

  const { data: assets } = await admin
    .from('inventory.assets')
    .select('id, name, code, current_qty, min_qty, max_qty, unit_cost, is_active')
    .eq('business_id', businessId)
    .eq('is_active', true)

  if (!assets || assets.length === 0) {
    return {
      monthly_budget: monthlyBudget,
      current_spend: 0,
      remaining_budget: monthlyBudget ?? Infinity,
      recommendations: [],
      total_estimated_cost: 0,
      items_funded: 0,
      items_unfunded: 0,
    }
  }

  const { data: assetProducts } = await admin
    .from('inventory.asset_products')
    .select('asset_id, product_id')
    .eq('business_id', businessId)

  const assetProductMap = new Map(
    (assetProducts ?? []).map((ap) => [ap.asset_id, ap.product_id])
  )

  const since30d = new Date()
  since30d.setDate(since30d.getDate() - 30)
  const since7d = new Date()
  since7d.setDate(since7d.getDate() - 7)

  const { data: sales30d } = await admin
    .from('sales_events')
    .select('product_id, amount, metadata, created_at')
    .eq('business_id', businessId)
    .eq('event_type', 'SALE_WON')
    .gte('created_at', since30d.toISOString())

  const velocityMap = new Map<string, { v7d: number; v30d: number; revenue30d: number }>()

  for (const event of sales30d ?? []) {
    const pid = event.product_id
    if (!pid) continue

    const items = (event.metadata as Record<string, unknown>)?.items
    let qty = 1
    if (Array.isArray(items)) {
      qty = items.reduce((sum: number, item: Record<string, unknown>) =>
        sum + ((item.quantity as number) ?? 1), 0)
    }

    const existing = velocityMap.get(pid) ?? { v7d: 0, v30d: 0, revenue30d: 0 }
    existing.v30d += qty
    existing.revenue30d += Number(event.amount ?? 0)

    if (new Date(event.created_at) >= since7d) {
      existing.v7d += qty
    }

    velocityMap.set(pid, existing)
  }

  const forecasts = await generateDemandForecasts(businessId, [7, 30])

  const forecastMap = new Map<string, { f7d: number; f30d: number; model: string }>()
  for (const f of forecasts) {
    const existing = forecastMap.get(f.product_id) ?? { f7d: 0, f30d: 0, model: f.model_used }
    if (f.horizon_days === 7) existing.f7d = f.forecast_qty
    if (f.horizon_days === 30) existing.f30d = f.forecast_qty
    existing.model = f.model_used
    forecastMap.set(f.product_id, existing)
  }

  const currentMonth = new Date().toISOString().slice(0, 7)
  const { data: currentSpend } = await admin
    .from('inventory.purchase_orders')
    .select('estimated_cost')
    .eq('business_id', businessId)
    .in('status', ['ordered', 'in_transit', 'received'])
    .gte('created_at', `${currentMonth}-01T00:00:00Z`)

  const currentSpendTotal = (currentSpend ?? [])
    .reduce((sum, po) => sum + Number(po.estimated_cost ?? 0), 0)

  const recommendations: PurchaseRecommendation[] = []

  for (const asset of assets) {
    const productId = assetProductMap.get(asset.id)
    if (!productId) continue

    const velocity = velocityMap.get(productId) ?? { v7d: 0, v30d: 0, revenue30d: 0 }
    const forecast = forecastMap.get(productId)
    const dailyVelocity = velocity.v7d > 0
      ? velocity.v7d / 7
      : velocity.v30d > 0
      ? velocity.v30d / 30
      : 0

    const reorderPoint = Math.ceil(dailyVelocity * (leadTimeDays + safetyStockDays))
    const suggestedQty = Math.max(0, reorderPoint - (asset.current_qty ?? 0))
    const unitCost = asset.unit_cost ?? 0
    const estimatedCost = suggestedQty * unitCost

    const stockoutRisk = computeStockoutRisk(
      asset.current_qty ?? 0,
      reorderPoint,
      leadTimeDays,
      dailyVelocity
    )

    const marginPct = velocity.revenue30d > 0
      ? Math.round(((velocity.revenue30d - unitCost * velocity.v30d) / velocity.revenue30d) * 1000) / 10
      : 0

    if (suggestedQty <= 0 && dailyVelocity === 0) continue

    const recBase: Omit<PurchaseRecommendation, 'reasoning' | 'priority_score' | 'priority_rank'> = {
      product_id: productId,
      product_name: asset.name ?? 'Unknown',
      current_qty: asset.current_qty ?? 0,
      reorder_point: reorderPoint,
      lead_time_days: leadTimeDays,
      daily_velocity: Math.round(dailyVelocity * 100) / 100,
      velocity_7d: velocity.v7d,
      velocity_30d: velocity.v30d,
      forecast_qty_7d: forecast?.f7d ?? 0,
      forecast_qty_30d: forecast?.f30d ?? 0,
      forecast_model: forecast?.model ?? 'none',
      stockout_risk: Math.round(stockoutRisk * 1000) / 1000,
      margin_pct: marginPct,
      unit_cost: unitCost,
      estimated_cost: estimatedCost,
      suggested_qty: suggestedQty,
    }

    const rec: PurchaseRecommendation = {
      ...recBase,
      priority_score: 0,
      priority_rank: 0,
      reasoning: buildReasoning(recBase),
    }

    recommendations.push(rec)
  }

  const allStockoutRisks = recommendations.map((r) => r.stockout_risk)
  const allVelocities = recommendations.map((r) => r.velocity_30d)
  const allMargins = recommendations.map((r) => r.margin_pct)

  const minRisk = Math.min(...allStockoutRisks)
  const maxRisk = Math.max(...allStockoutRisks)
  const minVel = Math.min(...allVelocities)
  const maxVel = Math.max(...allVelocities)
  const minMargin = Math.min(...allMargins)
  const maxMargin = Math.max(...allMargins)

  for (const rec of recommendations) {
    const riskScore = normalize(rec.stockout_risk, minRisk, maxRisk)
    const velocityScore = normalize(rec.velocity_30d, minVel, maxVel)
    const marginScore = normalize(rec.margin_pct, minMargin, maxMargin)

    rec.priority_score = Math.round(
      (riskScore * 0.4 + velocityScore * 0.35 + marginScore * 0.25) * 1000
    ) / 1000
  }

  recommendations.sort((a, b) => b.priority_score - a.priority_score)

  let cumulativeCost = currentSpendTotal
  let rank = 0

  for (const rec of recommendations) {
    rank++
    rec.priority_rank = rank

    const canAfford = monthlyBudget === null || cumulativeCost + rec.estimated_cost <= monthlyBudget

    if (canAfford) {
      cumulativeCost += rec.estimated_cost
      rec.reasoning.budget_impact += ' — FUNDED'
    } else {
      rec.reasoning.budget_impact += ` — OVER BUDGET (remaining: $${Math.max(0, (monthlyBudget ?? Infinity) - cumulativeCost).toFixed(2)})`
    }
  }

  return {
    monthly_budget: monthlyBudget,
    current_spend: currentSpendTotal,
    remaining_budget: monthlyBudget !== null
      ? Math.max(0, monthlyBudget - currentSpendTotal)
      : Infinity,
    recommendations,
    total_estimated_cost: recommendations.reduce((s, r) => s + r.estimated_cost, 0),
    items_funded: recommendations.filter((r) =>
      r.reasoning.budget_impact.endsWith('FUNDED')
    ).length,
    items_unfunded: recommendations.filter((r) =>
      r.reasoning.budget_impact.includes('OVER BUDGET')
    ).length,
  }
}
