import { TrendingUp, BookOpen, Scale, Brain } from 'lucide-react'

interface LearningEvent {
  id: string
  correction_type: string
  created_at: string
  status: string
}

interface VelocityData {
  new_facts: number
  new_products: number
  new_rules: number
  new_faqs: number
  period_start: string
  period_end: string
}

interface LearningTimelineProps {
  recentLessons: LearningEvent[]
  velocity: VelocityData | null
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora mismo'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`
  return `Hace ${Math.floor(diffDays / 7)} sem`
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'knowledge': return <BookOpen className="h-4 w-4" />
    case 'rule': return <Scale className="h-4 w-4" />
    case 'instruction': return <Brain className="h-4 w-4" />
    default: return <BookOpen className="h-4 w-4" />
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'knowledge': return 'Conocimiento'
    case 'rule': return 'Regla'
    case 'instruction': return 'Instrucción'
    default: return 'Aprendizaje'
  }
}

export function LearningTimeline({ recentLessons, velocity }: LearningTimelineProps) {
  const totalLearned = velocity
    ? velocity.new_facts + velocity.new_products + velocity.new_rules + velocity.new_faqs
    : recentLessons.length

  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Lo que aprendí</h3>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
          {totalLearned} cosas nuevas
        </span>
      </div>

      {velocity && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <p className="text-lg font-bold text-blue-700">{velocity.new_facts}</p>
            <p className="text-xs text-blue-600">Hechos</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center">
            <p className="text-lg font-bold text-emerald-700">{velocity.new_products}</p>
            <p className="text-xs text-emerald-600">Productos</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-center">
            <p className="text-lg font-bold text-amber-700">{velocity.new_rules}</p>
            <p className="text-xs text-amber-600">Reglas</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-3 text-center">
            <p className="text-lg font-bold text-purple-700">{velocity.new_faqs}</p>
            <p className="text-xs text-purple-600">FAQs</p>
          </div>
        </div>
      )}

      {recentLessons.length > 0 ? (
        <div className="mt-5 space-y-3">
          {recentLessons.slice(0, 8).map((lesson) => (
            <div key={lesson.id} className="flex items-center gap-3 rounded-lg bg-zinc-50 px-4 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                {getTypeIcon(lesson.correction_type)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-800">{getTypeLabel(lesson.correction_type)}</p>
                <p className="text-xs text-zinc-500">{getRelativeTime(lesson.created_at)}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-500">Aún no he aprendido nada esta semana.</p>
          <p className="mt-1 text-xs text-zinc-400">Enseñame con archivos o corrígeme en entrenamiento.</p>
        </div>
      )}
    </div>
  )
}
