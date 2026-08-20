'use client'

import { useState, useEffect } from 'react'
import { adminFetch } from './admin-api'

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

function KPICard({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', background: 'var(--atmosphere-card)' }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--atmosphere-text-secondary)' }}>{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: color ?? 'var(--atmosphere-text)' }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>{sub}</p>}
    </div>
  )
}

function PriorityBadge({ rank, total }: { rank: number; total: number }) {
  const ratio = rank / total
  const bg = ratio <= 0.25 ? '#ef4444' : ratio <= 0.5 ? '#f59e0b' : '#10b981'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: bg }}>
      #{rank}
    </span>
  )
}

function RiskBadge({ risk }: { risk: number }) {
  const label = risk >= 0.8 ? 'CRITICAL' : risk >= 0.5 ? 'HIGH' : risk >= 0.25 ? 'MODERATE' : 'LOW'
  const bg = risk >= 0.8 ? '#ef4444' : risk >= 0.5 ? '#f59e0b' : risk >= 0.25 ? '#6366f1' : '#10b981'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: bg }}>
      {label} {Math.round(risk * 100)}%
    </span>
  )
}

function MarginBadge({ pct }: { pct: number }) {
  const color = pct >= 30 ? '#10b981' : pct >= 15 ? '#f59e0b' : '#ef4444'
  return (
    <span className="text-sm font-medium" style={{ color }}>
      {pct > 0 ? `${pct}%` : '—'}
    </span>
  )
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center rounded-xl border-2 border-dashed p-12" style={{ borderColor: 'var(--atmosphere-border)' }}>
      <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>No purchase recommendations available. Ensure inventory tracking is enabled and products have sales history.</p>
    </div>
  )
}

