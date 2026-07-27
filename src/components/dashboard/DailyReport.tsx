import type { DailyReport as DailyReportType } from '@/lib/dashboard/queries'

export function DailyReport({ report }: { report: DailyReportType }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900">Resumen del día</h3>
        <p className="text-sm text-zinc-500">{report.greeting}</p>
      </div>

      <ul className="space-y-3">
        {report.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 text-lg text-emerald-500">{item.icon}</span>
            <span className="text-sm text-zinc-700">{item.text}</span>
          </li>
        ))}
      </ul>

      {report.items.length > 0 && report.items[0].icon === '✓' && (
        <p className="mt-4 text-sm text-zinc-500">
          Creo que estamos listos para otro gran día.
        </p>
      )}
    </div>
  )
}
