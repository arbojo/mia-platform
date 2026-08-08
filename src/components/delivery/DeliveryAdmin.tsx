'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/components/delivery/admin-api'
import { DeliverySettingsPanel } from '@/components/delivery/DeliverySettingsPanel'
import { DeliveryDriversPanel } from '@/components/delivery/DeliveryDriversPanel'
import { DeliveryOrdersPanel } from '@/components/delivery/DeliveryOrdersPanel'
import { DeliveryRoutesPanel } from '@/components/delivery/DeliveryRoutesPanel'
import { DeliveryClosuresPanel } from '@/components/delivery/DeliveryClosuresPanel'

interface Metrics {
  total_orders: number
  active_drivers: number
  total_routes: number
  total_closures: number
  total_collected: number
}

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'drivers', label: 'Repartidores' },
  { id: 'orders', label: 'Órdenes' },
  { id: 'routes', label: 'Rutas' },
  { id: 'closures', label: 'Cierres' },
] as const

type TabId = (typeof TABS)[number]['id']

export function DeliveryAdmin({ businessId }: { businessId: string }) {
  const [tab, setTab] = useState<TabId>('overview')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminFetch<{ metrics: Metrics }>('/api/admin/delivery/metrics', businessId)
      .then((res) => setMetrics(res.metrics))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
  }, [businessId])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--atmosphere-text)' }}>
          Delivery Hub
        </h1>
        <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Repartidores, entregas y cierres de jornada
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {metrics && tab === 'overview' && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Órdenes', value: metrics.total_orders },
            { label: 'Repartidores activos', value: metrics.active_drivers },
            { label: 'Rutas', value: metrics.total_routes },
            { label: 'Cierres', value: metrics.total_closures },
            { label: 'Cobrado', value: `$${metrics.total_collected}` },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--atmosphere-border)' }}
            >
              <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                {card.label}
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: 'var(--atmosphere-accent)' }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              color: tab === t.id ? 'white' : 'var(--atmosphere-text-secondary)',
              backgroundColor: tab === t.id ? 'var(--atmosphere-accent)' : 'transparent',
              border: '1px solid var(--atmosphere-border)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === 'overview' && <DeliverySettingsPanel businessId={businessId} />}
        {tab === 'drivers' && <DeliveryDriversPanel businessId={businessId} />}
        {tab === 'orders' && <DeliveryOrdersPanel businessId={businessId} />}
        {tab === 'routes' && <DeliveryRoutesPanel businessId={businessId} />}
        {tab === 'closures' && <DeliveryClosuresPanel businessId={businessId} />}
      </div>
    </div>
  )
}
