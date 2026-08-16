import type { CSSProperties, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

interface MiaSpinnerProps {
  className?: string
  title?: string
  label?: ReactNode
  style?: CSSProperties
}

export function MiaSpinner({ className, title = 'Cargando…', label, style }: MiaSpinnerProps) {
  const icon = (
    <Sparkles
      aria-label={title}
      role="status"
      className={cn('animate-spin', className)}
      style={{
        color: 'var(--module-accent)',
        filter: 'drop-shadow(0 0 6px var(--module-glow-soft))',
        ...style,
      }}
    />
  )

  if (!label) return icon

  return (
    <span className="inline-flex flex-col items-center gap-2">
      {icon}
      <span className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        {label}
      </span>
    </span>
  )
}
