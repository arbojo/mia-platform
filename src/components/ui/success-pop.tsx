'use client'

import { Check } from 'lucide-react'

interface SuccessPopProps {
  message: string
  submessage?: string
}

export function SuccessPop({ message, submessage }: SuccessPopProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-elastic-pop absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-popover p-6 text-center"
    >
      <span className="grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
        <Check className="size-8" aria-hidden="true" />
      </span>
      <p className="font-heading text-base font-medium text-foreground">{message}</p>
      {submessage && <p className="text-sm text-muted-foreground">{submessage}</p>}
    </div>
  )
}
