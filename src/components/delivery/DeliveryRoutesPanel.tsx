'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/components/delivery/admin-api'

interface Driver {
  id: string
  sequential_number: number
  name: string
  status: 'active' | 'blocked'
}

interface DeliveryOrder {
  id: string
  order_number: string | null
  customer_name: string | null
  amount: number | null
  paid_at_sale: boolean
}

interface RouteRow {
  id: string
  route_date: string
  status: string
  driver_id: string | null
  drivers: { name: string; sequential_number: number } | null
  visits_count?: number
  delivered_count?: number
  collected_total?: number
}

export function DeliveryRoutesPanel({ businessId }: { businessId: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [pending, setPending] = useState<DeliveryOrder[]>([])
  const [routes, setRoutes] = useState<RouteRow[]>([])
  const [driverId, setDriverId] = useState('')
  const [routeDate, setRouteDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [driversRes, ordersRes, routesRes] = await Promise.all([
        adminFetch<{ drivers: Driver[] }>('/api/admin/delivery/drivers', businessId),
        adminFetch<{ orders: DeliveryOrder[] }>(
          '/api/admin/delivery/orders?status=pending_assignment',
          businessId
        ),
        adminFetch<{ routes: RouteRow[] }>(
          `/api/admin/delivery/routes?include_stats=true`,
          businessId
        ),
      ])
      setDrivers(driversRes.drivers)
      setPending(ordersRes.orders)
      setRoutes(routesRes.routes)
      setDriverId((current) => current || driversRes.drivers[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    }
  }, [businessId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function createRoute() {
    if (!driverId || selected.size === 0) return
    setBusy(true)
    setError(null)
    try {
      await adminFetch('/api/admin/delivery/routes', businessId, {
        method: 'POST',
        body: JSON.stringify({
          driverId,
          routeDate,
          orderIds: Array.from(selected),
        }),
      })
      setSelected(new Set())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la ruta')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4" data-tour="delivery-routes">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Nueva ruta
        </h3>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          >
            {drivers
              .filter((d) => d.status === 'active')
              .map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.sequential_number} · {d.name}
                </option>
              ))}
          </select>
          <input
            type="date"
            value={routeDate}
            onChange={(e) => setRouteDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          />
        </div>

        <div className="mt-3">
          <p className="mb-2 text-xs font-medium" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            Pedidos sin asignar — seleccioná {selected.size}
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {pending.map((order) => (
              <label
                key={order.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(order.id)}
                  onChange={() => toggle(order.id)}
                  className="h-4 w-4"
                />
                <span style={{ color: 'var(--atmosphere-text)' }}>
                  {order.order_number ?? 'Sin número'} · {order.customer_name ?? 'Cliente'}
                </span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--atmosphere-accent)' }}>
                  ${order.amount ?? 0}
                  {order.paid_at_sale && <span className="text-xs font-normal"> · pagado</span>}
                </span>
              </label>
            ))}
            {pending.length === 0 && (
              <p className="py-4 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                No hay pedidos sin asignar.
              </p>
            )}
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={createRoute}
          disabled={busy || !driverId || selected.size === 0}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--atmosphere-accent)' }}
        >
          {busy ? 'Creando...' : 'Crear ruta'}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Rutas
        </h3>
        {routes.map((route) => (
          <div
            key={route.id}
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                  {route.drivers?.name ?? 'Sin repartidor'} · {route.route_date}
                </p>
                <p className="text-xs capitalize" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {route.status}
                </p>
              </div>
              {route.visits_count !== undefined && (
                <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {route.delivered_count ?? 0}/{route.visits_count} entregas
                  {route.collected_total ? ` · $${route.collected_total}` : ''}
                </p>
              )}
            </div>
          </div>
        ))}

        {routes.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            No hay rutas todavía.
          </p>
        )}
      </div>
    </div>
  )
}
