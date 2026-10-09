'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/components/delivery/admin-api'

export interface DeliveryScheduleRow {
  id: string
  city: string
  delivery_days: number[]
  delivery_window_start: string | null
  delivery_window_end: string | null
}

export interface DeliveryOverrideRow {
  id: string
  city: string
  start_date: string
  end_date: string
  delivery_days: number[]
  delivery_window_start: string | null
  delivery_window_end: string | null
  note: string | null
}

interface LoadedData {
  schedules: DeliveryScheduleRow[]
  overrides: DeliveryOverrideRow[]
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

type DayToggleProps = {
  days: number[]
  onChange: (days: number[]) => void
}

function DayToggle({ days, onChange }: DayToggleProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((label, i) => {
        const selected = days.includes(i)
        return (
          <button
            key={i}
            type="button"
            onClick={() =>
              onChange(selected ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b))
            }
            className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              color: selected ? 'white' : 'var(--atmosphere-text-secondary)',
              backgroundColor: selected ? 'var(--atmosphere-accent)' : 'transparent',
              border: '1px solid var(--atmosphere-border)',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function formatDayList(days: number[]): string {
  if (days.length === 0) return 'sin días'
  if (days.length === 7) return 'todos los días'
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d])
    .join(', ')
}

export function DeliverySchedulesPanel({ businessId }: { businessId: string }) {
  const [schedules, setSchedules] = useState<DeliveryScheduleRow[]>([])
  const [overrides, setOverrides] = useState<DeliveryOverrideRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [scheduleForm, setScheduleForm] = useState({
    city: '',
    delivery_days: [] as number[],
    delivery_window_start: '09:00',
    delivery_window_end: '19:00',
  })

  const [overrideForm, setOverrideForm] = useState({
    city: '',
    start_date: '',
    end_date: '',
    delivery_days: [] as number[],
    delivery_window_start: '09:00',
    delivery_window_end: '19:00',
    note: '',
  })

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const res = await adminFetch<LoadedData>('/api/admin/delivery/schedules', businessId)
        if (cancelled) return
        setSchedules(res.schedules)
        setOverrides(res.overrides)
        setLoaded(true)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Error al cargar')
      }
    }
    void fetchData()
    return () => {
      cancelled = true
    }
  }, [businessId])

  async function saveSchedule() {
    setMessage(null)
    setError(null)
    try {
      const res = await adminFetch<{ schedule: DeliveryScheduleRow }>(
        '/api/admin/delivery/schedules',
        businessId,
        {
          method: 'PUT',
          body: JSON.stringify(scheduleForm),
        }
      )
      setScheduleForm({ city: '', delivery_days: [], delivery_window_start: '09:00', delivery_window_end: '19:00' })
      setSchedules((prev) => {
        const rest = prev.filter((s) => s.id !== res.schedule.id && s.city !== res.schedule.city)
        return [...rest, res.schedule].sort((a, b) => a.city.localeCompare(b.city))
      })
      setMessage('Calendario guardado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function deleteSchedule(id: string) {
    setMessage(null)
    setError(null)
    try {
      await adminFetch<{ ok: boolean }>(
        `/api/admin/delivery/schedules?id=${encodeURIComponent(id)}`,
        businessId,
        { method: 'DELETE' }
      )
      setSchedules((prev) => prev.filter((s) => s.id !== id))
      setMessage('Calendario eliminado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  async function saveOverride() {
    setMessage(null)
    setError(null)
    try {
      const res = await adminFetch<{ override: DeliveryOverrideRow }>(
        '/api/admin/delivery/overrides',
        businessId,
        {
          method: 'POST',
          body: JSON.stringify(overrideForm),
        }
      )
      setOverrideForm({
        city: '',
        start_date: '',
        end_date: '',
        delivery_days: [],
        delivery_window_start: '09:00',
        delivery_window_end: '19:00',
        note: '',
      })
      setOverrides((prev) =>
        [...prev, res.override].sort((a, b) => a.start_date.localeCompare(b.start_date))
      )
      setMessage('Excepción agregada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function deleteOverride(id: string) {
    setMessage(null)
    setError(null)
    try {
      await adminFetch<{ ok: boolean }>(
        `/api/admin/delivery/overrides?id=${encodeURIComponent(id)}`,
        businessId,
        { method: 'DELETE' }
      )
      setOverrides((prev) => prev.filter((o) => o.id !== id))
      setMessage('Excepción eliminada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  if (!loaded && !error) {
    return <p className="py-6 text-center text-sm">Cargando calendario de entrega...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Define el calendario base de entrega por ciudad y agrega excepciones temporales
          cuando la ruta cambie solo una semana.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Calendario base por ciudad
        </h3>

        {schedules.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            Sin ciudades configuradas todavía.
          </p>
        )}

        <div className="space-y-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--atmosphere-border)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--atmosphere-text)' }}>
                  {s.city}
                </p>
                <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {formatDayList(s.delivery_days)}
                  {s.delivery_window_start ? ` · ${s.delivery_window_start.slice(0, 5)} a ${(s.delivery_window_end ?? '').slice(0, 5)}` : ''}
                </p>
              </div>
              <button
                onClick={() => deleteSchedule(s.id)}
                className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: 'var(--atmosphere-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
            Agregar / actualizar ciudad
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Ciudad
              <input
                type="text"
                value={scheduleForm.city}
                onChange={(e) => setScheduleForm({ ...scheduleForm, city: e.target.value })}
                placeholder="Ej. Aguascalientes"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Inicio
              <input
                type="time"
                value={scheduleForm.delivery_window_start}
                onChange={(e) => setScheduleForm({ ...scheduleForm, delivery_window_start: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Fin
              <input
                type="time"
                value={scheduleForm.delivery_window_end}
                onChange={(e) => setScheduleForm({ ...scheduleForm, delivery_window_end: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Días de entrega
            </p>
            <DayToggle
              days={scheduleForm.delivery_days}
              onChange={(days) => setScheduleForm({ ...scheduleForm, delivery_days: days })}
            />
          </div>
          <button
            onClick={saveSchedule}
            disabled={!scheduleForm.city.trim() || scheduleForm.delivery_days.length === 0}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--atmosphere-accent)' }}
          >
            Guardar
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Excepciones temporales
        </h3>
        <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Reemplaza el calendario base de una ciudad solo durante el rango de fechas indicado.
        </p>

        {overrides.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            Sin excepciones activas.
          </p>
        )}

        <div className="space-y-2">
          {overrides.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--atmosphere-border)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--atmosphere-text)' }}>
                  {o.city}
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    {o.start_date} → {o.end_date}
                  </span>
                </p>
                <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {formatDayList(o.delivery_days)}
                  {o.delivery_window_start ? ` · ${o.delivery_window_start.slice(0, 5)} a ${(o.delivery_window_end ?? '').slice(0, 5)}` : ''}
                  {o.note ? ` · ${o.note}` : ''}
                </p>
              </div>
              <button
                onClick={() => deleteOverride(o.id)}
                className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: 'var(--atmosphere-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
            Nueva excepción
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Ciudad
              <input
                type="text"
                value={overrideForm.city}
                onChange={(e) => setOverrideForm({ ...overrideForm, city: e.target.value })}
                placeholder="Ej. Aguascalientes"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Desde
              <input
                type="date"
                value={overrideForm.start_date}
                onChange={(e) => setOverrideForm({ ...overrideForm, start_date: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Hasta
              <input
                type="date"
                value={overrideForm.end_date}
                onChange={(e) => setOverrideForm({ ...overrideForm, end_date: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Nota (opcional)
              <input
                type="text"
                value={overrideForm.note}
                onChange={(e) => setOverrideForm({ ...overrideForm, note: e.target.value })}
                placeholder="Ej. ruta extra esta semana"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Inicio
              <input
                type="time"
                value={overrideForm.delivery_window_start}
                onChange={(e) => setOverrideForm({ ...overrideForm, delivery_window_start: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
              Fin
              <input
                type="time"
                value={overrideForm.delivery_window_end}
                onChange={(e) => setOverrideForm({ ...overrideForm, delivery_window_end: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              />
            </label>
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
                Días de entrega
              </p>
              <DayToggle
                days={overrideForm.delivery_days}
                onChange={(days) => setOverrideForm({ ...overrideForm, delivery_days: days })}
              />
            </div>
          </div>
          <button
            onClick={saveOverride}
            disabled={
              !overrideForm.city.trim() ||
              !overrideForm.start_date ||
              !overrideForm.end_date ||
              overrideForm.end_date < overrideForm.start_date ||
              overrideForm.delivery_days.length === 0
            }
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--atmosphere-accent)' }}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}