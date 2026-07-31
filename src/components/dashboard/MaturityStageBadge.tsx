import type { MaturityResult } from '@/lib/ai/maturity'

const STAGE_CONFIG: Record<string, { label: string; description: string; color: string; icon: string }> = {
  observation: {
    label: 'Observando',
    description: 'Estoy aprendiendo en silencio. Escucho y observo antes de opinar.',
    color: 'bg-zinc-50 border-zinc-200 text-zinc-600',
    icon: '👀',
  },
  understanding: {
    label: 'Entendiendo',
    description: 'Empiezo a reconocer patrones y puedo compartir lo que observo.',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    icon: '💡',
  },
  mentor: {
    label: 'Aprendiz',
    description: 'Puedo ayudarte a descubrir lo que sabe tu negocio a través de simulaciones.',
    color: 'bg-violet-50 border-violet-200 text-violet-700',
    icon: '🧠',
  },
  advisor: {
    label: 'Asesora',
    description: 'Puedo sugerir mejoras y recomendar acciones para tu negocio.',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    icon: '✨',
  },
  autonomous: {
    label: 'Autónoma',
    description: 'Etapa futura — requiere arquitectura de seguridad adicional.',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    icon: '🔮',
  },
}

export function MaturityStageBadge({ maturity }: { maturity: MaturityResult }) {
  const stage = STAGE_CONFIG[maturity.stage] ?? STAGE_CONFIG.observation
  const nextStage = maturity.thresholds.nextStage
  const nextConfig = nextStage ? STAGE_CONFIG[nextStage] : null

  return (
    <div className={`rounded-2xl border p-5 ${stage.color}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{stage.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider">{stage.label}</span>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium">
              {maturity.readiness.overall}% preparación
            </span>
          </div>
          <p className="mt-1 text-sm">{stage.description}</p>

          {nextConfig && maturity.thresholds.requirements.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium opacity-70">
                Para llegar a {nextConfig.label}:
              </p>
              <ul className="mt-1 space-y-0.5">
                {maturity.thresholds.requirements.map((req, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs opacity-60">
                    <span className="h-1 w-1 rounded-full bg-current" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
