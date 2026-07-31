import { createAdminClient } from '@/lib/supabase/admin'

interface SafetyEventRow {
  id: string
  business_id: string
  original_response: string
  triggers: Array<{ type: string; text: string }>
  trigger_types: string[]
  outcome: 'passed' | 'blocked_with_retry' | 'pending_ai' | 'error'
  created_at: string
}

interface SafetyInsight {
  businessId: string
  type: 'price_pattern' | 'delivery_pattern' | 'guarantee_pattern' | 'error_rate'
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  observation: string
  evidence_count: number
}

const MAX_BATCH_SIZE = 1000

export async function runSafetyLearning(businessId?: string): Promise<number> {
  const supabase = createAdminClient()
  let totalSuggestions = 0

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('safety_events')
    .select('*')
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false })
    .limit(MAX_BATCH_SIZE)

  if (businessId) {
    query = query.eq('business_id', businessId)
  }

  const { data: events, error } = await query

  if (error) {
    console.error('Failed to fetch safety events:', error)
    return 0
  }

  if (!events || events.length === 0) {
    if (businessId) {
      await createPositiveSignal(supabase, businessId)
      return 0
    }
    return 0
  }

  const byBusiness = groupByBusiness(events as SafetyEventRow[])

  for (const [bizId, bizEvents] of Object.entries(byBusiness)) {
    const insights = analyzePatterns(bizId, bizEvents)
    for (const insight of insights) {
      const created = await persistInsight(supabase, insight)
      if (created) totalSuggestions++
    }
  }

  return totalSuggestions
}

function groupByBusiness(events: SafetyEventRow[]): Record<string, SafetyEventRow[]> {
  const groups: Record<string, SafetyEventRow[]> = {}
  for (const e of events) {
    if (!groups[e.business_id]) groups[e.business_id] = []
    groups[e.business_id].push(e)
  }
  return groups
}

function analyzePatterns(businessId: string, events: SafetyEventRow[]): SafetyInsight[] {
  const insights: SafetyInsight[] = []
  const blocked = events.filter((e) => e.outcome === 'blocked_with_retry')
  const errors = events.filter((e) => e.outcome === 'error')

  const priceEvents = blocked.filter((e) => e.trigger_types.includes('price'))
  const deliveryEvents = blocked.filter((e) => e.trigger_types.includes('delivery'))
  const guaranteeEvents = blocked.filter((e) => e.trigger_types.includes('guarantee'))

  if (priceEvents.length >= 3) {
    insights.push({
      businessId,
      type: 'price_pattern',
      severity: priceEvents.length >= 6 ? 'high' : 'medium',
      title: 'Varios clientes preguntaron por precios esta semana',
      description: `Noté que varios clientes preguntaron sobre precios y tuve que verificar la información. Revisar los precios de tus productos me ayudará a responder con más confianza.`,
      observation: `Esta semana varios clientes preguntaron por precios. Revisar los precios registrados ayudará a que pueda responder más rápido.`,
      evidence_count: priceEvents.length,
    })
  }

  if (deliveryEvents.length >= 3) {
    insights.push({
      businessId,
      type: 'delivery_pattern',
      severity: deliveryEvents.length >= 6 ? 'high' : 'medium',
      title: 'Clientes preguntan frecuentemente por tiempos de entrega',
      description: `Varias veces esta semana los clientes preguntaron sobre tiempos de entrega. Tener reglas de envío más claras me ayudará a dar mejores respuestas.`,
      observation: `${deliveryEvents.length} consultas sobre entrega esta semana. Revisar las reglas de envío del negocio ayudará a agilizar las respuestas.`,
      evidence_count: deliveryEvents.length,
    })
  }

  if (guaranteeEvents.length >= 2) {
    insights.push({
      businessId,
      type: 'guarantee_pattern',
      severity: guaranteeEvents.length >= 4 ? 'high' : 'low',
      title: 'Clientes preguntan sobre garantías y devoluciones',
      description: `Esta semana noté que varios clientes preguntaron sobre políticas de garantía. Mantener actualizada esta información me ayudará a responder con precisión.`,
      observation: `${guaranteeEvents.length} consultas sobre garantías esta semana. Revisar la política de devoluciones ayudará a que pueda responder sin dudas.`,
      evidence_count: guaranteeEvents.length,
    })
  }

  if (errors.length >= 2 && errors.length > events.length * 0.1) {
    insights.push({
      businessId,
      type: 'error_rate',
      severity: 'medium',
      title: 'Necesito conocer mejor tu negocio',
      description: `Esta semana encontré ${errors.length} situaciones donde no tenía suficiente información para responder. Conocer más sobre tu negocio me ayudará a atender mejor a tus clientes.`,
      observation: `${errors.length} veces esta semana no pude verificar información del negocio. Agregar más detalles sobre productos y reglas me ayudará a mejorar.`,
      evidence_count: errors.length,
    })
  }

  return insights
}

async function createPositiveSignal(supabase: ReturnType<typeof createAdminClient>, businessId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('knowledge_suggestions')
    .select('id')
    .eq('business_id', businessId)
    .eq('suggestion_type', 'safety')
    .eq('behavior_key', 'safety_positive_week')
    .in('lifecycle_state', ['draft', 'active'])
    .maybeSingle()

  if (existing) return

  await supabase.from('knowledge_suggestions').insert({
    business_id: businessId,
    report_id: null,
    type: 'improvement',
    severity: 'low',
    title: 'Esta semana todo fluyó bien 😊',
    description: `Esta semana no necesité verificar información del negocio. Eso significa que tengo clara la información de tus productos y reglas. ¡Sigamos así!`,
    suggestion_type: 'safety',
    lifecycle_state: 'active',
    observation: 'Sin eventos de seguridad esta semana. El conocimiento del negocio está actualizado.',
    suggested_improvement: 'Seguir manteniendo la información actualizada para seguir dando un buen servicio.',
    behavior_key: 'safety_positive_week',
    status: 'pending',
  })
}

async function persistInsight(
  supabase: ReturnType<typeof createAdminClient>,
  insight: SafetyInsight
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('knowledge_suggestions')
    .select('id')
    .eq('business_id', insight.businessId)
    .eq('suggestion_type', 'safety')
    .eq('behavior_key', `safety_${insight.type}`)
    .in('lifecycle_state', ['draft', 'active'])
    .maybeSingle()

  if (existing) return false

  const { data: activeCoaching } = await supabase
    .from('knowledge_suggestions')
    .select('id')
    .eq('business_id', insight.businessId)
    .eq('suggestion_type', 'coaching')
    .eq('lifecycle_state', 'active')
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('knowledge_suggestions').insert({
    business_id: insight.businessId,
    report_id: null,
    type: 'improvement',
    severity: insight.severity,
    title: insight.title,
    description: insight.description,
    suggestion_type: 'safety',
    lifecycle_state: activeCoaching ? 'draft' : 'active',
    observation: insight.observation,
    suggested_improvement: insight.description,
    behavior_key: `safety_${insight.type}`,
    status: 'pending',
  })

  return !error
}
