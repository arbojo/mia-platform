import Link from 'next/link'
import type { EmployeeReadiness as ReadinessType } from '@/lib/dashboard/queries'

function CategoryRow({ category }: { category: ReadinessType['categories'][0] }) {
  const statusIcon = {
    learned: '✅',
    learning: '🟡',
    pending: '⚪',
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-lg">{statusIcon[category.status]}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-zinc-900">{category.label}</p>
        <p className="text-xs text-zinc-500">{category.description}</p>
      </div>
    </div>
  )
}

export function EmployeeReadiness({ data }: { data: ReadinessType }) {
  const progressColor =
    data.overall >= 80
      ? 'bg-emerald-500'
      : data.overall >= 50
        ? 'bg-amber-500'
        : 'bg-zinc-300'

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">MIA Readiness</h3>
        <span className="text-2xl font-bold text-zinc-900">{data.overall}%</span>
      </div>

      <div className="mb-4">
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-all ${progressColor}`}
            style={{ width: `${data.overall}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-zinc-100">
        {data.categories.map((cat) => (
          <CategoryRow key={cat.id} category={cat} />
        ))}
      </div>

      <p className="mt-4 text-sm text-zinc-500 italic">{data.message}</p>

      {data.nextStep && (
        <Link
          href={data.nextStep.href}
          className="mt-4 block w-full rounded-xl bg-violet-600 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-violet-700"
        >
          {data.nextStep.label}
        </Link>
      )}
    </div>
  )
}
