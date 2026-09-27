import { Activity, Brain, TrendingUp, Sparkles, MessageSquare, Repeat } from 'lucide-react'
import type { BusinessMemoryItem } from '@/lib/ai/memory'

const MEMORY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  pattern: { label: 'Patrón', color: 'var(--mia-green)' },
  experience: { label: 'Experiencia', color: 'var(--mia-cyan)' },
  insight: { label: 'Insight', color: 'var(--mia-gold)' },
  trend: { label: 'Tendencia', color: 'var(--mia-teal)' },
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  customer_behavior: { label: 'Comportamiento de clientes', emoji: '👥' },
  product_performance: { label: 'Rendimiento de productos', emoji: '📦' },
  sales_pattern: { label: 'Proceso de venta', emoji: '🤝' },
  objection_trend: { label: 'Objeciones frecuentes', emoji: '🧱' },
  faq_frequency: { label: 'Preguntas frecuentes', emoji: '❓' },
  delivery_question: { label: 'Dudas sobre entregas', emoji: '🚚' },
  payment_question: { label: 'Dudas sobre pagos', emoji: '💳' },
  warranty_question: { label: 'Dudas sobre garantías', emoji: '🛡️' },
  pricing_question: { label: 'Dudas sobre precios', emoji: '💰' },
  competition_question: { label: 'Preguntas por competencia', emoji: '⚔️' },
}

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? { label: category.replace('_', ' '), emoji: '📌' }
}

function memoryTypeMeta(memoryType: string) {
  return MEMORY_TYPE_LABELS[memoryType] ?? { label: 'Aprendizaje', color: 'var(--mia-green)' }
}

function confidenceColor(confidence: number) {
  if (confidence >= 70) return 'var(--mia-green)'
  if (confidence >= 40) return 'var(--mia-gold)'
  return 'var(--mia-red)'
}

export function LearningSymptomsCard({ memory }: { memory: BusinessMemoryItem[] }) {
  const symptoms = memory.slice(0, 6)

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        borderRadius: 'var(--mod-radius-lg)',
        border: '1px solid var(--atmosphere-border)',
        backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        boxShadow: '0 0 0 1px var(--module-accent-border), 0 0 24px var(--module-glow-soft)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--mia-teal) 14%, transparent)', color: 'var(--mia-teal)' }}
          >
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
              Síntomas que MIA detecta en tus clientes
            </h2>
            <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
              Patrones aprendidos de las conversaciones, actualizados cada mañana
            </p>
          </div>
        </div>
        {symptoms.length > 0 && (
          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: 'color-mix(in srgb, var(--mia-teal) 12%, transparent)', color: 'var(--mia-teal)' }}
          >
            {symptoms.length} detectados
          </span>
        )}
      </div>

      {symptoms.length > 0 ? (
        <div className="mt-5 space-y-2.5">
          {symptoms.map((item) => {
            const category = categoryLabel(item.category)
            const type = memoryTypeMeta(item.memory_type)
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: 'var(--atmosphere-surface)' }}
              >
                <span className="mt-0.5 text-lg leading-none">{category.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--atmosphere-text)' }}>
                      {category.label}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: `${type.color}1a`, color: type.color }}
                    >
                      {type.label}
                    </span>
                    {item.observation_count > 1 && (
                      <span
                        className="flex items-center gap-1 text-[10px] font-medium"
                        style={{ color: 'var(--atmosphere-text-secondary)' }}
                      >
                        <Repeat className="h-3 w-3" />
                        {item.observation_count} veces
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    {item.content}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="flex items-center gap-1 text-xs font-semibold"
                    style={{ color: confidenceColor(item.confidence) }}
                  >
                    <Brain className="h-3.5 w-3.5" />
                    {item.confidence}%
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    confianza
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-xl px-6 py-6 text-center" style={{ backgroundColor: 'var(--atmosphere-surface)' }}>
          <Sparkles className="mx-auto h-6 w-6" style={{ color: 'var(--mia-teal)' }} />
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--atmosphere-text)' }}>
            Todavía no hay síntomas detectados
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            MIA analiza las conversaciones automáticamente cada mañana y mostrará aquí los patrones que encuentre.
          </p>
        </div>
      )}

      {symptoms.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Si un síntoma se repite, agregalo a la memoria o como regla del negocio.</span>
          <TrendingUp className="ml-auto h-3.5 w-3.5" style={{ color: 'var(--mia-green)' }} />
        </div>
      )}
    </div>
  )
}