import Link from 'next/link'
import type { ConversationTimeline as TimelineType } from '@/lib/dashboard/queries'

function OutcomeBadge({ outcome }: { outcome: 'interested' | 'answered' | 'sold' | 'pending' }) {
  const config = {
    interested: { color: 'bg-blue-50 text-blue-700', label: 'Interesado' },
    answered: { color: 'bg-emerald-50 text-emerald-700', label: 'Respondido' },
    sold: { color: 'bg-violet-50 text-violet-700', label: 'Vendido' },
    pending: { color: 'bg-zinc-100 text-zinc-600', label: 'Pendiente' },
  }

  const { color, label } = config[outcome]

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
  )
}

export function ConversationTimeline({ data }: { data: TimelineType }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Conversaciones recientes</h3>
        <Link
          href="/dashboard/knowledge"
          className="text-xs font-medium text-violet-600 hover:text-violet-700"
        >
          Ver todas
        </Link>
      </div>

      {data.entries.length === 0 ? (
        <div className="rounded-xl bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-500">
            Aun no he tenido conversaciones. Pronto empezare a atender clientes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-xl border border-zinc-100 p-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-600">
                {entry.customerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900">
                    {entry.customerName}
                  </span>
                  <span className="text-xs text-zinc-400">{entry.time}</span>
                </div>
                <p className="mt-0.5 truncate text-sm text-zinc-500">{entry.lastMessage}</p>
              </div>
              <OutcomeBadge outcome={entry.outcome} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
