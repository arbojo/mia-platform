'use client'

import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { adminFetch } from '@/components/analytics/admin-api'

interface InventoryDailyRow {
  date: string
  stock_in: number
  stock_out: number
  net_change: number
  adjustments: number
  waste: number
  items_sold: number
  total_cost_in: number
  total_cost_out: number
}

interface ProductMarginRow {
  product_id: string
  product_name: string
  revenue: number
  cogs: number
  gross_margin: number
  gross_margin_pct: number
  units_sold: number
  avg_unit_cost: number
  avg_selling_price: number
}

interface StockHealthRow {
  total_items: number
  items_green: number
  items_yellow: number
  items_red: number
  total_stock_value: number
  low_stock_count: number
  out_of_stock_count: number
  health_score: number
}

interface InventoryData {
  daily: InventoryDailyRow[]
  productMargins: ProductMarginRow[]
  stockHealth: StockHealthRow
  summary: {
    totalStockValue: number
    outOfStockCount: number
    healthScore: number
    avgGrossMargin: number
    totalCOGS: number
    wasteCount: number
  }
}

const HEALTH_COLORS = ['#10b981', '#f59e0b', '#ef4444']
const tooltipStyle = { backgroundColor: 'var(--atmosphere-card)', border: '1px solid var(--atmosphere-border)', borderRadius: 8 }

function formatCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(d: React.ReactNode): string {
  if (typeof d !== 'string') return String(d ?? '')
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
}

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

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

function KPICard({ label, value, sub, color, tip }: {
  label: string; value: string; sub?: string; color?: string; tip?: string
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
      <p className="flex items-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className="mt-1 text-2xl font-bold" style={{ color: color ?? 'var(--atmosphere-text)' }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>{sub}</p>}
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
      <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>{label}</p>
    </div>
  )
}

