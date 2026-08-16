'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink } from 'lucide-react'
import { useContextMenu, type ContextMenuItems } from '@/components/ui/context-menu'
import type { ConversationTimeline as TimelineType } from '@/lib/dashboard/queries'

function OutcomeBadge({ outcome }: { outcome: 'interested' | 'answered' | 'sold' | 'pending' }) {
  const config = {
    interested: { color: 'var(--mia-blue)', label: 'Interesado' },
    answered: { color: 'var(--mia-green)', label: 'Respondido' },
    sold: { color: 'var(--mia-teal)', label: 'Vendido' },
    pending: { color: 'var(--mia-platinum)', label: 'Pendiente' },
  }

  const { color, label } = config[outcome]

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{
        backgroundColor: `${color}15`,
        color,
      }}
    >
      {label}
    </span>
  )
}

export function ConversationTimeline({ data }: { data: TimelineType }) {
  const router = useRouter()
  const { openMenu } = useContextMenu()

  function openEntryMenu(e: React.MouseEvent, id: string) {
    const items: ContextMenuItems = [
      { label: 'Conversación', heading: true },
      {
        label: 'Abrir conversación',
        icon: ExternalLink,
        onSelect: () => router.push(`/dashboard/conversations?id=${id}`),
      },
      {
        label: 'Ver todas',
        icon: ArrowUpRight,
        onSelect: () => router.push('/dashboard/conversations'),
      },
    ]
    openMenu(e, items)
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h3
          className="text-sm font-semibold tracking-tight"
          style={{ color: 'var(--atmosphere-text)' }}
        >
          Conversaciones recientes
        </h3>
        <Link
          href="/dashboard/conversations"
          className="text-xs font-medium transition-colors duration-200"
          style={{ color: 'var(--atmosphere-accent)' }}
        >
          Ver todas
        </Link>
      </div>

      {data.entries.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: 'var(--atmosphere-surface)' }}
        >
          <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            Aún no he tenido conversaciones. Pronto empezaré a atender clientes.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.entries.map((entry) => (
            <div
              key={entry.id}
              onContextMenu={(e) => openEntryMenu(e, entry.id)}
              className="cursor-context-menu"
            >
              <Link
                href={`/dashboard/conversations?id=${entry.id}`}
                className="block"
              >
                <div
                  className="flex items-start gap-3 rounded-xl border p-3 transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--atmosphere-surface)',
                    borderColor: 'var(--atmosphere-border)',
                  }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--atmosphere-text) 12%, transparent)',
                      color: 'var(--atmosphere-text-secondary)',
                    }}
                  >
                    {entry.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--atmosphere-text)' }}
                      >
                        {entry.customerName}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
                      >
                        {entry.time}
                      </span>
                    </div>
                    <p
                      className="mt-0.5 truncate text-sm"
                      style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.8 }}
                    >
                      {entry.lastMessage}
                    </p>
                  </div>
                  <OutcomeBadge outcome={entry.outcome} />
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
