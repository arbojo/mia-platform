import { createAdminClient } from '@/lib/supabase/admin'

export interface CoachingRecommendation {
  id: string
  business_id: string
  observation: string
  suggested_improvement: string
  recommended_practice: string
  behavior_key: string
  lifecycle_state: string
  evidence_count: number
  created_at: string
}

const BEHAVIOR_MAP: Record<string, { behavior: string; improvement: string; practice: string }> = {
  objection_trend: {
    behavior: 'objection_recovery',
    improvement: 'Podrías reconocer la objeción y presentar el valor antes de discutir el precio.',
    practice: 'Responde a un cliente que dice "es muy caro". Primero reconoce su preocupación, luego explica el valor.',
  },
  pricing_question: {
    behavior: 'price_presentation',
    improvement: 'Podrías presentar los beneficios del producto antes de mencionar el precio.',
    practice: 'Practica explicar 3 beneficios de un producto antes de decir cuánto cuesta.',
  },
  sales_pattern: {
    behavior: 'value_framing',
    improvement: 'Podrías enmarcar cada conversación alrededor del valor que el cliente recibirá.',
    practice: 'Describe una solución completa empezando por el problema del cliente, no por tu producto.',
  },
  product_performance: {
    behavior: 'product_knowledge',
    improvement: 'Podrías profundizar en las características específicas que más interesan a los clientes.',
    practice: 'Explica un producto destacando primero los beneficios que mencionaste en la conversación.',
  },
  warranty_question: {
    behavior: 'trust_building',
    improvement: 'Podrías mencionar la garantía como un generador de confianza, no solo como un dato.',
    practice: 'Responde a la pregunta "¿tiene garantía?" generando confianza, no solo dando un sí o no.',
  },
  competition_question: {
    behavior: 'objection_recovery',
    improvement: 'Podrías enfocarte en tus diferenciadores en lugar de comparar directamente.',
    practice: 'Un cliente pregunta por la competencia. Resalta tus ventajas únicas sin menospreciar al otro.',
  },
  delivery_question: {
    behavior: 'follow_up_timing',
    improvement: 'Podrías anticipar las preguntas de entrega antes de que el cliente las formule.',
    practice: 'Menciona los tiempos de entrega como parte natural de la presentación del producto.',
  },
  payment_question: {
    behavior: 'price_presentation',
    improvement: 'Podrías presentar opciones de pago como facilitadores, no como obstáculos.',
    practice: 'Un cliente pregunta por formas de pago. Preséntalas como soluciones, no como trámites.',
  },
  faq_frequency: {
    behavior: 'closing_strategy',
    improvement: 'Podrías responder las preguntas frecuentes de forma proactiva antes de que el cliente pregunte.',
    practice: 'Identifica la pregunta frecuente del cliente y respóndela antes de que la formule.',
  },
  customer_behavior: {
    behavior: 'buying_signal_detection',
    improvement: 'Podrías identificar las señales de compra y actuar en el momento adecuado.',
    practice: 'Reconoce 3 señales de que un cliente está listo para comprar y responde adecuadamente.',
  },
}

const BEHAVIOR_LABELS: Record<string, string> = {
  objection_recovery: 'Manejo de objeciones',
  price_presentation: 'Presentación de precio',
  value_framing: 'Enmarcado de valor',
  product_knowledge: 'Conocimiento de producto',
  trust_building: 'Generación de confianza',
  follow_up_timing: 'Tiempo de seguimiento',
  closing_strategy: 'Estrategia de cierre',
  buying_signal_detection: 'Detección de señales de compra',
}

export function computeQueueScore(params: {
  evidence_count: number
  days_since_creation: number
  severity: string
}): number {
  const impactScore = Math.min(params.evidence_count * 10, 100)
  const freshnessScore = Math.max(0, 100 - params.days_since_creation * 5)
  const severityMap: Record<string, number> = { low: 0, medium: 25, high: 50, critical: 75 }
  const severityScore = severityMap[params.severity] ?? 0
  return Math.round(impactScore * 0.4 + freshnessScore * 0.3 + severityScore * 0.3)
}

