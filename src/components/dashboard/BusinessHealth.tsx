import type { BusinessHealth as HealthType } from '@/lib/dashboard/queries'

function ScoreRing({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  const circumference = 2 * Math.PI * 32
  const offset = circumference - (pct / 100) * circumference

  const color =
    pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <svg className="h-16 w-16" viewBox="0 0 72 72">
      <circle
        cx="36"
        cy="36"
        r="32"
        fill="none"
        stroke="#f4f4f5"
        strokeWidth="5"
      />
      <circle
        cx="36"
        cy="36"
        r="32"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
      />
      <text
        x="36"
        y="36"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-zinc-900 text-sm font-semibold"
      >
        {score}
      </text>
    </svg>
  )
}

function ScoreItem({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  const statusColor =
    pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-600">{label}</span>
      <span className={`text-sm font-medium ${statusColor}`}>
        {score}/{maxScore}
      </span>
    </div>
  )
}

export function BusinessHealth({ data }: { data: HealthType }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900">Salud del negocio</h3>

      <div className="mb-4 flex items-center gap-4">
        <ScoreRing score={data.overall} maxScore={10} />
        <div>
          <p className="text-2xl font-bold text-zinc-900">{data.overall}/10</p>
          <p className="text-sm text-zinc-500">Puntaje general</p>
        </div>
      </div>

      <div className="space-y-2">
        {data.scores.map((s) => (
          <ScoreItem key={s.label} label={s.label} score={s.score} maxScore={s.maxScore} />
        ))}
      </div>

      {data.scores.length === 0 && (
        <p className="mt-2 text-sm text-zinc-400">
          Ejecuta Knowledge Studio para obtener un analisis completo.
        </p>
      )}
    </div>
  )
}
