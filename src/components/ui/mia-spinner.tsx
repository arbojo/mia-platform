import type { CSSProperties } from 'react'
import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

interface MiaSpinnerProps {
  className?: string
  title?: string
  style?: CSSProperties
}

export function MiaSpinner({ className, title = 'Cargando…', style }: MiaSpinnerProps) {
  return (
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
}
