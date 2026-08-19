'use client'

import { useCallback, useEffect, useState } from 'react'
import { DollarSign, Target, TrendingUp, Package, AlertTriangle } from 'lucide-react'
import { adminFetch } from '@/components/delivery/admin-api'
import { KPICard } from '@/components/delivery/KPICard'
import { CommandCenterMap, DriverStalenessIndicator } from '@/components/delivery/CommandCenterMap'
import { DriverDetailModal } from '@/components/delivery/DriverDetailModal'

interface DriverWithRoute {
  id: string
  name: string
  vehicle: string | null
  status: string
  last_lat: number | null
  last_lng: number | null
  last_gps_at: string | null
  route_id: string | null
  route_status: string | null
  current_visit: {
    order_number: string
    customer_name: string
    address: string | null
    status: string
  } | null
  today_stats: {
    delivered: number
    incidents: number
    total_orders: number
    collected: number
  }
}

interface CommandCenterData {
  drivers: Array<{
    id: string
    name: string
    vehicle: string | null
    status: string
    last_lat: number | null
    last_lng: number | null
    last_gps_at: string | null
  }>
  drivers_with_route: DriverWithRoute[]
  financials: {
    daily_goal: number
    total_collected: number
    goal_progress: number
    total_margin: number
    margin_percent: number
    products_without_cost_count: number
    products_without_cost: Array<{
      order_id: string
      product_name: string
      amount: number
    }>
  }
  circulation: {
    orders_in_active_routes: number
    total_value: number
  }
  today_summary: {
    delivered: number
    incidents: number
    closures: number
  }
  business_date: string
  timezone: string
}

export function CommandCenterPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<CommandCenterData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<DriverWithRoute | null>(null)

  const load = useCallback(() => {
    adminFetch<CommandCenterData>('/api/admin/delivery/command-center', businessId)
      .then((res) => {
        setData(res)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error al cargar command center')
      })
  }, [businessId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [load])

  if (error && !data) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Cargando centro de mando…
        </span>
      </div>
    )
  }

  const { financials, circulation, drivers_with_route, today_summary } = data
  const driversWithLocation = data.drivers.filter(
    (d) => d.last_lat != null && d.last_lng != null
  )

  const goalColor =
    financials.goal_progress >= 1
      ? 'var(--mia-green)'
      : financials.goal_progress >= 0.7
        ? 'var(--atmosphere-accent)'
        : 'var(--mia-orange)'

  const marginColor =
    financials.margin_percent >= 20
      ? 'var(--mia-green)'
      : financials.margin_percent >= 10
        ? 'var(--atmosphere-accent)'
        : 'var(--mia-orange)'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Lana en la calle"
          value={`$${financials.total_collected.toLocaleString()}`}
          subtitle={`${today_summary.delivered} entregas hoy`}
          icon={DollarSign}
          color="var(--atmosphere-accent)"
        />

        <KPICard
          label="Meta del día"
          value={`$${financials.daily_goal.toLocaleString()}`}
          progress={financials.goal_progress}
          progressLabel={`${Math.round(financials.goal_progress * 100)}%`}
          icon={Target}
          color={goalColor}
        />

        <KPICard
          label="Margen de utilidad"
          value={`$${financials.total_margin.toLocaleString()}`}
          subtitle={`${financials.margin_percent}%`}
          icon={TrendingUp}
          color={marginColor}
          alert={
            financials.products_without_cost_count > 0
              ? {
                  count: financials.products_without_cost_count,
                  message: 'sin costo asignado',
                }
              : undefined
          }
        />

        <KPICard
          label="Producto en circulación"
          value={`$${circulation.total_value.toLocaleString()}`}
          subtitle={`${circulation.orders_in_active_routes} órdenes en ruta`}
          icon={Package}
          color="var(--atmosphere-accent)"
        />
      </div>

      {financials.products_without_cost_count > 0 && (
        <div
          className="rounded-xl p-3.5"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--mia-orange) 6%, transparent)',
            border: '1px solid color-mix(in srgb, var(--mia-orange) 15%, transparent)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: 'var(--mia-orange)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--mia-orange)' }}>
              Productos sin costo asignado
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            {financials.products_without_cost.map((item) => (
              <p key={item.order_id} className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                {item.product_name} — ${item.amount} (excluido del cálculo de margen)
              </p>
            ))}
          </div>
        </div>
      )}

      {driversWithLocation.length > 0 && (
        <CommandCenterMap
          drivers={driversWithLocation.map((d) => {
            const withRoute = drivers_with_route.find((r) => r.id === d.id)
            return {
              ...d,
              route_id: withRoute?.route_id ?? null,
              current_visit: withRoute?.current_visit ?? null,
              today_stats: withRoute?.today_stats,
            }
          })}
          onDriverClick={(driver) => {
            const full = drivers_with_route.find((d) => d.id === driver.id)
            if (full) setSelectedDriver(full)
          }}
        />
      )}

      {drivers_with_route.length > 0 && (
        <div>
          <h3
            className="mb-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
          >
            Repartidores activos
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {drivers_with_route.map((driver) => (
              <button
                key={driver.id}
                onClick={() => setSelectedDriver(driver)}
                className="group flex items-center gap-3 rounded-xl p-3.5 text-left transition-all duration-200"
                style={{
                  border: '1px solid var(--atmosphere-border)',
                  backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 80%, transparent)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--atmosphere-accent)'
                  e.currentTarget.style.boxShadow = '0 0 20px var(--module-glow-soft)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--atmosphere-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--atmosphere-accent) 12%, transparent)',
                    color: 'var(--atmosphere-accent)',
                  }}
                >
                  {driver.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--atmosphere-text)' }}
                    >
                      {driver.name}
                    </p>
                    <DriverStalenessIndicator lastGpsAt={driver.last_gps_at} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}>
                      {driver.today_stats.delivered}/{driver.today_stats.total_orders} entregadas
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.4 }}>
                      ·
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--atmosphere-accent)' }}>
                      ${driver.today_stats.collected}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {drivers_with_route.length === 0 && driversWithLocation.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-xl py-12"
          style={{
            border: '1px dashed var(--atmosphere-border)',
          }}
        >
          <Package className="mb-2 h-8 w-8" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.3 }} />
          <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.5 }}>
            Sin repartidores activos hoy
          </p>
        </div>
      )}

      {selectedDriver && (
        <DriverDetailModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
        />
      )}
    </div>
  )
}
