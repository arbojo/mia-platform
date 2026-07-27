'use client'

import Link from 'next/link'
import type { MIAReadiness as MIAReadinessType } from '@/lib/dashboard/queries'
import type { ReadinessIndicatorDetail, SubcategoryScore } from '@/lib/ai/readiness'

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-xs font-medium text-emerald-600">▲ +{delta}%</span>
  if (delta < 0) return <span className="text-xs font-medium text-red-500">▼ {delta}%</span>
  return <span className="text-xs text-zinc-400">—</span>
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color =
    score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#a1a1aa'

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f4f4f5"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-lg font-bold"
        fill="#18181b"
      >
        {score}%
      </text>
    </svg>
  )
}

function ProgressBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-zinc-300'

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

function SubcategoryRow({ sub }: { sub: SubcategoryScore }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex-1">
        <p className="text-sm text-zinc-700">{sub.label}</p>
        <p className="text-xs text-zinc-400">{sub.description}</p>
      </div>
      <div className="ml-3 text-right">
        <span className="text-sm font-medium text-zinc-900">{sub.score}%</span>
      </div>
    </div>
  )
}

function IndicatorSection({
  label,
  detail,
  delta,
  defaultSubcategories,
}: {
  label: string
  detail: ReadinessIndicatorDetail
  delta: number | null
  defaultSubcategories: SubcategoryScore[]
}) {
  const displaySubcategories =
    detail.subcategories.length > 0 ? detail.subcategories : defaultSubcategories

  return (
    <div className="py-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-900">{label}</h4>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-zinc-900">{detail.score}%</span>
          {delta !== null && <DeltaBadge delta={delta} />}
        </div>
      </div>
      <ProgressBar score={detail.score} />
      <p className="mt-2 text-sm text-zinc-500 italic">{detail.message}</p>
      {detail.guidance && (
        <Link
          href={detail.guidance.actionHref}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          {detail.guidance.actionLabel} →
        </Link>
      )}
      {displaySubcategories.length > 0 && (
        <div className="mt-2 divide-y divide-zinc-50">
          {displaySubcategories.map((sub, i) => (
            <SubcategoryRow key={`${label}-${i}`} sub={sub} />
          ))}
        </div>
      )}
    </div>
  )
}

function TrendSparkline({
  trend,
}: {
  trend: Array<{ date: string; preparation: number; confidence: number; performance: number | null }>
}) {
  if (trend.length < 2) {
    return (
      <p className="text-xs text-zinc-400 italic">
        Guardaré tu progreso para mostrarte cómo evoluciono.
      </p>
    )
  }

  const width = 200
  const height = 40
  const padding = 4

  const toPath = (values: number[]) => {
    if (values.length < 2) return ''
    const maxVal = Math.max(...values, 1)
    const minVal = Math.min(...values, 0)
    const range = maxVal - minVal || 1
    const stepX = (width - padding * 2) / (values.length - 1)

    return values
      .map((v, i) => {
        const x = padding + i * stepX
        const y = height - padding - ((v - minVal) / range) * (height - padding * 2)
        return `${i === 0 ? 'M' : 'L'}${x},${y}`
      })
      .join(' ')
  }

  const prepValues = trend.map((t) => t.preparation)
  const confValues = trend.map((t) => t.confidence)

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} className="shrink-0">
        <path d={toPath(prepValues)} fill="none" stroke="#10b981" strokeWidth={1.5} opacity={0.8} />
        <path d={toPath(confValues)} fill="none" stroke="#8b5cf6" strokeWidth={1.5} opacity={0.8} />
      </svg>
      <div className="flex flex-col gap-1 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Preparación
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
          Confianza
        </span>
      </div>
    </div>
  )
}

function Celebration({ delta }: { delta: number }) {
  if (delta < 5) return null

  return (
    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      ¡Hoy me siento mucho más preparada que ayer!
    </div>
  )
}

const DEFAULT_PREPARATION_SUBS: SubcategoryScore[] = [
  { label: 'Identidad del negocio', score: 0, weight: 0.15, description: 'Todavía no conozco tu negocio' },
  { label: 'Productos', score: 0, weight: 0.20, description: 'Necesito aprender qué vendes' },
  { label: 'Reglas del negocio', score: 0, weight: 0.15, description: 'Necesito aprender cómo funciona tu negocio' },
  { label: 'Conocimiento', score: 0, weight: 0.15, description: 'Necesito aprender más sobre tu negocio' },
  { label: 'Personalidad', score: 0, weight: 0.10, description: 'Todavía no sé cómo quieres que hable' },
  { label: 'Práctica de ventas', score: 0, weight: 0.15, description: 'Todavía no he practicado' },
  { label: 'Canales conectados', score: 0, weight: 0.10, description: 'Todavía no tengo canales' },
  { label: 'Actividad reciente', score: 0, weight: 0.10, description: 'Sin actividad reciente' },
]

const DEFAULT_CONFIDENCE_SUBS: SubcategoryScore[] = [
  { label: 'Amplitud del conocimiento', score: 0, weight: 0.25, description: 'Mi conocimiento es limitado' },
  { label: 'Calidad del entrenamiento', score: 0, weight: 0.25, description: 'Sin entrenamiento reciente' },
  { label: 'Velocidad de aprendizaje', score: 0, weight: 0.20, description: 'Necesito practicar más' },
  { label: 'Desempeño en simulaciones', score: 0, weight: 0.20, description: 'Sin simulaciones todavía' },
  { label: 'Experiencia con clientes', score: 0, weight: 0.10, description: 'Sin experiencia con clientes' },
]

export function MIAReadiness({ data }: { data: MIAReadinessType }) {
  const overallMessage =
    data.overall >= 90
      ? 'Estoy lista para representar tu negocio.'
      : data.overall >= 70
        ? 'Estoy bien preparada. Casi lista.'
        : data.overall >= 50
          ? 'Voy aprendiendo poco a poco.'
          : data.overall >= 30
            ? 'Estoy empezando a conocerte.'
            : 'Todavía no conozco mucho. Empecemos.'

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-4">
        <ScoreRing score={data.overall} />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900">Índice de Preparación</h3>
          <p className="mt-1 text-sm text-zinc-500 italic">{overallMessage}</p>
        </div>
      </div>

      <ProgressBar score={data.overall} />

      <Celebration delta={data.deltas.overall} />

      <div className="divide-y divide-zinc-100">
        <IndicatorSection
          label="Preparación"
          detail={data.preparationDetail}
          delta={data.deltas.preparation}
          defaultSubcategories={DEFAULT_PREPARATION_SUBS}
        />
        <IndicatorSection
          label="Confianza"
          detail={data.confidenceDetail}
          delta={data.deltas.confidence}
          defaultSubcategories={DEFAULT_CONFIDENCE_SUBS}
        />
        {data.performanceDetail ? (
          <IndicatorSection
            label="Desempeño"
            detail={data.performanceDetail}
            delta={data.deltas.performance}
            defaultSubcategories={[]}
          />
        ) : (
          <div className="py-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-900">Desempeño</h4>
              <span className="text-sm text-zinc-400">—</span>
            </div>
            <p className="text-sm text-zinc-500 italic">
              Aún no tengo clientes reales. Este indicador aparecerá cuando empiece a atender.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <TrendSparkline trend={data.trend} />
      </div>
    </div>
  )
}
