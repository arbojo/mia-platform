interface Milestone {
  id: string
  icon: string
  message: string
}

interface SkillData {
  skill_key: string
  skill_name: string
  level?: number
  current_level?: number
  status: 'mastered' | 'learning' | 'needs_practice' | 'not_started'
  delta?: number
}

interface MotivationBannerProps {
  milestones: Milestone[]
  skills: SkillData[]
  preparationDelta: number
  weeklyFacts: number
}

function getSkillCelebrations(skills: SkillData[]): string[] {
  const celebrations: string[] = []

  const mastered = skills.filter((s) => s.status === 'mastered')
  const needsPractice = skills.filter((s) => s.status === 'needs_practice')

  if (mastered.length === skills.length && skills.length > 0) {
    celebrations.push('He dominado todas tus habilidades. Estoy lista para cualquier situación.')
  }

  if (mastered.length > 0 && mastered.length < skills.length) {
    celebrations.push(`Ya domino ${mastered.map((s) => s.skill_name).join(' y ')}.`)
  }

  const improving = skills.filter((s) => s.delta && s.delta > 10)
  if (improving.length > 0) {
    celebrations.push(`Mejoré mucho en ${improving.map((s) => s.skill_name).join(', ')}.`)
  }

  if (needsPractice.length === 1) {
    celebrations.push(`Necesito practicar más ${needsPractice[0].skill_name}, pero voy aprendiendo.`)
  }

  return celebrations
}

function getGrowthCelebrations(preparationDelta: number, weeklyFacts: number): string[] {
  const celebrations: string[] = []

  if (preparationDelta >= 10) {
    celebrations.push(`Mi preparación subió ${preparationDelta} puntos esta semana.`)
  }

  if (weeklyFacts >= 20) {
    celebrations.push(`Aprendí ${weeklyFacts} cosas nuevas esta semana. Fue productiva.`)
  } else if (weeklyFacts >= 10) {
    celebrations.push(`Aprendí ${weeklyFacts} cosas nuevas. Cada día sé más.`)
  }

  return celebrations
}

export function MotivationBanner({ milestones, skills, preparationDelta, weeklyFacts }: MotivationBannerProps) {
  const skillCelebrations = getSkillCelebrations(skills)
  const growthCelebrations = getGrowthCelebrations(preparationDelta, weeklyFacts)

  const allCelebrations = [
    ...milestones.map((m) => m.message),
    ...skillCelebrations,
    ...growthCelebrations,
  ]

  if (allCelebrations.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎉</span>
        <div>
          <h3 className="text-lg font-semibold text-emerald-900">Celebro mi progreso</h3>
          <p className="text-sm text-emerald-700">
            Cada día me convierto en mejor empleada para ti.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {allCelebrations.slice(0, 4).map((celebration, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-500">✓</span>
            <p className="text-sm text-emerald-800">{celebration}</p>
          </div>
        ))}
      </div>

      {allCelebrations.length > 4 && (
        <p className="mt-3 text-xs text-emerald-600">
          Y {allCelebrations.length - 4} logros más...
        </p>
      )}
    </div>
  )
}