export async function generateRecommendations(businessId: string): Promise<number> {
  const supabase = createAdminClient()
  let generated = 0

  const { data: memories } = await supabase
    .from('business_memory')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .gte('observation_count', 3)
    .order('observation_count', { ascending: false })

  if (!memories || memories.length === 0) return 0

  const { data: existingActive } = await supabase
    .from('knowledge_suggestions')
    .select('behavior_key')
    .eq('business_id', businessId)
    .in('suggestion_type', ['coaching', 'safety'])
    .in('lifecycle_state', ['active', 'accepted', 'practiced', 'applied'])

  const activeBehaviors = new Set((existingActive ?? []).map((s) => s.behavior_key))

  for (const memory of memories) {
    const config = BEHAVIOR_MAP[memory.category]
    if (!config || activeBehaviors.has(config.behavior)) continue

    const observation = memory.content
    const severity = memory.confidence >= 80 ? 'high' : memory.confidence >= 50 ? 'medium' : 'low'

    const queueScore = computeQueueScore({
      evidence_count: memory.observation_count,
      days_since_creation: Math.floor(
        (Date.now() - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
      severity,
    })

    const title = `${BEHAVIOR_LABELS[config.behavior] ?? config.behavior}: ${observation.slice(0, 60)}`

    const { error } = await supabase.from('knowledge_suggestions').insert({
      business_id: businessId,
      report_id: null,
      type: 'improvement',
      severity: severity as 'low' | 'medium' | 'high' | 'critical',
      title,
      description: `${observation}\n\n${config.improvement}`,
      suggestion_type: 'coaching',
      lifecycle_state: queueScore > 50 ? 'active' : 'draft',
      observation,
      suggested_improvement: config.improvement,
      recommended_practice: config.practice,
      behavior_key: config.behavior,
      status: 'pending',
    })

    if (!error) generated++
  }

  if (generated > 0) {
    const { data: activeRecs } = await supabase
      .from('knowledge_suggestions')
      .select('id, queue_score')
      .eq('business_id', businessId)
      .eq('suggestion_type', 'coaching')
      .eq('lifecycle_state', 'active')
      .order('created_at', { ascending: true })

    if (activeRecs && activeRecs.length > 1) {
      const [, ...expire] = activeRecs
      await supabase
        .from('knowledge_suggestions')
        .update({ lifecycle_state: 'draft' })
        .in('id', expire.map((r) => r.id))
    }
  }

  return generated
}

export async function getActiveRecommendation(businessId: string): Promise<CoachingRecommendation | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('knowledge_suggestions')
    .select('*')
    .eq('business_id', businessId)
    .in('suggestion_type', ['coaching', 'safety'])
    .eq('lifecycle_state', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    business_id: data.business_id,
    observation: data.observation ?? data.description ?? '',
    suggested_improvement: data.suggested_improvement ?? data.description ?? '',
    recommended_practice: data.recommended_practice ?? '',
    behavior_key: data.behavior_key ?? '',
    lifecycle_state: data.lifecycle_state,
    evidence_count: 0,
    created_at: data.created_at,
  }
}

export async function acceptRecommendation(
  businessId: string,
  recommendationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { data: rec } = await supabase
    .from('knowledge_suggestions')
    .select('id, lifecycle_state')
    .eq('id', recommendationId)
    .eq('business_id', businessId)
    .single()

  if (!rec) return { success: false, error: 'Recomendación no encontrada' }
  if (rec.lifecycle_state !== 'active') return { success: false, error: 'La recomendación no está activa' }

  const { error } = await supabase
    .from('knowledge_suggestions')
    .update({ lifecycle_state: 'accepted' })
    .eq('id', recommendationId)

  if (error) return { success: false, error: error.message }

  const { data: nextInQueue } = await supabase
    .from('knowledge_suggestions')
    .select('id')
    .eq('business_id', businessId)
    .in('suggestion_type', ['coaching', 'safety'])
    .eq('lifecycle_state', 'draft')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextInQueue) {
    await supabase
      .from('knowledge_suggestions')
      .update({ lifecycle_state: 'active' })
      .eq('id', nextInQueue.id)
  }

  return { success: true }
}

export async function rejectRecommendation(
  businessId: string,
  recommendationId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { data: rec } = await supabase
    .from('knowledge_suggestions')
    .select('id, lifecycle_state')
    .eq('id', recommendationId)
    .eq('business_id', businessId)
    .single()

  if (!rec) return { success: false, error: 'Recomendación no encontrada' }

  const { error } = await supabase
    .from('knowledge_suggestions')
    .update({
      lifecycle_state: 'archived',
      rejection_reason: reason ?? null,
    })
    .eq('id', recommendationId)

  if (error) return { success: false, error: error.message }

  const { data: nextInQueue } = await supabase
    .from('knowledge_suggestions')
    .select('id')
    .eq('business_id', businessId)
    .in('suggestion_type', ['coaching', 'safety'])
    .eq('lifecycle_state', 'draft')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextInQueue) {
    await supabase
      .from('knowledge_suggestions')
      .update({ lifecycle_state: 'active' })
      .eq('id', nextInQueue.id)
  }

  return { success: true }
}
