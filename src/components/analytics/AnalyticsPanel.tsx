'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { adminFetch } from '@/components/analytics/admin-api'

interface SalesDailyRow {
  date: string
  won_count: number
  lost_count: number
  cancelled_count: number
  started_count: number
  selected_count: number
  revenue: number
  conversion_rate: number
  avg_order_value: number
}

interface ProductPerformanceRow {
  product_id: string
  product_name: string
  times_presented: number
  times_selected: number
  times_sold: number
  revenue: number
  conversion_rate: number
  avg_deal_value: number
}

interface AiCostDailyRow {
  date: string
  total_requests: number
  total_cost: number
  cost_by_type: Record<string, { count: number; cost: number }>
}

interface CustomerInsightRow {
  customer_id: string
  customer_name: string
  customer_city: string | null
  customer_status: string | null
  conversations_started: number
  sales_won: number
  sales_lost: number
  sales_cancelled: number
  total_value: number
  last_purchase_at: string | null
}

interface AnalyticsSummary {
  totalRevenue: number
  totalOrders: number
  avgConversion: number
  avgOrderValue: number
  totalAiCost: number
  aiCostToday: number
  costPerSale: number
  activeCustomers: number
  ltv: number
  cac: number
  ltvCacRatio: number
  ltvCacHealth: 'healthy' | 'warning' | 'critical'
  revenueDelta: number | null
  ordersDelta: number | null
  conversionDelta: number | null
  avgOrderValueDelta: number | null
}

