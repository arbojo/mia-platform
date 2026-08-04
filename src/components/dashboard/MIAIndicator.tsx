'use client'

import { useEffect, useRef } from 'react'

type MIAStatus = 'active' | 'learning' | 'paused'

interface MIAIndicatorProps {
  status?: MIAStatus
}

const presenceConfig: Record<MIAStatus, {
  says: string
  feels: string
  color: string
  glow: string
  pulseClass: string
  breathDuration: string
}> = {
  active: {
    says: 'Estoy aquí',
    feels: 'Acompañando tu negocio',
    color: 'var(--mia-blue)',
    glow: 'rgba(30, 90, 153, 0.4)',
    pulseClass: 'animate-pulse-mia',
    breathDuration: '4s',
  },
  learning: {
    says: 'Estoy aprendiendo',
    feels: 'Descubriendo algo nuevo',
    color: 'var(--mia-olive)',
    glow: 'rgba(107, 63, 160, 0.4)',
    pulseClass: 'animate-pulse-learning',
    breathDuration: '3s',
  },
  paused: {
    says: 'Descansando',
    feels: 'Esperando tu regreso',
    color: 'var(--mia-platinum)',
    glow: 'rgba(155, 170, 184, 0.2)',
    pulseClass: 'animate-pulse-paused',
    breathDuration: '6s',
  },
}

export function MIAIndicator({ status = 'active' }: MIAIndicatorProps) {
  const flashRef = useRef<HTMLDivElement>(null)
  const config = presenceConfig[status]

  useEffect(() => {
    const el = flashRef.current
    if (!el) return
    if (status === 'learning') {
      el.style.animation = 'none'
      void el.offsetWidth
      el.style.animation = 'flash-new-learning 2.5s ease-out forwards'
    } else {
      el.style.animation = 'none'
    }
  }, [status])

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-4"
      style={{ userSelect: 'none' }}
    >
      <div className="flex flex-col items-end gap-0.5">
        <span
          className="text-sm font-medium tracking-tight"
          style={{ color: 'var(--atmosphere-text)' }}
        >
          {config.says}
        </span>
        <span
          className="text-[10px] font-normal uppercase tracking-[0.08em]"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.5 }}
        >
          {config.feels}
        </span>
      </div>

      <div className="relative flex h-10 w-10 items-center justify-center">
        <div
          className="absolute h-full w-full rounded-full"
          style={{
            backgroundColor: config.color,
            opacity: 0.06,
            animation: `${config.pulseClass} ${config.breathDuration} ease-in-out infinite`,
          }}
        />
        <div
          className="absolute h-6 w-6 rounded-full"
          style={{
            backgroundColor: config.color,
            opacity: 0.12,
            animation: `${config.pulseClass} ${config.breathDuration} ease-in-out infinite`,
            animationDelay: '0.5s',
          }}
        />
        <div
          className="relative h-3 w-3 rounded-full"
          style={{
            backgroundColor: config.color,
            boxShadow: status === 'learning'
              ? `0 0 16px ${config.glow}, 0 0 32px ${config.glow}`
              : `0 0 10px ${config.glow}`,
            transition: 'box-shadow 0.5s ease',
          }}
        />
        <div
          ref={flashRef}
          className="absolute -inset-3 rounded-full pointer-events-none"
          style={{
            backgroundColor: 'var(--mia-green)',
            opacity: 0.1,
          }}
        />
      </div>
    </div>
  )
}
