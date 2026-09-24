'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, PauseCircle, GraduationCap, Loader2 } from 'lucide-react'
import { useContextMenu, type ContextMenuItems } from '@/components/ui/context-menu'
import { useHoverIntent } from '@/lib/hooks/use-hover-intent'
import type { PresenceState } from '@/lib/assistants/presence'
import { presenceToAssistantUpdate } from '@/lib/assistants/presence'

const presenceConfig: Record<
  PresenceState,
  { says: string; feels: string; color: string; glow: string }
> = {
  active: {
    says: 'Estoy aquí',
    feels: 'Acompañando tu negocio',
    color: 'var(--mia-blue)',
    glow: 'rgba(91, 155, 213, 0.5)',
  },
  learning: {
    says: 'Estoy aprendiendo',
    feels: 'Descubriendo algo nuevo',
    color: 'var(--mia-teal)',
    glow: 'rgba(13, 148, 136, 0.5)',
  },
  paused: {
    says: 'Descansando',
    feels: 'Esperando tu regreso',
    color: 'var(--mia-platinum)',
    glow: 'rgba(155, 170, 184, 0.3)',
  },
}

export function MIAIndicator({
  assistantId = null,
  initialPresence = 'active',
}: {
  assistantId?: string | null
  initialPresence?: PresenceState
}) {
  const router = useRouter()
  const { openMenu } = useContextMenu()
  const { intent, hoverProps } = useHoverIntent(200)
  const [current, setCurrent] = useState<PresenceState>(initialPresence)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const config = presenceConfig[current]

  async function applyPresence(next: PresenceState) {
    if (!assistantId) {
      setError('Primero crea tu asistente en el Concilio')
      return
    }
    if (next === current) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/assistants/${assistantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presenceToAssistantUpdate(next)),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al cambiar el estado de MIA')
      }
      setCurrent(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar el estado de MIA')
    } finally {
      setSaving(false)
    }
  }

  const presenceMenu: ContextMenuItems = [
    { label: 'Presencia', heading: true },
    {
      label: 'Activa',
      icon: Activity,
      checked: current === 'active',
      disabled: saving,
      onSelect: () => applyPresence('active'),
    },
    {
      label: 'Aprendiendo',
      icon: GraduationCap,
      checked: current === 'learning',
      disabled: saving,
      onSelect: () => applyPresence('learning'),
    },
    {
      label: 'Descansando',
      icon: PauseCircle,
      checked: current === 'paused',
      disabled: saving,
      onSelect: () => applyPresence('paused'),
    },
    'separator',
    { label: 'Ir a salud', onSelect: () => router.push('/dashboard/health') },
  ]

  return (
    <div className="fixed bottom-5 right-5 z-50" style={{ userSelect: 'none' }}>
      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="mb-2 block max-w-[220px] rounded-lg border px-3 py-2 text-left text-xs"
          style={{
            borderColor: 'var(--atmosphere-border)',
            backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
            color: 'var(--atmosphere-text)',
          }}
          title="Cerrar aviso"
        >
          {error}
        </button>
      )}
      <button
        {...hoverProps}
        type="button"
        data-tour="mia-indicator"
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
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--atmosphere-text-secondary)' }} />}
        {intent && !saving && (
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