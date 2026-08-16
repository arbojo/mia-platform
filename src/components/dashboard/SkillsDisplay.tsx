interface SkillData {
  skill_key: string
  skill_name: string
  level?: number
  current_level?: number
  status: 'mastered' | 'learning' | 'needs_practice' | 'not_started'
  evidence_count: number
  growth_trend?: 'up' | 'down' | 'stable' | 'new'
  delta?: number
}

interface SkillsDisplayProps {
  skills: SkillData[]
  overallLevel: number
  growthSummary: string
}

function getStatusColor(status: SkillData['status']) {
  switch (status) {
    case 'mastered': return 'bg-emerald-500'
    case 'learning': return 'bg-blue-500'
    case 'needs_practice': return 'bg-amber-500'
    case 'not_started': return 'bg-zinc-200'
  }
}

function getStatusBg(status: SkillData['status']) {
  switch (status) {
    case 'mastered': return 'bg-emerald-50'
    case 'learning': return 'bg-blue-50'
    case 'needs_practice': return 'bg-amber-50'
    case 'not_started': return 'bg-zinc-50'
  }
}

function getStatusLabel(status: SkillData['status']) {
  switch (status) {
    case 'mastered': return 'Dominada'
    case 'learning': return 'Aprendiendo'
    case 'needs_practice': return 'Necesita práctica'
    case 'not_started': return 'Por comenzar'
  }
}

function getTrendIcon(trend?: SkillData['growth_trend'], delta?: number) {
  if (!trend || trend === 'stable') return null
  if (trend === 'up') return <span className="text-xs font-medium text-emerald-600">+{delta}</span>
  if (trend === 'down') return <span className="text-xs font-medium text-red-500">{delta}</span>
  if (trend === 'new') return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">Nueva</span>
  return null
}

export function SkillsDisplay({ skills, overallLevel, growthSummary }: SkillsDisplayProps) {
  const mastered = skills.filter((s) => s.status === 'mastered').length
  const learning = skills.filter((s) => s.status === 'learning').length
  const needsPractice = skills.filter((s) => s.status === 'needs_practice').length
  const notStarted = skills.filter((s) => s.status === 'not_started').length

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Mis habilidades</h3>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-zinc-700">{overallLevel}%</span>
        </div>
      </div>

      <p className="mt-2 text-sm text-zinc-600 italic">{growthSummary}</p>

      <div className="mt-4 flex gap-4 text-xs text-zinc-500">
        <span>{mastered} dominadas</span>
        <span>{learning} aprendiendo</span>
        <span>{needsPractice} práctica</span>
        <span>{notStarted} por comenzar</span>
      </div>

      <div className="mt-5 space-y-3">
        {skills
          .sort((a, b) => (b.level ?? b.current_level ?? 0) - (a.level ?? a.current_level ?? 0))
          .map((skill) => {
            const skillLevel = skill.level ?? skill.current_level ?? 0
            return (
            <div key={skill.skill_key} className={`rounded-lg px-4 py-3 ${getStatusBg(skill.status)}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-800">{skill.skill_name}</span>
                <div className="flex items-center gap-2">
                  {getTrendIcon(skill.growth_trend, skill.delta)}
                  <span className="text-sm font-bold text-zinc-700">{skillLevel}%</span>
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getStatusColor(skill.status)}`}
                  style={{ width: `${skillLevel}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-zinc-500">{getStatusLabel(skill.status)}</span>
                <span className="text-xs text-zinc-400">{skill.evidence_count} evidencias</span>
              </div>
            </div>
            )
          })}
      </div>
    </div>
  )
}
