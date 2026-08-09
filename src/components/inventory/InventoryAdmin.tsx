'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/components/inventory/admin-api'
import { InventoryStockPanel } from '@/components/inventory/InventoryStockPanel'
import { InventoryMovementsPanel } from '@/components/inventory/InventoryMovementsPanel'
import { InventorySuggestionsPanel } from '@/components/inventory/InventorySuggestionsPanel'
import { InventoryImportPanel } from '@/components/inventory/InventoryImportPanel'

interface Settings {
  enabled: boolean
  default_low_stock_threshold: number
  lead_time_days: number
}

interface Overview {
  items: Array<{ status: string }>
  totals: { total: number; ok: number; low: number; out: number }
}

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'stock', label: 'Stock' },
  { id: 'movements', label: 'Movimientos' },
  { id: 'suggestions', label: 'Reposición' },
  { id: 'import', label: 'Importar' },
] as const

type TabId = (typeof TABS)[number]['id']

export function InventoryAdmin({ businessId }: { businessId: string }) {
  const [tab, setTab] = useState<TabId>('overview')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [overview, setOverview] = useState<Overview['totals'] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    adminFetch<{ settings: Settings | null }>('/api/admin/inventory/settings', businessId)
      .then((res) =>
        setSettings({
          enabled: res.settings?.enabled ?? false,
          default_low_stock_threshold: res.settings?.default_low_stock_threshold ?? 5,
          lead_time_days: res.settings?.lead_time_days ?? 3,
        })
      )
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))

    adminFetch<{ totals: Overview['totals'] }>('/api/admin/inventory/items', businessId)
      .then((res) => setOverview(res.totals))
      .catch(() => setOverview({ total: 0, ok: 0, low: 0, out: 0 }))
  }, [businessId])

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await adminFetch<{ settings: Settings }>(
        '/api/admin/inventory/settings',
        businessId,
        {
          method: 'PATCH',
          body: JSON.stringify({
            enabled: settings.enabled,
            default_low_stock_threshold: settings.default_low_stock_threshold,
            lead_time_days: settings.lead_time_days,
          }),
        }
      )
      setSettings({ ...settings, ...res.settings })
      setMessage('Configuración guardada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--atmosphere-text)' }}>
          Inventory Hub
        </h1>
        <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Stock, movimientos y reposición
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      {settings && tab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                  Módulo de inventario
                </span>
                <span
                  className="block text-xs"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                >
                  Al activar, cada venta confirmada (SALE_WON) descuenta stock automáticamente.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="h-5 w-5"
                aria-label="Habilitar Inventory Hub"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
              <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                Umbral bajo de stock
              </label>
              <input
                type="number"
                min={0}
                value={settings.default_low_stock_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, default_low_stock_threshold: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text)' }}
              />
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
              <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                Tiempo de reabastecimiento (días)
              </label>
              <input
                type="number"
                min={0}
                value={settings.lead_time_days}
                onChange={(e) =>
                  setSettings({ ...settings, lead_time_days: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text)' }}
              />
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--atmosphere-accent)' }}
          >
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>

          {overview && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Productos', value: overview.total },
                { label: 'Con stock', value: overview.ok },
                { label: 'Stock bajo', value: overview.low },
                { label: 'Agotados', value: overview.out },
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
        {tab === 'stock' && <InventoryStockPanel businessId={businessId} />}
        {tab === 'movements' && <InventoryMovementsPanel businessId={businessId} />}
        {tab === 'suggestions' && <InventorySuggestionsPanel businessId={businessId} />}
        {tab === 'import' && <InventoryImportPanel businessId={businessId} />}
      </div>
    </div>
  )
}
