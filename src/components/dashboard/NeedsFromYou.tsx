import Link from 'next/link'
import type { NeedsFromYou as NeedsFromYouType } from '@/lib/dashboard/queries'

function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-red-50 text-red-700',
    medium: 'bg-amber-50 text-amber-700',
    low: 'bg-zinc-100 text-zinc-600',
  }
  const labels = { high: 'Urgente', medium: 'Importante', low: 'Opcional' }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[priority]}`}>
      {labels[priority]}
    </span>
  )
}

export function NeedsFromYou({ data }: { data: NeedsFromYouType }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Lo que necesito de ti</h3>
        {data.totalPending > 0 && (
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
            {data.totalPending} pendientes
          </span>
        )}
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-xl bg-emerald-50 p-4 text-center">
          <p className="text-sm text-emerald-700">
            Todo listo! No tengo nada pendiente por ahora.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-700">{item.description}</p>
                <PriorityBadge priority={item.priority} />
              </div>
              <Link
                href="/dashboard/knowledge"
                className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
              >
                Ensenarme
              </Link>
            </div>
          ))}
        </div>
      )}

      {data.items.length > 0 && (
        <div className="mt-4 flex gap-2">
          <Link
            href="/dashboard/knowledge"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Revisar todo
          </Link>
          <Link
            href="/dashboard/knowledge-studio"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Ejecutar Studio
          </Link>
        </div>
      )}
    </div>
  )
}
