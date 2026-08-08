'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/components/delivery/admin-api'

interface Settings {
  enabled: boolean
  driver_self_checkout: boolean
  whatsapp_notify: boolean
  wa_business_id: string | null
  timezone: string | null
  daily_goal_amount: number | null
  driver_share_percent: number | null
  gps_radius_meters: number | null
}

const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  driver_self_checkout: false,
  whatsapp_notify: false,
  wa_business_id: null,
  timezone: null,
  daily_goal_amount: null,
  driver_share_percent: null,
  gps_radius_meters: null,
}

export function DeliverySettingsPanel({ businessId }: { businessId: string }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ settings: Settings | null }>(
        '/api/admin/delivery/settings',
        businessId
      )
      setSettings({ ...DEFAULT_SETTINGS, ...(res.settings ?? {}) })
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    }
  }, [businessId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  async function save() {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await adminFetch<{ settings: Settings }>(
        '/api/admin/delivery/settings',
        businessId,
        {
          method: 'PATCH',
          body: JSON.stringify({
            enabled: settings.enabled,
            driver_self_checkout: settings.driver_self_checkout,
            whatsapp_notify: settings.whatsapp_notify,
            wa_business_id: settings.wa_business_id,
            timezone: settings.timezone ?? undefined,
            daily_goal_amount: settings.daily_goal_amount ?? 0,
            driver_share_percent: settings.driver_share_percent ?? 0,
            gps_radius_meters: settings.gps_radius_meters ?? 100,
          }),
        }
      )
      setSettings({ ...DEFAULT_SETTINGS, ...res.settings })
      setMessage('Configuración guardada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded && !error) {
    return <p className="py-6 text-center text-sm">Cargando configuración...</p>
  }

  return (
    <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
        Configuración
      </h3>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: 'var(--atmosphere-text)' }}>
          Activar Delivery Hub
        </span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          className="h-4 w-4"
        />
      </label>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: 'var(--atmosphere-text)' }}>
          Cierre diario por el repartidor
        </span>
        <input
          type="checkbox"
          checked={settings.driver_self_checkout}
          onChange={(e) =>
            setSettings({ ...settings, driver_self_checkout: e.target.checked })
          }
          className="h-4 w-4"
        />
      </label>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: 'var(--atmosphere-text)' }}>
          Notificar por WhatsApp
        </span>
        <input
          type="checkbox"
          checked={settings.whatsapp_notify}
          onChange={(e) => setSettings({ ...settings, whatsapp_notify: e.target.checked })}
          className="h-4 w-4"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
          Meta diaria ($)
          <input
            type="number"
            min="0"
            value={settings.daily_goal_amount ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, daily_goal_amount: Number(e.target.value) || null })
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          />
        </label>

        <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
          % del repartidor
          <input
            type="number"
            min="0"
            max="100"
            value={settings.driver_share_percent ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, driver_share_percent: Number(e.target.value) || null })
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          />
        </label>

        <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
          Radio GPS de llegada (m)
          <input
            type="number"
            min="1"
            value={settings.gps_radius_meters ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, gps_radius_meters: Number(e.target.value) || null })
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          />
        </label>
      </div>

      <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
        Zona horaria
        <select
          value={settings.timezone ?? ''}
          onChange={(e) =>
            setSettings({ ...settings, timezone: e.target.value || null })
          }
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--atmosphere-border)' }}
        >
          <option value="">Predeterminada (America/Argentina/Buenos_Aires)</option>
          <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
          <option value="America/Mexico_City">America/Mexico_City</option>
          <option value="America/Bogota">America/Bogota</option>
          <option value="America/Lima">America/Lima</option>
          <option value="America/Santiago">America/Santiago</option>
          <option value="America/Caracas">America/Caracas</option>
          <option value="America/Montevideo">America/Montevideo</option>
        </select>
      </label>

      <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
        WhatsApp Business ID (para enviar notificaciones)
        <input
          type="text"
          value={settings.wa_business_id ?? ''}
          onChange={(e) => setSettings({ ...settings, wa_business_id: e.target.value || null })}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--atmosphere-border)' }}
        />
      </label>

      {message && <p className="text-sm text-emerald-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--atmosphere-accent)' }}
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
