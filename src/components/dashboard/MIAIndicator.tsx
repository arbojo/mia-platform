'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, PauseCircle, GraduationCap } from 'lucide-react'
import { useContextMenu, type ContextMenuItems } from '@/components/ui/context-menu'
import { useHoverIntent } from '@/lib/hooks/use-hover-intent'

type MIAStatus = 'active' | 'learning' | 'paused'

const presenceConfig: Record<
  MIAStatus,
  { says: string; feels: string; color: string; glow: string }
> = {
  active: {
    says: 'Estoy aquí',
    feels: 'Acompañando tu negocio',
    color: 'var(--mia-blue)',
    glow: 'rgba(30, 90, 153, 0.5)',
  },
  learning: {
    says: 'Estoy aprendiendo',
    feels: 'Descubriendo algo nuevo',
    color: 'var(--mia-olive)',
    glow: 'rgba(107, 120, 73, 0.5)',
  },
  paused: {
    says: 'Descansando',
    feels: 'Esperando tu regreso',
    color: 'var(--mia-platinum)',
    glow: 'rgba(155, 170, 184, 0.3)',
  },
}

export function MIAIndicator({ status = 'active' }: { status?: MIAStatus }) {
  const router = useRouter()
  const { openMenu } = useContextMenu()
  const { intent, hoverProps } = useHoverIntent(200)
  const [current, setCurrent] = useState<MIAStatus>(status)
  const config = presenceConfig[current]

  const presenceMenu: ContextMenuItems = [
    { label: 'Presencia', heading: true },
    {
      label: 'Activa',
      icon: Activity,
      checked: current === 'active',
      onSelect: () => setCurrent('active'),
    },
    {
      label: 'Aprendiendo',
      icon: GraduationCap,
      checked: current === 'learning',
      onSelect: () => setCurrent('learning'),
    },
    {
      label: 'Descansando',
      icon: PauseCircle,
      checked: current === 'paused',
      onSelect: () => setCurrent('paused'),
    },
    'separator',
    { label: 'Ir a salud', onSelect: () => router.push('/dashboard/health') },
  ]

  return (
    <div className="fixed bottom-5 right-5 z-50" style={{ userSelect: 'none' }}>
      <button
        {...hoverProps}
        type="button"
        onClick={(e) => openMenu(e, presenceMenu)}
        onContextMenu={(e) => openMenu(e, presenceMenu)}
        className="flex items-center gap-2 rounded-full transition-all duration-300"
        style={{
          padding: intent ? '6px 12px 6px 8px' : '6px',
          border: intent ? '1px solid var(--atmosphere-border)' : '1px solid transparent',
          backgroundColor: intent
            ? 'color-mix(in srgb, var(--atmosphere-bg) 84%, transparent)'
            : 'transparent',
          backdropFilter: intent ? 'blur(16px)' : 'none',
          boxShadow: intent ? '0 0 24px var(--module-glow-soft)' : `0 0 12px ${config.glow}`,
        }}
        title={config.says}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.glow}` }}
        />
        {intent && (
          <span className="flex flex-col items-start leading-tight">
            <span className="text-xs font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
              {config.says}
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.08em] opacity-60"
              style={{ color: 'var(--atmosphere-text-secondary)' }}
            >
              {config.feels}
            </span>
          </span>
        )}
      </button>
    </div>
  )
}
