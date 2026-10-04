'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  SEVERITY_LABELS,
  TEACHING_TYPE_LABELS,
  type LearningCorrectionType,
} from '@/lib/knowledge/teaching'

interface PendingEvent {
  id: string
  correction_type: LearningCorrectionType
  severity: string | null
  category: string | null
  original_response: string | null
  corrected_response: string | null
  /** Texto que se materializará al aprobar, ya resuelto por el servidor. */
  content: string | null
  created_at: string
}

interface PendingTeachListProps {
  assistantId: string
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-gray-50 text-gray-600 border-gray-200',
  low: 'bg-gray-50 text-gray-500 border-gray-200',
}

export function PendingTeachList({ assistantId }: PendingTeachListProps) {
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPending = useCallback(() => {
    if (!assistantId) return
    fetch(`/api/laboratorio/teach/pending?assistantId=${assistantId}`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events ?? [])
        setError(null)
      })
      .catch(() => setError('No se pudo cargar la bandeja'))
      .finally(() => setLoading(false))
  }, [assistantId])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  const resolve = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id)
    try {
      const res = await fetch('/api/laboratorio/teach/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id))
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'No se pudo resolver la enseñanza')
      }
    } catch {
      setError('Error de red')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-sm font-semibold text-gray-900 mb-2">
        📥 Enseñanzas por revisar
      </p>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {loading && <p className="text-xs text-gray-500">Cargando...</p>}

      {!loading && events.length === 0 && (
        <p className="text-xs text-gray-500">Sin enseñanzas pendientes 🎉</p>
      )}

      <ul className="space-y-2">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-gray-200 p-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-brand-700">
                {TEACHING_TYPE_LABELS[event.correction_type]}
              </span>
              <span className="text-[10px] text-gray-400">
                {new Date(event.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {event.severity && event.correction_type === 'mistake_prevention' && (
              <span
                className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.medium
                }`}
              >
                Severidad {SEVERITY_LABELS[event.severity] ?? event.severity}
              </span>
            )}

            {event.correction_type === 'knowledge' && (
              <p className="text-xs text-gray-700 line-clamp-2">
                <span className="font-medium">Q:</span> {event.original_response}
              </p>
            )}
            <p className="text-xs text-gray-500 line-clamp-3">
              {event.content ?? 'Sin contenido: no se puede aprobar'}
            </p>

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busyId === event.id || !event.content}
                title={event.content ? undefined : 'Este evento no tiene contenido aprobable'}
                onClick={() => resolve(event.id, 'approve')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === event.id}
                onClick={() => resolve(event.id, 'reject')}
                className="flex-1 text-gray-500"
              >
                Descartar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}