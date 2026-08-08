'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { driverFetch } from '@/components/driver/api'
import { captureGpsSamples } from '@/components/driver/geolocation'
import { enqueueAction } from '@/components/driver/outbox'
import type { DeliveriesResponse, DriverMeResponse, VisitStatus } from '@/components/driver/types'

interface DeliveryItem {
  visit_id: string
  status: VisitStatus
  sequence: number
  order: {
    order_number?: string
    customer_name?: string
    address?: string
    city?: string
    amount?: number
    paid_at_sale?: boolean
  } | null
}

const STATUS_LABEL: Record<VisitStatus, string> = {
  pendiente: 'Pendiente',
  en_camino: 'En camino',
  en_ubicacion: 'En el lugar',
  entregado: 'Entregado',
  incidencia: 'Incidencia',
  revisit: 'Revisita',
}

const STATUS_COLOR: Record<VisitStatus, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  en_camino: 'bg-amber-100 text-amber-800',
  en_ubicacion: 'bg-sky-100 text-sky-800',
  entregado: 'bg-emerald-100 text-emerald-800',
  incidencia: 'bg-red-100 text-red-800',
  revisit: 'bg-purple-100 text-purple-800',
}

export function DriverHome() {
  const [me, setMe] = useState<DriverMeResponse | null>(null)
  const [list, setList] = useState<DeliveriesResponse | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [meData, deliveriesData] = await Promise.all([
        driverFetch<DriverMeResponse>('/api/driver/me'),
        driverFetch<DeliveriesResponse>('/api/driver/deliveries'),
      ])
      setMe(meData)
      setList(deliveriesData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await load()
    })()
    const onOnline = () => {
      setOffline(false)
      void load()
    }
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [load])

  async function runTransition(item: DeliveryItem, eventType: 'voy_en_camino' | 'ya_estoy_aqui') {
    setBusyId(item.visit_id)
    try {
      const samples = await captureGpsSamples()
      const endpoint =
        eventType === 'voy_en_camino'
          ? `/api/driver/deliveries/${item.visit_id}/en-route`
          : `/api/driver/deliveries/${item.visit_id}/arrived`

      try {
        await driverFetch(endpoint, { method: 'POST', body: JSON.stringify({ samples }) })
      } catch (err) {
        if (err instanceof TypeError) {
          await enqueueAction({
            idempotencyKey: `${me?.driver.id}:${eventType}:${item.visit_id}:${new Date(samples[1].capturedAt).getTime()}`,
            eventType,
            visitId: item.visit_id,
            samples,
          })
        } else {
          throw err
        }
      }
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar la acción')
    } finally {
      setBusyId(null)
    }
  }

  async function logout() {
    await driverFetch('/api/driver/auth/logout', { method: 'POST' })
    window.location.assign('/driver/login')
  }

  if (loading) {
    return <p className="py-10 text-center text-slate-500">Cargando...</p>
  }

  if (error && !me) {
    return <p className="py-10 text-center text-red-600">{error}</p>
  }

  const progress = me?.incentives?.goal_progress ?? 0
  const progressPercent = Math.min(100, Math.round(progress * 100))

  return (
    <div className="space-y-4">
      {offline && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sin conexión. Tus acciones se guardarán y se enviarán al recuperar señal.
        </div>
      )}

      {me?.closure_pending && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Tenés un cierre de jornada anterior pendiente. Informá a tu administrador.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Hola,</p>
          <p className="text-xl font-bold text-slate-900">{me?.driver.name}</p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
        >
          Salir
        </button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-slate-600">Meta del día</p>
          <p className="text-lg font-bold text-emerald-700">
            ${me?.incentives?.gross ?? 0}
            <span className="text-xs font-normal text-slate-400">
              {' '}
              / ${me?.settings.daily_goal_amount ?? 0}
            </span>
          </p>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-xs text-slate-500">
          <span>
            Efectividad: <b className="text-slate-800">{me?.incentives?.effectiveness_percent ?? 0}%</b>
          </span>
          <span>
            Tu ganancia: <b className="text-emerald-700">${me?.incentives?.driver_share ?? 0}</b>
          </span>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Entregas de hoy <span className="text-slate-400">({list?.deliveries.length ?? 0})</span>
        </h2>

        {(!list?.deliveries || list.deliveries.length === 0) && (
          <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow">
            {me?.closure_pending
              ? 'Cerrá la jornada anterior para ver tus entregas.'
              : 'No tenés entregas asignadas para hoy.'}
          </div>
        )}

        <div className="space-y-2">
          {(list?.deliveries ?? []).map((item) => (
            <div key={item.visit_id} className="rounded-xl bg-white p-4 shadow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.order?.customer_name ?? 'Cliente'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.order?.order_number}
                    {item.order?.city ? ` · ${item.order.city}` : ''}
                  </p>
                  {item.order?.address && (
                    <p className="mt-1 text-xs text-slate-600">📍 {item.order.address}</p>
                  )}
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${STATUS_COLOR[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>

              {item.status === 'pendiente' && (
                <button
                  disabled={busyId === item.visit_id}
                  onClick={() => runTransition(item, 'voy_en_camino')}
                  className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyId === item.visit_id ? 'Capturando GPS...' : '🚚 Voy en camino'}
                </button>
              )}

              {item.status === 'en_camino' && (
                <button
                  disabled={busyId === item.visit_id}
                  onClick={() => runTransition(item, 'ya_estoy_aqui')}
                  className="mt-3 w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyId === item.visit_id ? 'Capturando GPS...' : '📍 Ya estoy aquí'}
                </button>
              )}

              {(item.status === 'en_ubicacion' || item.status === 'pendiente') && (
                <Link
                  href={`/driver/deliveries/${item.visit_id}`}
                  className="mt-3 block w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
                >
                  {item.status === 'en_ubicacion' ? '✅ Entregar' : 'Gestionar entrega'}
                </Link>
              )}

              {item.status === 'incidencia' && (
                <Link
                  href={`/driver/deliveries/${item.visit_id}`}
                  className="mt-3 block w-full rounded-lg border border-purple-300 px-4 py-2.5 text-center text-sm font-semibold text-purple-700"
                >
                  🔄 Ver / Reprogramar
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
