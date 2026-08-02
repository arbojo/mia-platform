'use client'

import { useEffect, useRef } from 'react'
import { X, Sparkles } from 'lucide-react'

export function MIAInbox({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

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
            Conversaciones iniciadas por MIA
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

      <div className="max-h-96 overflow-y-auto p-6">
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
            No hay señales todavía
          </p>
          <p
            className="mt-1 max-w-[240px] text-xs leading-relaxed"
            style={{ color: '#64748b' }}
          >
            MIA te avisará cuando detecte algo importante en tus conversaciones.
          </p>
        </div>
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