function SimpleView({ data }: { data: InventoryData }) {
  const { summary, stockHealth, productMargins } = data

  const healthData = [
    { name: 'Saludable', value: stockHealth.items_green },
    { name: 'Alerta', value: stockHealth.items_yellow },
    { name: 'Agotado', value: stockHealth.items_red },
  ].filter((d) => d.value > 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Valor del Inventario" value={formatCurrency(summary.totalStockValue)} color="#6366f1" tip="Valor total del stock basado en costo promedio de compra." />
        <KPICard label="Agotados" value={String(summary.outOfStockCount)} sub={`de ${stockHealth.total_items} items`} color={summary.outOfStockCount > 0 ? '#ef4444' : undefined} />
        <KPICard label="Índice de Salud" value={`${summary.healthScore}%`} sub="items saludables" color="#10b981" tip="Porcentaje de items con stock por encima del punto de reorden." />
        <KPICard label="Margen Promedio" value={`${summary.avgGrossMargin}%`} sub="bruto" color="#10b981" tip="Margen bruto promedio: (ingreso - costo del producto) / ingreso." />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Salud de Inventario</h2>
          {healthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={healthData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {healthData.map((_, i) => <Cell key={i} fill={HEALTH_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin datos de inventario." />
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Barras de Salud por Producto</h2>
          {stockHealth.total_items > 0 ? (
            <div className="space-y-3">
              {[
                { label: 'Saludable', count: stockHealth.items_green, color: '#10b981' },
                { label: 'Alerta', count: stockHealth.items_yellow, color: '#f59e0b' },
                { label: 'Agotado', count: stockHealth.items_red, color: '#ef4444' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--atmosphere-text-secondary)' }}>{s.label}</span>
                    <span className="font-medium" style={{ color: 'var(--atmosphere-text)' }}>{s.count} items</span>
                  </div>
                  <div className="h-5 w-full overflow-hidden rounded-md" style={{ backgroundColor: 'var(--atmosphere-border)' }}>
                    <div
                      className="h-full rounded-md transition-all"
                      style={{
                        width: `${stockHealth.total_items > 0 ? Math.max((s.count / stockHealth.total_items) * 100, 4) : 0}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart label="Sin datos de inventario." />
          )}
        </div>
      </div>

      {productMargins.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Top Productos por Margen</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  <th className="pb-2 text-left font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Ingresos</th>
                  <th className="pb-2 text-right font-medium">Costo</th>
                  <th className="pb-2 text-right font-medium">Margen</th>
                  <th className="pb-2 text-right font-medium">Margen %</th>
                </tr>
              </thead>
              <tbody>
                {productMargins.map((p) => (
                  <tr key={p.product_id} className="border-t" style={{ borderColor: 'var(--atmosphere-border)' }}>
                    <td className="py-2 font-medium" style={{ color: 'var(--atmosphere-text)' }}>{p.product_name}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{formatCurrency(p.revenue)}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{formatCurrency(p.cogs)}</td>
                    <td className="py-2 text-right font-medium" style={{ color: p.gross_margin >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(p.gross_margin)}</td>
                    <td className="py-2 text-right font-medium" style={{ color: p.gross_margin_pct >= 0 ? '#10b981' : '#ef4444' }}>{p.gross_margin_pct}%</td>
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

function DetailedView({ data }: { data: InventoryData }) {
  const { summary, stockHealth, productMargins, daily } = data

  const healthData = [
    { name: 'Saludable', value: stockHealth.items_green },
    { name: 'Alerta', value: stockHealth.items_yellow },
    { name: 'Agotado', value: stockHealth.items_red },
  ].filter((d) => d.value > 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Valor del Inventario" value={formatCurrency(summary.totalStockValue)} color="#6366f1" tip="Valor total del stock basado en costo promedio de compra." />
        <KPICard label="Agotados" value={String(summary.outOfStockCount)} sub={`de ${stockHealth.total_items} items`} color={summary.outOfStockCount > 0 ? '#ef4444' : undefined} />
        <KPICard label="Índice de Salud" value={`${summary.healthScore}%`} sub="items saludables" color="#10b981" tip="Porcentaje de items con stock por encima del punto de reorden." />
        <KPICard label="Margen Promedio" value={`${summary.avgGrossMargin}%`} sub="bruto" color="#10b981" tip="Margen bruto promedio: (ingreso - costo del producto) / ingreso." />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Costo Total" value={formatCurrency(summary.totalCOGS)} sub="COGS del periodo" color="#f59e0b" />
        <KPICard label="Desperdicios" value={String(summary.wasteCount)} sub="unidades" color={summary.wasteCount > 0 ? '#ef4444' : undefined} />
        <KPICard label="Bajo Stock" value={String(stockHealth.low_stock_count ?? 0)} sub="items por debajo del umbral" color="#f59e0b" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Salud de Inventario</h2>
          {healthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={healthData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {healthData.map((_, i) => <Cell key={i} fill={HEALTH_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin datos de inventario." />
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Movimientos Diarios</h2>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--atmosphere-border)" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--atmosphere-text-secondary)" />
                <Tooltip formatter={(v) => [String(v), 'Unidades']} labelFormatter={formatDate} contentStyle={tooltipStyle} />
                <Bar dataKey="stock_in" fill="#6366f1" radius={[4, 4, 0, 0]} name="Entradas" />
                <Bar dataKey="stock_out" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Salidas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Sin movimientos de inventario en este periodo." />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Detalle de Margen por Producto</h2>
          {productMargins.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    <th className="pb-2 text-left font-medium">Producto</th>
                    <th className="pb-2 text-right font-medium">Unidades</th>
                    <th className="pb-2 text-right font-medium">Ingresos</th>
                    <th className="pb-2 text-right font-medium">Costo</th>
                    <th className="pb-2 text-right font-medium">Margen Bruto</th>
                    <th className="pb-2 text-right font-medium">Margen %</th>
                    <th className="pb-2 text-right font-medium">Costo Unit.</th>
                    <th className="pb-2 text-right font-medium">Precio Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {productMargins.map((p) => (
                    <tr key={p.product_id} className="border-t" style={{ borderColor: 'var(--atmosphere-border)' }}>
                      <td className="py-2 font-medium" style={{ color: 'var(--atmosphere-text)' }}>{p.product_name}</td>
                      <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{p.units_sold}</td>
                      <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text)' }}>{formatCurrency(p.revenue)}</td>
                      <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{formatCurrency(p.cogs)}</td>
                      <td className="py-2 text-right font-medium" style={{ color: p.gross_margin >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(p.gross_margin)}</td>
                      <td className="py-2 text-right font-medium" style={{ color: p.gross_margin_pct >= 0 ? '#10b981' : '#ef4444' }}>{p.gross_margin_pct}%</td>
                      <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{formatCurrency(p.avg_unit_cost)}</td>
                      <td className="py-2 text-right" style={{ color: 'var(--atmosphere-text-secondary)' }}>{formatCurrency(p.avg_selling_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyChart label="Sin datos de productos para calcular margen." />
          )}
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--atmosphere-card)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>Score de Salud</h2>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--atmosphere-border)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={summary.healthScore >= 70 ? '#10b981' : summary.healthScore >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeDasharray={`${(summary.healthScore / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: 'var(--atmosphere-text)' }}>{summary.healthScore}%</span>
              </div>
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
              {summary.healthScore >= 70 ? 'Inventario saludable' : summary.healthScore >= 40 ? 'Requiere atención' : 'Crítico — revisar stock'}
            </p>
          </div>
          <div className="mt-2 space-y-2 text-xs">
            <div className="flex justify-between">
              <span style={{ color: 'var(--atmosphere-text-secondary)' }}>Total items</span>
              <span className="font-medium" style={{ color: 'var(--atmosphere-text)' }}>{stockHealth.total_items}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#10b981' }}>● Saludables</span>
              <span className="font-medium" style={{ color: 'var(--atmosphere-text)' }}>{stockHealth.items_green}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#f59e0b' }}>● En alerta</span>
              <span className="font-medium" style={{ color: 'var(--atmosphere-text)' }}>{stockHealth.items_yellow}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#ef4444' }}>● Agotados</span>
              <span className="font-medium" style={{ color: 'var(--atmosphere-text)' }}>{stockHealth.items_red}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function InventoryPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [viewMode, setViewMode] = useState<'simple' | 'complete'>(() => {
    if (typeof window === 'undefined') return 'simple'
    return (localStorage.getItem('inventory-view-mode') as 'simple' | 'complete') ?? 'simple'
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const result = await adminFetch<{ overview: InventoryData }>(`/api/admin/analytics/inventory?days=${days}`, businessId)
        if (!cancelled) setData(result.overview)
      } catch (err) {
        console.error('Inventory analytics fetch error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [businessId, days])

  function handleViewModeChange(mode: 'simple' | 'complete') {
    setViewMode(mode)
    localStorage.setItem('inventory-view-mode', mode)
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
        No hay datos de inventario disponibles. Los datos aparecerán cuando el módulo de inventario esté activo.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--atmosphere-text)' }}>Inventario</h1>

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
