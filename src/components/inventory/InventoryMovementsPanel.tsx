'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/components/inventory/admin-api'

interface Movement {
  id: string
  product_id: string
  product_name: string
  quantity_delta: number
  movement_type: string
  reason: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = {
  initial: 'Inicial',
  sale: 'Venta',
  purchase: 'Compra',
  adjustment: 'Ajuste',
  restock: 'Reposición',
  waste: 'Merma',
  return: 'Devolución',
  import: 'Importación',
}

export function InventoryMovementsPanel({ businessId }: { businessId: string }) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ movements: Movement[] }>(
        '/api/admin/inventory/movements',
        businessId
      )
      setMovements(res.movements)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    }
  }, [businessId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {movements.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-xl border p-4"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                {m.product_name}
              </p>
              <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                {TYPE_LABEL[m.movement_type] ?? m.movement_type}
                {m.reason && ` · ${m.reason}`}
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-sm font-bold"
                style={{ color: m.quantity_delta < 0 ? '#B91C1C' : '#15803D' }}
              >
                {m.quantity_delta > 0 ? '+' : ''}
                {m.quantity_delta}
              </p>
              <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                {new Date(m.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}

        {movements.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            No hay movimientos registrados.
          </p>
        )}
      </div>
    </div>
  )
}
