import type { Milestone } from '@/lib/dashboard/queries'

export function CelebrateProgress({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null

  return (
    <div className="space-y-3">
      {milestones.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <span className="text-2xl">{m.icon}</span>
          <p className="text-sm font-medium text-emerald-800">{m.message}</p>
        </div>
      ))}
    </div>
  )
}
