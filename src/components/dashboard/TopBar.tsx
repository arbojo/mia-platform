'use client'

import { useState } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { SignalIndicator } from '@/components/signals/SignalIndicator'
import { MIAInbox } from '@/components/signals/MIAInbox'

export function TopBar() {
  const [inboxOpen, setInboxOpen] = useState(false)

  return (
    <div
      className="relative flex items-center justify-end gap-2 px-6 py-3"
      style={{
        borderBottom: '1px solid var(--atmosphere-border)',
        backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 60%, transparent)',
      }}
    >
      <div className="relative">
        <SignalIndicator
          state="observacion"
          onClick={() => setInboxOpen(!inboxOpen)}
        />
        <MIAInbox open={inboxOpen} onClose={() => setInboxOpen(false)} />
      </div>
      <ThemeToggle />
    </div>
  )
}
