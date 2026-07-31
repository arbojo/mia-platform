'use client'

import { Button } from '@/components/ui/button'

export function OpenWidgetButton({
  children,
  className,
  variant = 'default',
}: {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
}) {
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => window.dispatchEvent(new Event('mia:open-widget'))}
    >
      {children}
    </Button>
  )
}
