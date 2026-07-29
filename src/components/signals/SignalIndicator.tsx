'use client'

import { Bell } from 'lucide-react'

type SignalState = 'tranquila' | 'observacion' | 'atencion' | 'decision'

const signalConfig: Record<SignalState, { color: string; glow: string; label: string }> = {
  tranquila: {
    color: 'var(--mia-platinum)',
    glow: 'rgba(155, 170, 184, 0)',
    label: 'MIA está tranquila',
  },
  observacion: {
    color: 'var(--mia-cyan)',
    glow: 'rgba(59, 196, 224, 0.3)',
    label: 'MIA encontró algo interesante',
  },
  atencion: {
    color: 'var(--mia-gold)',
    glow: 'rgba(201, 168, 76, 0.4)',
    label: 'MIA necesita tu atención',
  },
  decision: {
    color: 'var(--mia-orange)',
    glow: 'rgba(212, 116, 58, 0.5)',
    label: 'MIA necesita tu decisión',
  },
}

export function SignalIndicator({
  state = 'tranquila',
  onClick,
}: {
  state?: SignalState
  onClick?: () => void
}) {
  const config = signalConfig[state]

  return (
    <button
      onClick={onClick}
      className="relative flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200"
      style={{
        color: state === 'tranquila' ? 'var(--atmosphere-text-secondary)' : config.color,
      }}
      title={config.label}
    >
      <Bell className="h-3.5 w-3.5" />
      {state !== 'tranquila' && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
          style={{
            backgroundColor: config.color,
            boxShadow: `0 0 6px ${config.glow}`,
          }}
        />
      )}
    </button>
  )
}
