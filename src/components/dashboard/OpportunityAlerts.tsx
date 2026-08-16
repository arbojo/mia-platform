interface MemoryItem {
  id: string
  memory_type: string
  category: string
  content: string
  confidence: number
  observation_count: number
}

interface OpportunityAlertsProps {
  memories: MemoryItem[]
}

function getCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    customer_behavior: 'Comportamiento de clientes',
    product_performance: 'Rendimiento de productos',
    sales_pattern: 'Patrones de venta',
    objection_trend: 'Tendencia de objeciones',
    faq_frequency: 'Preguntas frecuentes',
    delivery_question: 'Preguntas de entrega',
    payment_question: 'Preguntas de pago',
    warranty_question: 'Preguntas de garantía',
    pricing_question: 'Preguntas de precio',
    competition_question: 'Preguntas de competencia',
  }
  return labels[category] || category
}

function getCategoryIcon(category: string) {
  if (category.includes('delivery')) return '📦'
  if (category.includes('payment')) return '💳'
  if (category.includes('warranty')) return '🛡️'
  if (category.includes('pricing')) return '💰'
  if (category.includes('competition')) return '⚔️'
  if (category.includes('faq')) return '❓'
  if (category.includes('objection')) return '🚧'
  if (category.includes('sales')) return '📈'
  if (category.includes('product')) return '📦'
  return '🔍'
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 80) return 'text-emerald-600'
  if (confidence >= 60) return 'text-amber-600'
  return 'text-zinc-500'
}

export function OpportunityAlerts({ memories }: OpportunityAlertsProps) {
  const grouped = memories.reduce(
    (acc, memory) => {
      if (!acc[memory.category]) acc[memory.category] = []
      acc[memory.category].push(memory)
      return acc
    },
    {} as Record<string, MemoryItem[]>
  )

  const sortedCategories = Object.entries(grouped).sort(
    (a, b) => b[1].reduce((sum, m) => sum + m.observation_count, 0) -
             a[1].reduce((sum, m) => sum + m.observation_count, 0)
  )

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6">
      <h3 className="text-lg font-semibold text-zinc-900">Lo que noté esta semana</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Patrones que detecté en las conversaciones con clientes
      </p>

      {sortedCategories.length > 0 ? (
        <div className="mt-5 space-y-4">
          {sortedCategories.map(([category, items]) => (
            <div key={category} className="rounded-xl bg-zinc-50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getCategoryIcon(category)}</span>
                <h4 className="text-sm font-medium text-zinc-800">{getCategoryLabel(category)}</h4>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">
                  {items.reduce((sum, m) => sum + m.observation_count, 0)} veces
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {items.map((memory) => (
                  <div key={memory.id} className="flex items-start gap-2">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-400" />
                    <div className="flex-1">
                      <p className="text-sm text-zinc-700">{memory.content}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-xs font-medium ${getConfidenceColor(memory.confidence)}`}>
                          {memory.confidence}% confianza
                        </span>
                        <span className="text-xs text-zinc-400">
                          observado {memory.observation_count} {memory.observation_count === 1 ? 'vez' : 'veces'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-500">Aún no he detectado patrones esta semana.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Cuando tenga más conversaciones, podré notar tendencias.
          </p>
        </div>
      )}
    </div>
  )
}
