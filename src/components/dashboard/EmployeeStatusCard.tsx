import type { EmployeeStatus } from '@/lib/dashboard/queries'

interface SkillSummary {
  skill_key: string
  skill_name: string
  level?: number
  current_level?: number
  status: 'mastered' | 'learning' | 'needs_practice' | 'not_started'
}

interface EmployeeStatusCardProps {
  status: EmployeeStatus
  skills?: SkillSummary[]
}

function StatusDot({ status }: { status: EmployeeStatus['status'] }) {
  const colors = {
    online: 'bg-emerald-500',
    idle: 'bg-amber-400',
    offline: 'bg-zinc-300',
  }
  const labels = {
    online: 'Trabajando',
    idle: 'Esperando clientes',
    offline: 'Desconectada',
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  )
}

function ChannelBadge({ channel }: { channel: string }) {
  const icons: Record<string, string> = {
    web: '🌐',
    whatsapp: '📱',
    instagram: '📸',
    facebook: '💬',
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
      {icons[channel] ?? '🔗'} {channel}
    </span>
  )
}

function ConfidenceMessage({ value }: { value: number }) {
  let message: string
  let color: string

  if (value >= 80) {
    message = "Estoy lista para responder la mayoría de preguntas de clientes."
    color = 'text-emerald-600'
  } else if (value >= 50) {
    message = 'Necesito aprender un poco más antes de poder responder todo.'
    color = 'text-amber-600'
  } else {
    message = "Estoy empezando. Enséñame más sobre tu negocio."
    color = 'text-zinc-500'
  }

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-zinc-500">Qué preparada me siento</span>
        <span className={`text-sm font-medium ${color}`}>{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className={`mt-1.5 text-xs ${color}`}>{message}</p>
    </div>
  )
}

export function EmployeeStatusCard({ status, skills }: EmployeeStatusCardProps) {
  const topSkills = skills
    ?.filter((s) => s.status === 'mastered' || s.status === 'learning')
    .sort((a, b) => (b.level ?? b.current_level ?? 0) - (a.level ?? a.current_level ?? 0))
    .slice(0, 3) ?? []

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white">
            M
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{status.name}</h2>
            <StatusDot status={status.status} />
          </div>
        </div>
        <div className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
          {status.readyToSell ? 'Lista para vender' : 'Preparándome...'}
        </div>
      </div>

      <div className="mb-4">
        <ConfidenceMessage value={status.knowledgeReadiness} />
      </div>

      {topSkills.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Mis mejores habilidades
          </p>
          <div className="flex flex-wrap gap-2">
            {topSkills.map((skill) => (
              <span
                key={skill.skill_key}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              >
                {skill.status === 'mastered' ? '🟢' : '🔵'} {skill.skill_name} {skill.level ?? skill.current_level ?? 0}%
              </span>
            ))}
          </div>
        </div>
      )}

      {status.channels.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Donde trabajo
          </p>
          <div className="flex flex-wrap gap-2">
            {status.channels.map((channel) => (
              <ChannelBadge key={channel} channel={channel} />
            ))}
          </div>
        </div>
      )}

      {status.lastActivity && (
        <p className="text-xs text-zinc-400">
          Última vez que hablé con un cliente:{' '}
          {new Date(status.lastActivity).toLocaleString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
          })}
        </p>
      )}
    </div>
  )
}
