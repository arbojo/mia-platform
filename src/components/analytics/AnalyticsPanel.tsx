'use client'

import React, { useEffect, useState } from 'react'
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
  revenue: number
  conversion_rate: number
  avg_order_value: number
}

interface ProductPerformanceRow {
  product_id: string
  product_name: string
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

interface AnalyticsData {
  salesDaily: SalesDailyRow[]
  topProducts: ProductPerformanceRow[]
  aiCostDaily: AiCostDailyRow[]
  summary: {
    totalRevenue: number
    totalOrders: number
    avgConversion: number
    avgOrderValue: number
    totalAiCost: number
    aiCostToday: number
  }
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6']

function formatCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(d: React.ReactNode): string {
  if (typeof d !== 'string') return String(d ?? '')
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
}

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--atmosphere-text-secondary)' }}>{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: color ?? 'var(--atmosphere-text)' }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>{sub}</p>}
    </div>
  )
}

export function AnalyticsPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

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

  const { summary, salesDaily, topProducts, aiCostDaily } = data

  const statusData = [
    { name: 'Ganadas', value: salesDaily.reduce((s, r) => s + r.won_count, 0) },
    { name: 'Perdidas', value: salesDaily.reduce((s, r) => s + r.lost_count, 0) },
    { name: 'Canceladas', value: salesDaily.reduce((s, r) => s + r.cancelled_count, 0) },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--atmosphere-text)' }}>Resumen del Negocio</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)', color: 'var(--atmosphere-text)' }}
        >
          <option value={7}>7 días</option>
          <option value={14}>14 días</option>
          <option value={30}>30 días</option>
          <option value={60}>60 días</option>
          <option value={90}>90 días</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="Ingresos" value={formatCurrency(summary.totalRevenue)} sub={`${days} días`} color="#10b981" />
        <KPICard label="Pedidos" value={String(summary.totalOrders)} sub={`${summary.avgConversion}% tasa de cierre`} />
        <KPICard label="Ticket Promedio" value={formatCurrency(summary.avgOrderValue)} sub="por pedido" />
        <KPICard label="Costo IA Hoy" value={`$${summary.aiCostToday.toFixed(2)}`} sub={`$${summary.totalAiCost.toFixed(2)} total`} color="#f59e0b" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Ingresos Diarios</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={salesDaily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                labelFormatter={formatDate}
                contentStyle={{ backgroundColor: 'var(--atmosphere-card)', border: '1px solid var(--atmosphere-border)', borderRadius: 8 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Resultado de Ventas</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--atmosphere-card)', border: '1px solid var(--atmosphere-border)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>Sin datos</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Pedidos por Día</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesDaily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
              <Tooltip
                formatter={(v) => [String(v), 'Pedidos']}
                labelFormatter={formatDate}
                contentStyle={{ backgroundColor: 'var(--atmosphere-card)', border: '1px solid var(--atmosphere-border)', borderRadius: 8 }}
              />
              <Bar dataKey="won_count" fill="#10b981" radius={[4, 4, 0, 0]} name="Ganadas" />
              <Bar dataKey="lost_count" fill="#ef4444" radius={[4, 4, 0, 0]} name="Perdidas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Costo de IA Diario</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={aiCostDaily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
              <Tooltip
                formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Costo']}
                labelFormatter={formatDate}
                contentStyle={{ backgroundColor: 'var(--atmosphere-card)', border: '1px solid var(--atmosphere-border)', borderRadius: 8 }}
              />
              <Area type="monotone" dataKey="total_cost" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
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
    </div>
  )
}