export default function PurchaseAdvisorPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<BudgetStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await adminFetch<BudgetStatus>('/api/admin/inventory/purchase-advisor', businessId)
        if (!cancelled) setData(result)
      } catch (err) {
        console.error('[PurchaseAdvisor] Failed to load:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [businessId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--atmosphere-border)', borderTopColor: 'var(--module-accent)' }} />
      </div>
    )
  }

  if (!data || data.recommendations.length === 0) {
    return <EmptyState />
  }

  const { recommendations, monthly_budget, current_spend, remaining_budget, items_funded, items_unfunded, total_estimated_cost } = data
  const highRiskCount = recommendations.filter((r) => r.stockout_risk >= 0.5).length
  const avgMargin = recommendations.reduce((s, r) => s + r.margin_pct, 0) / recommendations.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Purchase Advisor</h2>
          <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            Greedy heuristic — ranked by stockout risk × velocity × margin. Not an optimization.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true)
            adminFetch<BudgetStatus>('/api/admin/inventory/purchase-advisor', businessId)
              .then(setData)
              .catch((err) => console.error('[PurchaseAdvisor] Failed to reload:', err))
              .finally(() => setLoading(false))
          }}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text-secondary)' }}
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Items to Purchase" value={recommendations.length} sub={`${highRiskCount} high risk`} />
        <KPICard label="Total Estimated Cost" value={formatCurrency(total_estimated_cost)} sub={`${items_funded} funded, ${items_unfunded} over budget`} />
        <KPICard
          label="Monthly Budget"
          value={monthly_budget !== null ? formatCurrency(monthly_budget) : 'No limit'}
          sub={monthly_budget !== null ? `${formatCurrency(current_spend)} spent, ${formatCurrency(remaining_budget)} left` : 'Budget not configured'}
          color={monthly_budget !== null && remaining_budget < total_estimated_cost * 0.5 ? '#ef4444' : undefined}
        />
        <KPICard label="Avg Margin" value={`${avgMargin.toFixed(1)}%`} sub="Across all recommendations" color={avgMargin >= 25 ? '#10b981' : avgMargin >= 15 ? '#f59e0b' : '#ef4444'} />
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--atmosphere-border)', background: 'var(--atmosphere-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--atmosphere-text-secondary)' }}>
              <th className="pb-2 p-3 text-left font-medium">Rank</th>
              <th className="pb-2 p-3 text-left font-medium">Product</th>
              <th className="pb-2 p-3 text-right font-medium">Stock</th>
              <th className="pb-2 p-3 text-right font-medium">ROP</th>
              <th className="pb-2 p-3 text-right font-medium">Velocity/d</th>
              <th className="pb-2 p-3 text-right font-medium">Forecast 7d</th>
              <th className="pb-2 p-3 text-center font-medium">Risk</th>
              <th className="pb-2 p-3 text-right font-medium">Margin</th>
              <th className="pb-2 p-3 text-right font-medium">Qty</th>
              <th className="pb-2 p-3 text-right font-medium">Cost</th>
              <th className="pb-2 p-3 text-center font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((rec) => (
              <>
                <tr
                  key={rec.product_id}
                  className="border-t cursor-pointer transition-colors hover:opacity-90"
                  style={{ borderColor: 'var(--atmosphere-border)' }}
                  onClick={() => setExpandedRow(expandedRow === rec.product_id ? null : rec.product_id)}
                >
                  <td className="p-3"><PriorityBadge rank={rec.priority_rank} total={recommendations.length} /></td>
                  <td className="p-3 font-medium" style={{ color: 'var(--atmosphere-text)' }}>{rec.product_name}</td>
                  <td className="p-3 text-right" style={{ color: rec.current_qty === 0 ? '#ef4444' : rec.current_qty <= rec.reorder_point ? '#f59e0b' : 'var(--atmosphere-text)' }}>
                    {rec.current_qty}
                  </td>
                  <td className="p-3 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{rec.reorder_point}</td>
                  <td className="p-3 text-right" style={{ color: 'var(--atmosphere-text)' }}>{rec.daily_velocity}</td>
                  <td className="p-3 text-right" style={{ color: 'var(--atmosphere-text)' }}>{rec.forecast_qty_7d}</td>
                  <td className="p-3 text-center"><RiskBadge risk={rec.stockout_risk} /></td>
                  <td className="p-3 text-right"><MarginBadge pct={rec.margin_pct} /></td>
                  <td className="p-3 text-right font-medium" style={{ color: 'var(--atmosphere-text)' }}>{rec.suggested_qty}</td>
                  <td className="p-3 text-right" style={{ color: 'var(--atmosphere-text)' }}>{formatCurrency(rec.estimated_cost)}</td>
                  <td className="p-3 text-center">
                    <span style={{ color: 'var(--atmosphere-text-secondary)' }}>{expandedRow === rec.product_id ? '▲' : '▼'}</span>
                  </td>
                </tr>
                {expandedRow === rec.product_id && (
                  <tr key={`${rec.product_id}-details`} className="border-t" style={{ borderColor: 'var(--atmosphere-border)', background: 'var(--atmosphere-card)' }}>
                    <td colSpan={11} className="p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                        <div className="space-y-1">
                          <p className="font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Stock & Demand</p>
                          <p>{rec.reasoning.stock_level}</p>
                          <p>{rec.reasoning.velocity_trend}</p>
                          <p>{rec.reasoning.forecast_note}</p>
                          <p>Lead time: {rec.lead_time_days}d | 7d velocity: {rec.velocity_7d} | 30d velocity: {rec.velocity_30d}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Financials</p>
                          <p>{rec.reasoning.margin_status}</p>
                          <p>{rec.reasoning.budget_impact}</p>
                          <p>Unit cost: {formatCurrency(rec.unit_cost)} | Priority score: {rec.priority_score}</p>
                          <p>Forecast model: {rec.forecast_model}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Risk Assessment</p>
                          <p>{rec.reasoning.stockout_warning}</p>
                          <p>Confidence interval: {rec.forecast_qty_7d} ± {Math.round(rec.forecast_qty_7d * (1 - (rec.stockout_risk * 0.5)))} units (7d)</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border p-4 text-xs" style={{ borderColor: 'var(--atmosphere-border)', background: 'var(--atmosphere-card)', color: 'var(--atmosphere-text-secondary)' }}>
        <p className="font-semibold mb-1" style={{ color: 'var(--atmosphere-text)' }}>How this works</p>
        <p>
          Priority = 40% stockout risk + 35% velocity + 25% margin (all normalized 0-1).
          Items are ranked by priority and funded greedily until the monthly budget is exhausted.
          Forecasts use exponential smoothing when it outperforms the 30-day moving average baseline (measured by MAE).
          This is a heuristic, not an optimization — review all recommendations before purchasing.
        </p>
      </div>
    </div>
  )
}
