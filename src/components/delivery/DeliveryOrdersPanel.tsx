'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/components/delivery/admin-api'

interface DeliveryOrder {
  id: string
  order_number: string | null
  customer_name: string | null
  phone: string | null
  address: string | null
  city: string | null
  amount: number | null
  paid_at_sale: boolean
  items: unknown
  status: string
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'pending_assignment', label: 'Sin asignar' },
  { value: 'assigned', label: 'Asignadas' },
  { value: 'delivered', label: 'Entregadas' },
  { value: 'incidence', label: 'Con incidencia' },
  { value: 'cancelled', label: 'Canceladas' },
]

export function DeliveryOrdersPanel({ businessId }: { businessId: string }) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [status, setStatus] = useState('pending_assignment')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(
    async (currentStatus: string) => {
      try {
        const res = await adminFetch<{ orders: DeliveryOrder[] }>(
          `/api/admin/delivery/orders?status=${encodeURIComponent(currentStatus)}`,
          businessId
        )
        setOrders(res.orders)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar')
      }
    },
    [businessId]
  )

  useEffect(() => {
    void (async () => {
      await load(status)
    })()
  }, [load, status])

  async function cancel(order: DeliveryOrder) {
    setBusyId(order.id)
    setError(null)
    try {
      await adminFetch(`/api/admin/delivery/orders/${order.id}/cancel`, businessId, {
        method: 'POST',
      })
      await load(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatus(opt.value)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{
              color: status === opt.value ? 'white' : 'var(--atmosphere-text-secondary)',
              backgroundColor: status === opt.value ? 'var(--atmosphere-accent)' : 'transparent',
              border: '1px solid var(--atmosphere-border)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                  {order.order_number ?? 'Sin número'} · {order.customer_name ?? 'Cliente'}
                </p>
                <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {[order.address, order.city].filter(Boolean).join(', ') || 'Sin dirección'}
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--atmosphere-accent)' }}>
                  ${order.amount ?? 0}
                  {order.paid_at_sale && (
                    <span className="text-xs font-normal"> · pagado</span>
                  )}
                </p>
              </div>
              {order.status === 'pending_assignment' && (
                <button
                  onClick={() => cancel(order)}
                  disabled={busyId === order.id}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            No hay órdenes en este estado.
          </p>
        )}
      </div>
    </div>
  )
}
