'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/components/delivery/admin-api'

interface Driver {
  id: string
  sequential_number: number
  name: string
  phone: string | null
  vehicle: string | null
  status: 'active' | 'blocked'
  last_lat: number | null
  last_lng: number | null
}

export function DeliveryDriversPanel({ businessId }: { businessId: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLink, setMagicLink] = useState<{ link: string; expiresAt: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ drivers: Driver[] }>('/api/admin/delivery/drivers', businessId)
      setDrivers(res.drivers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    }
  }, [businessId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await adminFetch('/api/admin/delivery/drivers', businessId, {
        method: 'POST',
        body: JSON.stringify({ name, phone: phone || null, vehicle: vehicle || null }),
      })
      setName('')
      setPhone('')
      setVehicle('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setBusy(false)
    }
  }

  async function toggleBlock(driver: Driver) {
    setBusy(true)
    setError(null)
    try {
      await adminFetch(`/api/admin/delivery/drivers/${driver.id}`, businessId, {
        method: 'PATCH',
        body: JSON.stringify({ status: driver.status === 'active' ? 'blocked' : 'active' }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setBusy(false)
    }
  }

  async function generateLink(driver: Driver) {
    setError(null)
    try {
      const res = await adminFetch<{ link: string; expires_at: string }>(
        `/api/admin/delivery/drivers/${driver.id}/token`,
        businessId,
        { method: 'POST' }
      )
      setMagicLink({ link: res.link, expiresAt: res.expires_at })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar enlace')
    }
  }

  async function copyLink() {
    if (!magicLink) return
    await navigator.clipboard.writeText(magicLink.link)
    if (navigator.clipboard && 'share' in navigator) {
      // fallback
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Nuevo repartidor
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          />
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Vehículo"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          />
        </div>
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--atmosphere-accent)' }}
        >
          Agregar
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {drivers.map((driver) => (
          <div
            key={driver.id}
            className="flex items-center justify-between rounded-xl border p-4"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                #{driver.sequential_number} · {driver.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                {[driver.phone, driver.vehicle].filter(Boolean).join(' · ') || 'Sin contacto'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateLink(driver)}
                disabled={busy || driver.status !== 'active'}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              >
                Enlace de acceso
              </button>
              <button
                onClick={() => toggleBlock(driver)}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                style={{
                  backgroundColor: driver.status === 'active' ? '#b91c1c' : 'var(--atmosphere-accent)',
                }}
              >
                {driver.status === 'active' ? 'Bloquear' : 'Activar'}
              </button>
            </div>
          </div>
        ))}

        {drivers.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            No hay repartidores todavía.
          </p>
        )}
      </div>

      {magicLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 text-slate-900">
            <h3 className="text-sm font-semibold">Enlace de acceso</h3>
            <p className="mt-1 text-xs text-slate-500">
              Vence el {new Date(magicLink.expiresAt).toLocaleString()}. Es de un solo uso.
            </p>
            <div className="mt-3 break-all rounded-lg bg-slate-100 p-3 text-xs">
              {magicLink.link}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={copyLink}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Copiar
              </button>
              <button
                onClick={() => setMagicLink(null)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