interface AnalyticsData {
  salesDaily: SalesDailyRow[]
  topProducts: ProductPerformanceRow[]
  aiCostDaily: AiCostDailyRow[]
  topCustomers: CustomerInsightRow[]
  summary: AnalyticsSummary
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6']
const tooltipStyle = { backgroundColor: 'var(--atmosphere-card)', border: '1px solid var(--atmosphere-border)', borderRadius: 8 }

function formatCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(d: React.ReactNode): string {
  if (typeof d !== 'string') return String(d ?? '')
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null
  const positive = delta > 0
  return (
    <span
      className="ml-1.5 inline-flex items-center text-xs font-medium"
      style={{ color: positive ? '#10b981' : '#ef4444' }}
    >
      {positive ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative ml-1 inline-flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors hover:opacity-80"
        style={{
          color: 'var(--atmosphere-text-secondary)',
          backgroundColor: 'var(--atmosphere-border)',
          border: '1.5px solid var(--atmosphere-text-secondary)',
        }}
        aria-label="Más información"
      >
        ?
      </button>
      {open && (
        <div
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg px-3 py-2 text-xs leading-relaxed shadow-lg"
          style={{
            backgroundColor: 'var(--atmosphere-card)',
            border: '1px solid var(--atmosphere-border)',
            color: 'var(--atmosphere-text)',
          }}
        >
          {text}
          <div
            className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45"
            style={{
              backgroundColor: 'var(--atmosphere-card)',
              borderRight: '1px solid var(--atmosphere-border)',
              borderBottom: '1px solid var(--atmosphere-border)',
            }}
          />
        </div>
      )}
    </div>
  )
}

function KPICard({ label, value, sub, color, delta, tip }: {
  label: string; value: string; sub?: string; color?: string; delta?: number | null; tip?: string
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
      <p className="flex items-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <p className="text-2xl font-bold" style={{ color: color ?? 'var(--atmosphere-text)' }}>{value}</p>
        {delta != null && <DeltaBadge delta={delta} />}
      </div>
      {sub && <p className="mt-0.5 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>{sub}</p>}
    </div>
  )
}

function RatioCard({ ratio, health, ltv, cac }: { ratio: number; health: 'healthy' | 'warning' | 'critical'; ltv: number; cac: number }) {
  const colors = { healthy: '#10b981', warning: '#f59e0b', critical: '#ef4444' }
  const labels = { healthy: 'Saludable', warning: 'Precaución', critical: 'Riesgo' }
  const barWidth = Math.min(ratio / 5 * 100, 100)

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
      <p className="flex items-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        LTV / CAC
        <InfoTip text="Relación entre el valor de vida del cliente y el costo de adquisición. ≥3x es saludable, <2x es riesgo." />
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-bold" style={{ color: colors[health] }}>{ratio.toFixed(1)}x</p>
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${colors[health]}22`, color: colors[health] }}>
          {labels[health]}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--atmosphere-border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: colors[health] }} />
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        LTV ${ltv.toFixed(0)} · CAC ${cac.toFixed(4)}
      </p>
    </div>
  )
}

function FunnelChart({ started, selected, won }: { started: number; selected: number; won: number }) {
  const max = Math.max(started, 1)
  const stages = [
    { label: 'Iniciadas', value: started, pct: 100 },
    { label: 'Seleccionadas', value: selected, pct: Math.round((selected / max) * 100) },
    { label: 'Ganadas', value: won, pct: Math.round((won / max) * 100) },
  ]

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
      <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Embudo de Ventas</h2>
      <div className="space-y-3">
        {stages.map((s, i) => (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span style={{ color: 'var(--atmosphere-text-secondary)' }}>{s.label}</span>
              <span className="font-medium" style={{ color: 'var(--atmosphere-text)' }}>
                {s.value} {i > 0 && i < stages.length ? `(${s.pct}%)` : ''}
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-md" style={{ backgroundColor: 'var(--atmosphere-border)' }}>
              <div
                className="flex h-full items-center rounded-md pl-2 text-xs font-medium text-white transition-all"
                style={{
                  width: `${Math.max(s.pct, 8)}%`,
                  backgroundColor: i === 2 ? '#10b981' : i === 1 ? '#6366f1' : '#94a3b8',
                }}
              >
                {s.pct >= 20 && `${s.pct}%`}
              </div>
            </div>
          </div>
        ))}
      </div>
      {started > 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Tasa de cierre: {Math.round((won / started) * 100)}% de iniciadas → ganadas
        </p>
      )}
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
      <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        {label}
      </p>
    </div>
  )
}

function SimpleView({ data }: { data: AnalyticsData }) {
  const { summary, salesDaily, topProducts, aiCostDaily } = data

  const statusData = [
    { name: 'Ganadas', value: salesDaily.reduce((s, r) => s + r.won_count, 0) },
    { name: 'Perdidas', value: salesDaily.reduce((s, r) => s + r.lost_count, 0) },
    { name: 'Canceladas', value: salesDaily.reduce((s, r) => s + r.cancelled_count, 0) },
  ].filter((d) => d.value > 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Ingresos" value={formatCurrency(summary.totalRevenue)} color="#10b981" delta={summary.revenueDelta} />
        <KPICard label="Pedidos" value={String(summary.totalOrders)} sub={`${summary.avgConversion}% cierre`} delta={summary.ordersDelta} />
        <KPICard label="Ticket Prom." value={formatCurrency(summary.avgOrderValue)} delta={summary.avgOrderValueDelta} tip="Valor promedio de cada pedido ganado en el periodo seleccionado." />
        <KPICard label="Costo IA Hoy" value={`$${summary.aiCostToday.toFixed(2)}`} sub={`$${summary.totalAiCost.toFixed(2)} total`} color="#f59e0b" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Ingresos Diarios</h2>
          {salesDaily.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={salesDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={formatDate} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Tus métricas de ingresos aparecerán cuando empiecen las ventas." />
          )}
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Resultado de Ventas</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin actividad de ventas en este periodo." />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Pedidos por Día</h2>
          {salesDaily.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <Tooltip formatter={(v) => [String(v), 'Pedidos']} labelFormatter={formatDate} contentStyle={tooltipStyle} />
                <Bar dataKey="won_count" fill="#10b981" radius={[4, 4, 0, 0]} name="Ganadas" />
                <Bar dataKey="lost_count" fill="#ef4444" radius={[4, 4, 0, 0]} name="Perdidas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin pedidos registrados en este periodo." />
          )}
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Costo de IA Diario</h2>
          {aiCostDaily.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={aiCostDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Costo']} labelFormatter={formatDate} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total_cost" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin uso de IA registrado en este periodo." />
          )}
        </div>
      </div>

      {topProducts.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Top Productos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  <th className="pb-2 text-left font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Vendidos</th>
                  <th className="pb-2 text-right font-medium">Ingresos</th>
                  <th className="pb-2 text-right font-medium">Conversión</th>
                  <th className="pb-2 text-right font-medium">Ticket Prom.</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.product_id} className="border-t" style={{ borderColor: 'var(--atmosphere-border)' }}>
                    <td className="py-2 font-medium" style={{ color: 'var(--atmosphere-text)' }}>{p.product_name}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{p.times_sold}</td>
                    <td className="py-2 text-right font-medium" style={{ color: '#10b981' }}>{formatCurrency(p.revenue)}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{p.conversion_rate}%</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{formatCurrency(p.avg_deal_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function DetailedView({ data }: { data: AnalyticsData }) {
  const { summary, salesDaily, topProducts, aiCostDaily, topCustomers } = data

  const totalStarted = salesDaily.reduce((s, r) => s + r.started_count, 0)
  const totalSelected = salesDaily.reduce((s, r) => s + r.selected_count, 0)
  const totalWon = salesDaily.reduce((s, r) => s + r.won_count, 0)

  const aiTypeBreakdown: Record<string, { count: number; cost: number }> = {}
  for (const row of aiCostDaily) {
    if (!row.cost_by_type) continue
    for (const [type, val] of Object.entries(row.cost_by_type)) {
      if (!aiTypeBreakdown[type]) aiTypeBreakdown[type] = { count: 0, cost: 0 }
      aiTypeBreakdown[type].count += val.count
      aiTypeBreakdown[type].cost += val.cost
    }
  }
  const aiTypeEntries = Object.entries(aiTypeBreakdown).sort((a, b) => b[1].cost - a[1].cost)

  const statusData = [
    { name: 'Ganadas', value: totalWon },
    { name: 'Perdidas', value: salesDaily.reduce((s, r) => s + r.lost_count, 0) },
    { name: 'Canceladas', value: salesDaily.reduce((s, r) => s + r.cancelled_count, 0) },
  ].filter((d) => d.value > 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Ingresos" value={formatCurrency(summary.totalRevenue)} color="#10b981" delta={summary.revenueDelta} />
        <KPICard label="Pedidos" value={String(summary.totalOrders)} sub={`${summary.avgConversion}% cierre`} delta={summary.ordersDelta} />
        <KPICard label="Ticket Prom." value={formatCurrency(summary.avgOrderValue)} delta={summary.avgOrderValueDelta} tip="Valor promedio de cada pedido ganado en el periodo seleccionado." />
        <KPICard label="Costo IA Hoy" value={`$${summary.aiCostToday.toFixed(2)}`} sub={`$${summary.totalAiCost.toFixed(2)} total`} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Costo por Venta" value={`$${summary.costPerSale.toFixed(4)}`} sub="IA cost ÷ pedidos" color="#f59e0b" tip="Costo total de IA dividido entre ventas ganadas. Mide cuánto cuesta generar cada venta." />
        <KPICard label="Clientes Activos" value={String(summary.activeCustomers)} sub="conversaciones recientes" />
        <KPICard label="Tasa de Conversión" value={`${summary.avgConversion}%`} sub="iniciadas → ganadas" color="#10b981" tip="Porcentaje de conversaciones que terminaron en venta ganada." />
        <RatioCard ratio={summary.ltvCacRatio} health={summary.ltvCacHealth} ltv={summary.ltv} cac={summary.cac} />
      </div>

      <FunnelChart started={totalStarted} selected={totalSelected} won={totalWon} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Ingresos Diarios</h2>
          {salesDaily.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={salesDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={formatDate} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Tus métricas de ingresos aparecerán cuando empiecen las ventas." />
          )}
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Resultado de Ventas</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin actividad de ventas en este periodo." />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Pedidos por Día</h2>
          {salesDaily.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <Tooltip formatter={(v) => [String(v), 'Pedidos']} labelFormatter={formatDate} contentStyle={tooltipStyle} />
                <Bar dataKey="won_count" fill="#10b981" radius={[4, 4, 0, 0]} name="Ganadas" />
                <Bar dataKey="lost_count" fill="#ef4444" radius={[4, 4, 0, 0]} name="Perdidas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin pedidos registrados en este periodo." />
          )}
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Costo de IA Diario</h2>
          {aiCostDaily.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={aiCostDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Costo']} labelFormatter={formatDate} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total_cost" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin uso de IA registrado en este periodo." />
          )}
        </div>
      </div>

      {aiTypeEntries.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Costo IA por Tipo</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  <th className="pb-2 text-left font-medium">Tipo</th>
                  <th className="pb-2 text-right font-medium">Requests</th>
                  <th className="pb-2 text-right font-medium">Costo</th>
                  <th className="pb-2 text-right font-medium">% del Total</th>
                </tr>
              </thead>
              <tbody>
                {aiTypeEntries.map(([type, val]) => (
                  <tr key={type} className="border-t" style={{ borderColor: 'var(--atmosphere-border)' }}>
                    <td className="py-2 font-medium capitalize" style={{ color: 'var(--atmosphere-text)' }}>{type.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{val.count}</td>
                    <td className="py-2 text-right font-medium" style={{ color: '#f59e0b' }}>${val.cost.toFixed(4)}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{summary.totalAiCost > 0 ? ((val.cost / summary.totalAiCost) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {topProducts.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Detalle de Productos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  <th className="pb-2 text-left font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Presentado</th>
                  <th className="pb-2 text-right font-medium">Seleccionado</th>
                  <th className="pb-2 text-right font-medium">Vendido</th>
                  <th className="pb-2 text-right font-medium">Ingresos</th>
                  <th className="pb-2 text-right font-medium">Conversión</th>
                  <th className="pb-2 text-right font-medium">Ticket Prom.</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.product_id} className="border-t" style={{ borderColor: 'var(--atmosphere-border)' }}>
                    <td className="py-2 font-medium" style={{ color: 'var(--atmosphere-text)' }}>{p.product_name}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{p.times_presented}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{p.times_selected}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{p.times_sold}</td>
                    <td className="py-2 text-right font-medium" style={{ color: '#10b981' }}>{formatCurrency(p.revenue)}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{p.conversion_rate}%</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{formatCurrency(p.avg_deal_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {topCustomers.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Top Clientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  <th className="pb-2 text-left font-medium">Cliente</th>
                  <th className="pb-2 text-left font-medium">Ciudad</th>
                  <th className="pb-2 text-right font-medium">Conversaciones</th>
                  <th className="pb-2 text-right font-medium">Ganadas</th>
                  <th className="pb-2 text-right font-medium">Valor Total</th>
                  <th className="pb-2 text-right font-medium">Última Compra</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr key={c.customer_id} className="border-t" style={{ borderColor: 'var(--atmosphere-border)' }}>
                    <td className="py-2 font-medium" style={{ color: 'var(--atmosphere-text)' }}>{c.customer_name}</td>
                    <td className="py-2" style={{ color: 'var(--atmosphere-text-secondary)' }}>{c.customer_city ?? '—'}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{c.conversations_started}</td>
                    <td className="py-2 text-right" style={{ color: '#10b981' }}>{c.sales_won}</td>
                    <td className="py-2 text-right font-medium" style={{ color: 'var(--atmosphere-text)' }}>{formatCurrency(c.total_value)}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                      {c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

export function AnalyticsPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(3)
  const [viewMode, setViewMode] = useState<'simple' | 'complete'>(() => {
    if (typeof window === 'undefined') return 'simple'
    return (localStorage.getItem('analytics-view-mode') as 'simple' | 'complete') ?? 'simple'
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const result = await adminFetch<{ overview: AnalyticsData }>(`/api/admin/analytics/overview?days=${days}`, businessId)
        if (!cancelled) setData(result.overview)
      } catch (err) {
        console.error('Analytics fetch error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [businessId, days])

  function handleViewModeChange(mode: 'simple' | 'complete') {
    setViewMode(mode)
    localStorage.setItem('analytics-view-mode', mode)
  }

  const dayLabels: Record<number, string> = {
    0: 'Hoy',
    3: '3 días',
    7: '7 días',
    14: '14 días',
    30: '30 días',
    60: '60 días',
    90: '90 días',
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--atmosphere-border)', borderTopColor: 'var(--module-accent)' }} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-20 text-center" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        No hay datos disponibles. Los datos aparecerán cuando haya actividad de ventas.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--atmosphere-text)' }}>Resumen del Negocio</h1>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
            <button
              onClick={() => handleViewModeChange('simple')}
              className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor: viewMode === 'simple' ? 'var(--module-accent)' : 'transparent',
                color: viewMode === 'simple' ? '#fff' : 'var(--atmosphere-text-secondary)',
              }}
            >
              Simple
            </button>
            <button
              onClick={() => handleViewModeChange('complete')}
              className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor: viewMode === 'complete' ? 'var(--module-accent)' : 'transparent',
                color: viewMode === 'complete' ? '#fff' : 'var(--atmosphere-text-secondary)',
              }}
            >
              Completa
            </button>
          </div>

          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)', color: 'var(--atmosphere-text)' }}
          >
            {[0, 3, 7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>{dayLabels[d]}</option>
            ))}
          </select>
        </div>
      </div>

      {viewMode === 'simple' ? <SimpleView data={data} /> : <DetailedView data={data} />}
    </div>
  )
}
