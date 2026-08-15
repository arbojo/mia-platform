'use client'

import { Bell } from 'lucide-react'
import { useI18n } from '@/components/dashboard/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries'

type SignalState = 'tranquila' | 'observacion' | 'atencion' | 'decision'

const signalConfig: Record<SignalState, { color: string; glow: string }> = {
  tranquila: {
    color: 'var(--mia-platinum)',
    glow: 'rgba(155, 170, 184, 0)',
  },
  observacion: {
    color: 'var(--mia-cyan)',
    glow: 'rgba(59, 196, 224, 0.3)',
  },
  atencion: {
    color: 'var(--mia-gold)',
    glow: 'rgba(201, 168, 76, 0.4)',
  },
  decision: {
    color: 'var(--mia-orange)',
    glow: 'rgba(212, 116, 58, 0.5)',
  },
}

const signalLabels: Record<SignalState, keyof Dict['signals']> = {
  tranquila: 'calm',
  observacion: 'observing',
  atencion: 'attention',
  decision: 'decision',
}

export function SignalIndicator({
  state = 'tranquila',
  onClick,
}: {
  state?: SignalState
  onClick?: () => void
}) {
  const { t } = useI18n()
  const config = signalConfig[state]

  return (
    <button
      data-tour="signals-bell"
      onClick={onClick}
      className="relative flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200"
      style={{
        color: state === 'tranquila' ? 'var(--atmosphere-text-secondary)' : config.color,
      }}
      title={t.signals[signalLabels[state]]}
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
