'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/components/delivery/admin-api'

interface Closure {
  id: string
  closure_date: string
  route_id: string | null
  expected_total: number
  cash_counted: number
  difference: number
  expenses: Record<string, number>
  notes: string | null
  closed_by: string | null
  created_at: string
  drivers: { name: string; sequential_number: number } | null
  routes: { route_date: string } | null
}

interface RouteOption {
  id: string
  route_date: string
  driver_id: string | null
  status: string
  drivers: { name: string } | null
}

export function DeliveryClosuresPanel({ businessId }: { businessId: string }) {
  const [closures, setClosures] = useState<Closure[]>([])
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [routeId, setRouteId] = useState('')
  const [cashCounted, setCashCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [closuresRes, routesRes] = await Promise.all([
        adminFetch<{ closures: Closure[] }>('/api/admin/delivery/closures', businessId),
        adminFetch<{ routes: RouteOption[] }>('/api/admin/delivery/routes', businessId),
      ])
      setClosures(closuresRes.closures)
      setRoutes(routesRes.routes.filter((r) => r.status !== 'closed'))
      setRouteId((current) => current || routesRes.routes.filter((r) => r.status !== 'closed')[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    }
  }, [businessId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  async function closeRoute() {
    if (!routeId) return
    setBusy(true)
    setError(null)
    try {
      await adminFetch('/api/admin/delivery/closures', businessId, {
        method: 'POST',
        body: JSON.stringify({
          routeId,
          cashCounted: Number(cashCounted) || 0,
          notes: notes || undefined,
        }),
      })
      setCashCounted('')
      setNotes('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar la jornada')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4" data-tour="delivery-closures">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Cerrar jornada (admin)
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          >
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.drivers?.name ?? 'Sin repartidor'} · {route.route_date}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            value={cashCounted}
            onChange={(e) => setCashCounted(e.target.value)}
            placeholder="Efectivo contado ($)"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas del cierre (opcional)"
          className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--atmosphere-border)' }}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={closeRoute}
          disabled={busy || !routeId}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--atmosphere-accent)' }}
        >
          {busy ? 'Cerrando...' : 'Cerrar jornada'}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Cierres
        </h3>
        {closures.map((closure) => {
          const difference = Math.abs(closure.difference)
          const ok = closure.difference === 0
          return (
            <div
              key={closure.id}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--atmosphere-border)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                    {closure.drivers?.name ?? 'Repartidor'} · {closure.closure_date}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    Esperado: ${closure.expected_total} · Contado: ${closure.cash_counted}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: ok ? '#dcfce7' : '#fee2e2',
                    color: ok ? '#166534' : '#991b1b',
                  }}
                >
                  {ok ? 'OK' : `Dif. $${difference}`}
                </span>
              </div>
              {closure.notes && (
                <p className="mt-2 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {closure.notes}
                </p>
              )}
            </div>
          )
        })}

        {closures.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            No hay cierres todavía.
          </p>
        )}
      </div>
    </div>
  )
}
