'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/components/inventory/admin-api'

interface StockItem {
  product_id: string
  product_name: string
  sku: string | null
  price: number | null
  quantity: number
  low_stock_threshold: number
  version: number
  status: 'ok' | 'low' | 'out'
  daysOut: number | null
  velocity7d: number
  velocity30d: number
}

const STATUS_LABEL: Record<StockItem['status'], string> = {
  ok: 'OK',
  low: 'Bajo',
  out: 'Agotado',
}

export function InventoryStockPanel({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<StockItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ items: StockItem[] }>(
        '/api/admin/inventory/items',
        businessId
      )
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    }
  }, [businessId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  async function adjust(item: StockItem, delta: number) {
    setBusyId(item.product_id)
    setError(null)
    try {
      await adminFetch('/api/admin/inventory/adjustments', businessId, {
        method: 'POST',
        body: JSON.stringify({
          product_id: item.product_id,
          delta,
          movement_type: 'adjustment',
          reason: delta > 0 ? 'Corrección manual (entrada)' : 'Corrección manual (salida)',
          expected_version: item.version,
        }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ajustar')
    } finally {
      setBusyId(null)
    }
  }

  async function setThreshold(item: StockItem, value: number) {
    setBusyId(item.product_id)
    setError(null)
    try {
      await adminFetch('/api/admin/inventory/items/threshold', businessId, {
        method: 'PATCH',
        body: JSON.stringify({
          product_id: item.product_id,
          low_stock_threshold: value,
        }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar umbral')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.product_id}
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                    {item.product_name}
                  </p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      color: item.status === 'out' ? '#B91C1C' : item.status === 'low' ? '#B45309' : '#15803D',
                      backgroundColor:
                        item.status === 'out'
                          ? 'rgba(185,28,28,0.08)'
                          : item.status === 'low'
                          ? 'rgba(180,83,9,0.08)'
                          : 'rgba(21,128,61,0.08)',
                    }}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {item.sku ?? 'Sin SKU'} · ${item.price ?? 0}
                </p>
                <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  Velocidad: {item.velocity7d}/7d · {item.velocity30d}/30d
                  {item.daysOut !== null && ` · última venta hace ${item.daysOut}d`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: 'var(--atmosphere-text)' }}>
                  {item.quantity} uds
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjust(item, -1)}
                  disabled={busyId === item.product_id}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
                  style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text)' }}
                >
                  −1
                </button>
                <button
                  onClick={() => adjust(item, 1)}
                  disabled={busyId === item.product_id}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
                  style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text)' }}
                >
                  +1
                </button>
                <input
                  type="number"
                  min={0}
                  defaultValue={item.low_stock_threshold}
                  onBlur={(e) => setThreshold(item, Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 rounded-lg border px-2 py-1.5 text-xs"
                  style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text)' }}
                  aria-label={`Umbral de ${item.product_name}`}
                />
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            No hay productos en el catálogo.
          </p>
        )}
      </div>
    </div>
  )
}
