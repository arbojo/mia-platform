'use client'

import { useState } from 'react'
import { DeliverySettingsPanel } from '@/components/delivery/DeliverySettingsPanel'
import { DeliveryDriversPanel } from '@/components/delivery/DeliveryDriversPanel'
import { DeliveryOrdersPanel } from '@/components/delivery/DeliveryOrdersPanel'
import { DeliveryRoutesPanel } from '@/components/delivery/DeliveryRoutesPanel'
import { DeliveryClosuresPanel } from '@/components/delivery/DeliveryClosuresPanel'
import { CommandCenterPanel } from '@/components/delivery/CommandCenterPanel'

const TABS = [
  { id: 'overview', label: 'Centro de mando' },
  { id: 'drivers', label: 'Repartidores' },
  { id: 'orders', label: 'Órdenes' },
  { id: 'routes', label: 'Rutas' },
  { id: 'closures', label: 'Cierres' },
  { id: 'settings', label: 'Configuración' },
] as const

type TabId = (typeof TABS)[number]['id']

export function DeliveryAdmin({ businessId }: { businessId: string }) {
  const [tab, setTab] = useState<TabId>('overview')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--atmosphere-text)' }}>
          Delivery Hub
        </h1>
        <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Centro de mando — repartidores, entregas y rentabilidad
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
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
        {tab === 'overview' && <CommandCenterPanel businessId={businessId} />}
        {tab === 'drivers' && <DeliveryDriversPanel businessId={businessId} />}
        {tab === 'orders' && <DeliveryOrdersPanel businessId={businessId} />}
        {tab === 'routes' && <DeliveryRoutesPanel businessId={businessId} />}
        {tab === 'closures' && <DeliveryClosuresPanel businessId={businessId} />}
        {tab === 'settings' && <DeliverySettingsPanel businessId={businessId} />}
      </div>
    </div>
  )
}
