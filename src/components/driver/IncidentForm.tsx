'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { driverFetch } from '@/components/driver/api'
import { captureGpsSamples } from '@/components/driver/geolocation'
import { enqueueAction } from '@/components/driver/outbox'
import { isRetryableError } from '@/components/driver/offline'

const INCIDENT_TYPES = [
  { value: 'domicilio_incorrecto', label: 'Dirección incorrecta/errónea' },
  { value: 'no_se_encuentra', label: 'No se encuentra' },
  { value: 'rechazado', label: 'Cliente rechazó el pedido' },
  { value: 'zona_inaccesible', label: 'Zona inaccesible' },
  { value: 'cliente_ausente', label: 'Cliente ausente' },
  { value: 'otro', label: 'Otra' },
]

export function IncidentForm({
  visitId,
  onDone,
}: {
  visitId: string
  onDone: () => void
}) {
  const router = useRouter()
  const [incidentType, setIncidentType] = useState('cliente_ausente')
  const [notes, setNotes] = useState('')
  const [scheduleRevisit, setScheduleRevisit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)

    let samples: Array<{ lat: number; lng: number; capturedAt: string }> | undefined
    try {
      samples = await captureGpsSamples()
    } catch {
      samples = undefined
    }

    try {
      try {
        await driverFetch(`/api/driver/deliveries/${visitId}/incident`, {
          method: 'POST',
          body: JSON.stringify({
            incidentType,
            notes: notes || undefined,
            scheduleRevisit,
            samples,
          }),
        })
      } catch (err) {
        if (isRetryableError(err)) {
          const capturedAt = samples?.[1]?.capturedAt ?? new Date().toISOString()
          await enqueueAction({
            idempotencyKey: `driver:incidencia_reportada:${visitId}:${new Date(capturedAt).getTime()}`,
            eventType: 'incidencia_reportada',
            visitId,
            samples,
            payload: {
              incident_type: incidentType,
              notes: notes || undefined,
              schedule_revisit: scheduleRevisit,
            },
          })
        } else {
          throw err
        }
      }
      router.push('/driver')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la incidencia')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow">
      <p className="text-sm font-semibold text-slate-700">Registrar incidencia</p>

      <label className="block text-xs font-medium text-slate-500">
        Motivo
        <select
          value={incidentType}
          onChange={(e) => setIncidentType(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {INCIDENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-medium text-slate-500">
        Notas (opcional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={scheduleRevisit}
          onChange={(e) => setScheduleRevisit(e.target.checked)}
          className="h-4 w-4"
        />
        Programar una revisita
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Registrando...' : 'Reportar incidencia'}
      </button>
    </div>
  )
}
