import Link from 'next/link'
import type { ProactiveSuggestion } from '@/lib/dashboard/queries'

export function ProactiveSuggestions({
  suggestions,
}: {
  suggestions: ProactiveSuggestion[]
}) {
  if (suggestions.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h3 className="mb-3 text-sm font-medium text-amber-700 uppercase tracking-wider">
        Suggestions from MIA
      </h3>
      <div className="space-y-3">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm"
          >
            <span className="mt-0.5 text-xl">{s.icon}</span>
            <div className="flex-1">
              <p className="text-sm text-zinc-700">{s.message}</p>
              <Link
                href={s.actionHref}
                className="mt-2 inline-block rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
              >
                {s.actionLabel}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
