interface WeeklyReport {
  id: string
  week_start: string
  week_end: string
  conversations_attended: number
  new_facts_learned: number
  missing_rules_found: number
  products_reviewed: number
  preparation_before: number
  preparation_after: number
  narrative: string | null
  recommendations: Array<{
    type: 'improvement' | 'suggestion' | 'celebration'
    content: string
    priority: 'high' | 'medium' | 'low'
  }>
}

interface WeeklyReportCardProps {
  report: WeeklyReport | null
  onGenerate?: () => void
  loading?: boolean
}

function getRecommendationIcon(type: WeeklyReport['recommendations'][0]['type']) {
  switch (type) {
    case 'celebration': return '🎉'
    case 'improvement': return '🔧'
    case 'suggestion': return '💡'
  }
}

function getRecommendationColor(type: WeeklyReport['recommendations'][0]['type']) {
  switch (type) {
    case 'celebration': return 'border-emerald-200 bg-emerald-50'
    case 'improvement': return 'border-amber-200 bg-amber-50'
    case 'suggestion': return 'border-blue-200 bg-blue-50'
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

export function WeeklyReportCard({ report, onGenerate, loading }: WeeklyReportCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          <p className="text-sm text-zinc-500">Generando mi reporte semanal...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-white p-6 text-center">
        <p className="text-lg text-zinc-600">Aún no tengo un reporte semanal.</p>
        <p className="mt-1 text-sm text-zinc-400">
          Los reportes se generan automáticamente cada lunes.
        </p>
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Generar mi primer reporte
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Mi reporte semanal</h3>
        <span className="text-xs text-zinc-400">
          {formatDate(report.week_start)} — {formatDate(report.week_end)}
        </span>
      </div>

      {report.narrative && (
        <div className="mt-4 rounded-xl bg-violet-50 p-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-violet-900">
            {report.narrative}
          </p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-zinc-900">{report.conversations_attended}</p>
          <p className="text-xs text-zinc-500">conversaciones</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">{report.new_facts_learned}</p>
          <p className="text-xs text-zinc-500">cosas nuevas</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{report.products_reviewed}</p>
          <p className="text-xs text-zinc-500">productos</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="text-lg font-bold text-zinc-700">{report.preparation_before}%</span>
            <span className="text-xs text-zinc-400">→</span>
            <span className="text-lg font-bold text-emerald-600">{report.preparation_after}%</span>
          </div>
          <p className="text-xs text-zinc-500">preparación</p>
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-medium text-zinc-700">Recomendaciones</h4>
          <div className="mt-3 space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className={`rounded-lg border p-3 ${getRecommendationColor(rec.type)}`}>
                <div className="flex items-start gap-2">
                  <span className="text-sm">{getRecommendationIcon(rec.type)}</span>
                  <p className="text-sm text-zinc-700">{rec.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
