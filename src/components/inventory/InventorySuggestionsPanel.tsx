'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/components/inventory/admin-api'

interface Suggestion {
  id: string
  product_name: string
  sku: string | null
  current_quantity: number
  low_stock_threshold: number
  suggested_qty: number
  reason: {
    low_stock?: boolean
    days_out?: number | null
    velocity7d?: number
    velocity30d?: number
  }
  ai_summary: string | null
  ai_used: boolean
  status: 'pending' | 'dismissed' | 'done'
}

export function InventorySuggestionsPanel({ businessId }: { businessId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [generating, setGenerating] = useState(false)
  const [aiBusyId, setAiBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ suggestions: Suggestion[] }>(
        '/api/admin/inventory/suggestions',
        businessId
      )
      setSuggestions(res.suggestions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    }
  }, [businessId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  async function generate() {
    setGenerating(true)
    setError(null)
    setMessage(null)
    try {
      const res = await adminFetch<{ result: { created: number; refreshed: number } }>(
        '/api/admin/inventory/suggestions',
        businessId,
        { method: 'POST' }
      )
      setMessage(`Generadas: ${res.result.created} nuevas, ${res.result.refreshed} actualizadas`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar')
    } finally {
      setGenerating(false)
    }
  }

  async function setStatus(suggestion: Suggestion, status: 'dismissed' | 'done') {
    setError(null)
    try {
      await adminFetch('/api/admin/inventory/suggestions', businessId, {
        method: 'PATCH',
        body: JSON.stringify({ suggestion_id: suggestion.id, status }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar')
    }
  }

  async function generateAi(suggestion: Suggestion) {
    setAiBusyId(suggestion.id)
    setError(null)
    try {
      const res = await adminFetch<{ note: string }>(
        '/api/admin/inventory/suggestions/ai',
        businessId,
        {
          method: 'POST',
          body: JSON.stringify({ suggestion_id: suggestion.id }),
        }
      )
      await load()
      setMessage(res.note)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar nota IA')
    } finally {
      setAiBusyId(null)
    }
  }

  const pending = suggestions.filter((s) => s.status === 'pending')

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <button
        onClick={generate}
        disabled={generating}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--atmosphere-accent)' }}
      >
        {generating ? 'Generando…' : 'Generar sugerencias de reposición'}
      </button>

      <div className="space-y-2">
        {pending.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--atmosphere-border)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                  {s.product_name} {s.sku && <span className="font-normal">· {s.sku}</span>}
                </p>
                <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  Stock actual: {s.current_quantity} · Umbral: {s.low_stock_threshold} ·{' '}
                  Velocidad: {s.reason.velocity7d ?? 0}/7d
                </p>
                <p className="mt-1 text-sm font-bold" style={{ color: 'var(--atmosphere-accent)' }}>
                  Reponer: {s.suggested_qty} unidades
                </p>

                {s.ai_summary && (
                  <p
                    className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs"
                    style={{ color: '#78350F' }}
                  >
                    ✨ {s.ai_summary}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!s.ai_summary && (
                  <button
                    onClick={() => generateAi(s)}
                    disabled={aiBusyId === s.id}
                    className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
                    style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text)' }}
                  >
                    {aiBusyId === s.id ? 'Analizando…' : '✨ Nota IA'}
                  </button>
                )}
                <button
                  onClick={() => setStatus(s, 'dismissed')}
                  className="rounded-lg border px-3 py-1.5 text-xs"
                  style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text)' }}
                >
                  Descartar
                </button>
                <button
                  onClick={() => setStatus(s, 'done')}
                  className="rounded-lg px-3 py-1.5 text-xs text-white"
                  style={{ backgroundColor: 'var(--atmosphere-accent)' }}
                >
                  Hecho
                </button>
              </div>
            </div>
          </div>
        ))}

        {pending.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            No hay sugerencias pendientes. Generalas para ver qué productos reponer.
          </p>
        )}
      </div>
    </div>
  )
}
