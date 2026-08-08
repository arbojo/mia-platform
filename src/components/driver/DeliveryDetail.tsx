'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { driverFetch } from '@/components/driver/api'
import { captureGpsSamples } from '@/components/driver/geolocation'
import { enqueueAction } from '@/components/driver/outbox'
import { DeliverForm } from '@/components/driver/DeliverForm'
import { IncidentForm } from '@/components/driver/IncidentForm'

interface DeliveryDetailData {
  visit_id: string
  status: string
  received_by_kinship: string | null
  incident_type: string | null
  schedule_revisit: boolean
  order: {
    id: string
    order_number?: string
    customer_name?: string
    phone?: string
    address?: string
    city?: string
    amount?: number
    paid_at_sale?: boolean
  } | null
  evidence: Array<{ url: string; created_at: string }>
}

export function DeliveryDetail({ visitId }: { visitId: string }) {
  const router = useRouter()
  const [data, setData] = useState<DeliveryDetailData | null>(null)
  const [driverId, setDriverId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const detail = await driverFetch<DeliveryDetailData>(`/api/driver/deliveries/${visitId}`)
      setData(detail)
      try {
        const me = await driverFetch<{ driver: { id: string } }>('/api/driver/me')
        setDriverId(me.driver.id)
      } catch {
        setDriverId('driver')
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [visitId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  async function runTransition(eventType: 'voy_en_camino' | 'ya_estoy_aqui') {
    setBusy(true)
    try {
      const samples = await captureGpsSamples()
      const endpoint =
        eventType === 'voy_en_camino'
          ? `/api/driver/deliveries/${visitId}/en-route`
          : `/api/driver/deliveries/${visitId}/arrived`

      try {
        await driverFetch(endpoint, { method: 'POST', body: JSON.stringify({ samples }) })
      } catch (err) {
        if (err instanceof TypeError && driverId) {
          await enqueueAction({
            idempotencyKey: `${driverId}:${eventType}:${visitId}:${new Date(samples[1].capturedAt).getTime()}`,
            eventType,
            visitId,
            orderId: data?.order?.id,
            samples,
          })
        } else {
          throw err
        }
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la acción')
    } finally {
      setBusy(false)
    }
  }

  async function reschedule() {
    setBusy(true)
    try {
      await driverFetch(`/api/driver/deliveries/${visitId}/revisit`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reprogramar')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-slate-500">Cargando...</p>
  }

  if (error && !data) {
    return <p className="py-10 text-center text-red-600">{error}</p>
  }

  if (!data) return null

  const order = data.order

  return (
    <div className="space-y-4">
      <button onClick={() => router.push('/driver')} className="text-sm text-emerald-700">
        ← Volver
      </button>

      <div className="rounded-xl bg-white p-4 shadow">
        <p className="text-lg font-bold text-slate-900">{order?.customer_name ?? 'Cliente'}</p>
        {order?.order_number && <p className="text-xs text-slate-500">{order.order_number}</p>}
        {order?.address && <p className="mt-2 text-sm text-slate-600">📍 {order.address}</p>}
        {order?.city && <p className="text-xs text-slate-400">{order.city}</p>}
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-slate-500">Importe</span>
          <span className="font-semibold">
            {order?.paid_at_sale ? `$${order?.amount ?? 0} (pagado)` : `$${order?.amount ?? 0}`}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-slate-500">Estado</span>
          <span className="font-semibold capitalize text-slate-800">{data.status}</span>
        </div>
      </div>

      {data.status === 'pendiente' && (
        <button
          disabled={busy}
          onClick={() => runTransition('voy_en_camino')}
          className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Capturando GPS...' : '🚚 Voy en camino'}
        </button>
      )}

      {data.status === 'en_camino' && (
        <button
          disabled={busy}
          onClick={() => runTransition('ya_estoy_aqui')}
          className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Capturando GPS...' : '📍 Ya estoy aquí'}
        </button>
      )}

      {data.status === 'en_ubicacion' && (
        <>
          <DeliverForm
            visitId={visitId}
            orderId={order?.id ?? ''}
            driverId={driverId ?? ''}
            amount={order?.paid_at_sale ? null : (order?.amount ?? null)}
            onDone={() => void load()}
          />
          <IncidentForm visitId={visitId} onDone={() => void load()} />
        </>
      )}

      {data.status === 'incidencia' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow">
            Incidencia registrada:
            <p className="mt-1 font-semibold capitalize text-slate-800">{data.incident_type}</p>
          </div>
          <IncidentForm visitId={visitId} onDone={() => void load()} />
          {!data.schedule_revisit && (
            <button
              disabled={busy}
              onClick={reschedule}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              🔄 Programar revisita
            </button>
          )}
        </div>
      )}

      {data.status === 'revisit' && (
        <button
          disabled={busy}
          onClick={() => runTransition('voy_en_camino')}
          className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Capturando GPS...' : '🔄 Reintentar entrega'}
        </button>
      )}

      {data.status === 'entregado' && (
        <div className="rounded-xl bg-white p-4 text-sm text-emerald-700 shadow">
          ✓ Entregado
          {data.received_by_kinship && (
            <p className="mt-1 text-slate-600">
              Recibió: <span className="capitalize">{data.received_by_kinship}</span>
            </p>
          )}
        </div>
      )}

      {data.evidence.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-600">Evidencia</p>
          <div className="grid grid-cols-2 gap-2">
            {data.evidence.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.url}
                src={photo.url}
                alt="Evidencia de entrega"
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
