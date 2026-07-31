'use client'

import { cn } from '@/lib/utils'

interface TranscriptMessage {
  id: string
  role: string
  content: string
  created_at: string
}

interface TranscriptViewProps {
  messages: TranscriptMessage[]
}

const roleConfig: Record<string, { align: 'left' | 'right'; label: string; bgVar: string; textVar: string }> = {
  user: {
    align: 'right',
    label: 'Cliente',
    bgVar: 'var(--atmosphere-accent)',
    textVar: 'white',
  },
  assistant: {
    align: 'left',
    label: 'MIA',
    bgVar: 'var(--elevation-2)',
    textVar: 'var(--atmosphere-text)',
  },
  correction: {
    align: 'left',
    label: 'Corrección',
    bgVar: 'rgba(201, 168, 76, 0.15)',
    textVar: 'var(--mia-gold)',
  },
  system: {
    align: 'left',
    label: 'Sistema',
    bgVar: 'var(--elevation-1)',
    textVar: 'var(--atmosphere-text-secondary)',
  },
  simulated_customer: {
    align: 'right',
    label: 'Cliente (sim)',
    bgVar: 'var(--mia-violet)',
    textVar: 'white',
  },
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function TranscriptView({ messages }: TranscriptViewProps) {
  const filtered = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant' || m.role === 'correction'
  )

  return (
    <div className="space-y-3">
      {filtered.map((msg, i) => {
        const config = roleConfig[msg.role] ?? roleConfig.assistant
        const showLabel =
          i === 0 || filtered[i - 1].role !== msg.role

        return (
          <div
            key={msg.id}
            className={cn(
              'flex',
              config.align === 'right' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className="max-w-[80%] rounded-2xl px-4 py-2.5"
              style={{
                backgroundColor: config.bgVar,
                color: config.textVar,
              }}
            >
              {showLabel && (
                <div
                  className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ opacity: 0.7 }}
                >
                  {config.label}
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </p>
              <div
                className="mt-1 text-right text-[10px]"
                style={{ opacity: 0.5 }}
              >
                {formatTime(msg.created_at)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
