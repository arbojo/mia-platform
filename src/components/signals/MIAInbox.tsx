'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Sparkles, Bell, Check } from 'lucide-react'

interface Signal {
  id: string
  type: string
  priority: 'info' | 'observacion' | 'atencion' | 'decision'
  title: string
  message: string
  source: string | null
  status: 'pending' | 'active' | 'resolved' | 'dismissed'
  action_available: string | null
  action_payload: Record<string, unknown> | null
  created_at: string
}

const priorityStyles: Record<Signal['priority'], { color: string; bg: string }> = {
  info: { color: '#475569', bg: 'rgba(100, 116, 139, 0.1)' },
  observacion: { color: 'var(--mia-cyan)', bg: 'rgba(6, 182, 212, 0.12)' },
  atencion: { color: 'var(--mia-gold)', bg: 'rgba(201, 168, 76, 0.12)' },
  decision: { color: 'var(--mia-orange)', bg: 'rgba(212, 116, 58, 0.12)' },
}

export function MIAInbox({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSignals = useCallback(async (): Promise<Signal[]> => {
    const res = await fetch('/api/signals?status=pending&limit=20')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Error al cargar señales')
    return data.signals ?? []
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      setError(null)
      try {
        const signals = await loadSignals()
        if (!cancelled) setSignals(signals)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar señales')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, loadSignals])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  const dismissSignal = async (id: string) => {
    const res = await fetch(`/api/signals/${id}`, { method: 'PATCH' })
    if (res.ok) {
      setSignals((prev) => prev.filter((s) => s.id !== id))
    }
  }

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        backgroundColor: '#ffffff',
        borderColor: 'var(--atmosphere-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: '#e2e8f0' }}
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#1e293b' }}>
            MIA Signals
          </h3>
          <p className="text-xs" style={{ color: '#64748b' }}>
            Alertas y señales del sistema
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar MIA Signals"
          className="rounded-lg p-1.5 transition-colors duration-200"
          style={{ color: '#64748b' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-4">
        {loading ? (
          <div className="py-8 text-center text-xs" style={{ color: '#64748b' }}>
            Cargando señales...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-xs" style={{ color: '#b45309' }}>
            {error}
          </div>
        ) : signals.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(6, 182, 212, 0.12)',
                color: 'var(--mia-cyan)',
              }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-medium" style={{ color: '#1e293b' }}>
              No hay señales pendientes
            </p>
            <p
              className="mt-1 max-w-[240px] text-xs leading-relaxed"
              style={{ color: '#64748b' }}
            >
              MIA te avisará cuando detecte algo importante en tus conversaciones.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {signals.map((signal) => {
              const style = priorityStyles[signal.priority] ?? priorityStyles.info
              return (
                <div
                  key={signal.id}
                  className="rounded-xl border p-3"
                  style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc' }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: style.bg, color: style.color }}
                    >
                      <Bell className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold" style={{ color: '#1e293b' }}>
                        {signal.title}
                      </p>
                      <p
                        className="mt-0.5 text-xs leading-relaxed"
                        style={{ color: '#64748b' }}
                      >
                        {signal.message}
                      </p>
                      <p className="mt-1 text-[10px]" style={{ color: '#94a3b8' }}>
                        {new Date(signal.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => dismissSignal(signal.id)}
                      aria-label="Marcar como resuelta"
                      className="rounded-md p-1 transition-colors hover:bg-black/5"
                      style={{ color: '#94a3b8' }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div
        className="border-t px-5 py-3 text-center"
        style={{ borderColor: '#e2e8f0' }}
      >
        <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>
          MIA habla cuando tiene algo importante que decir
        </p>
      </div>
    </div>
  )
}
