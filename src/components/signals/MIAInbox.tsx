'use client'

import { useEffect, useRef } from 'react'
import { X, Sparkles, Lightbulb, AlertTriangle, HelpCircle } from 'lucide-react'

type Priority = 'info' | 'observacion' | 'atencion' | 'decision'

interface Signal {
  id: string
  type: string
  priority: Priority
  title: string
  message: string
  action_available: string | null
  created_at: string
}

const priorityConfig: Record<Priority, { icon: React.ElementType; color: string; label: string }> = {
  info: { icon: Sparkles, color: 'var(--mia-platinum)', label: 'Info' },
  observacion: { icon: Lightbulb, color: 'var(--mia-cyan)', label: 'Observación' },
  atencion: { icon: AlertTriangle, color: 'var(--mia-gold)', label: 'Atención' },
  decision: { icon: HelpCircle, color: 'var(--mia-orange)', label: 'Decisión' },
}

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

  const signals: Signal[] = [
    {
      id: '1',
      type: 'CUSTOMER',
      priority: 'observacion',
      title: '5 clientes preguntaron por el mismo tema',
      message: 'Esta semana varios clientes preguntaron "¿Cuándo veré resultados?". Podemos mejorar la explicación.',
      action_available: 'Analizar',
      created_at: '2026-07-29T10:00:00Z',
    },
    {
      id: '2',
      type: 'SALES',
      priority: 'atencion',
      title: 'Cliente interesado con objeción de precio',
      message: 'María López está interesada pero tiene una objeción de precio. Revisa la conversación.',
      action_available: 'Revisar',
      created_at: '2026-07-29T09:30:00Z',
    },
    {
      id: '3',
      type: 'DECISION',
      priority: 'decision',
      title: 'Posible mejora de respuesta encontrada',
      message: 'Encontré una forma más clara de explicar el envío gratis. ¿Quieres aplicarla?',
      action_available: 'Aplicar',
      created_at: '2026-07-29T08:00:00Z',
    },
  ]

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        backgroundColor: 'var(--atmosphere-bg)',
        borderColor: 'var(--atmosphere-border)',
        boxShadow: `0 20px 60px rgba(0,0,0,0.3)`,
      }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: 'var(--atmosphere-border)' }}
      >
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            MIA Signals
          </h3>
          <p
            className="text-xs"
            style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
          >
            Conversaciones iniciadas por MIA
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 transition-colors duration-200"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-96 space-y-1 overflow-y-auto p-2">
        {signals.map((signal) => {
          const pc = priorityConfig[signal.priority]
          const Icon = pc.icon
          return (
            <div
              key={signal.id}
              className="group rounded-xl p-4 transition-all duration-200"
              style={{
                backgroundColor: 'var(--elevation-1)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${pc.color}15`,
                    color: pc.color,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium leading-snug"
                      style={{ color: 'var(--atmosphere-text)' }}
                    >
                      {signal.title}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                      style={{
                        backgroundColor: `${pc.color}15`,
                        color: pc.color,
                      }}
                    >
                      {pc.label}
                    </span>
                  </div>
                  <p
                    className="mt-1 text-xs leading-relaxed"
                    style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.8 }}
                  >
                    {signal.message}
                  </p>
                  {signal.action_available && (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
                        style={{
                          backgroundColor: pc.color,
                          color: 'white',
                        }}
                      >
                        {signal.action_available}
                      </button>
                      <button
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
                        style={{
                          backgroundColor: 'var(--elevation-2)',
                          color: 'var(--atmosphere-text-secondary)',
                        }}
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="border-t px-5 py-3 text-center"
        style={{ borderColor: 'var(--atmosphere-border)' }}
      >
        <p
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.4 }}
        >
          MIA habla cuando tiene algo importante que decir
        </p>
      </div>
    </div>
  )
}
