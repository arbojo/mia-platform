import { createAdminClient } from '@/lib/supabase/admin'
import { getOpenAIClient, MODEL } from '@/lib/ai/client'

export interface BusinessMemoryItem {
  id: string
  business_id: string
  memory_type: 'pattern' | 'experience' | 'insight' | 'trend'
  category: string
  content: string
  evidence: Record<string, unknown>
  confidence: number
  first_observed_at: string
  last_observed_at: string
  observation_count: number
}

export interface SkillLevel {
  id: string
  business_id: string
  skill_key: string
  skill_name: string
  level: number
  status: 'mastered' | 'learning' | 'needs_practice' | 'not_started'
  evidence_count: number
  last_demonstrated_at: string | null
}

export interface LearningVelocitySnapshot {
  id: string
  business_id: string
  period: 'daily' | 'weekly' | 'monthly'
  period_start: string
  period_end: string
  new_facts: number
  new_products: number
  new_rules: number
  new_faqs: number
  preparation_delta: number
  confidence_delta: number
  conversations_analyzed: number
  opportunities_found: number
}

const SKILL_DEFINITIONS = [
  { key: 'product_knowledge', name: 'Conocimiento de productos' },
  { key: 'sales_conversations', name: 'Conversaciones de venta' },
  { key: 'business_rules', name: 'Reglas del negocio' },
  { key: 'objection_handling', name: 'Manejo de objeciones' },
  { key: 'upselling', name: 'Venta adicional' },
  { key: 'cross_selling', name: 'Venta cruzada' },
  { key: 'guarantees', name: 'Garantías' },
  { key: 'returns', name: 'Devoluciones' },
  { key: 'payment_methods', name: 'Métodos de pago' },
  { key: 'delivery_logistics', name: 'Logística de entrega' },
]

function getStatus(level: number): SkillLevel['status'] {
  if (level >= 90) return 'mastered'
  if (level >= 60) return 'learning'
  if (level >= 30) return 'needs_practice'
  return 'not_started'
}

export async function getBusinessMemory(businessId: string): Promise<BusinessMemoryItem[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('business_memory')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('observation_count', { ascending: false })
    .order('confidence', { ascending: false })

  if (error) throw error
  return (data ?? []) as BusinessMemoryItem[]
}

export async function getSkillLevels(businessId: string): Promise<SkillLevel[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('mia_skills')
    .select('*')
    .eq('business_id', businessId)
    .order('level', { ascending: false })

  if (error) throw error
  return (data ?? []) as SkillLevel[]
}

export async function getLatestVelocitySnapshot(businessId: string): Promise<LearningVelocitySnapshot | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('learning_velocity_snapshots')
    .select('*')
    .eq('business_id', businessId)
    .eq('period', 'weekly')
    .order('period_start', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as LearningVelocitySnapshot | null
}

export async function getVelocityHistory(businessId: string, limit = 12): Promise<LearningVelocitySnapshot[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('learning_velocity_snapshots')
    .select('*')
    .eq('business_id', businessId)
    .eq('period', 'weekly')
    .order('period_start', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as LearningVelocitySnapshot[]
}

export async function analyzeConversationPatterns(businessId: string) {
  const supabase = createAdminClient()

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, content, role, metadata, conversations!inner(id, business_id, type)')
    .eq('conversations.business_id', businessId)
    .eq('conversations.type', 'live')
    .eq('role', 'user')
    .gte('created_at', oneWeekAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error
  if (!messages || messages.length === 0) return []

  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Eres MIA, una asistente de ventas IA analizando conversaciones recientes con clientes.

Analiza las conversaciones y detecta patrones. Responde SOLO con un JSON válido.

Categorías de patrones:
- customer_behavior: Comportamiento recurrente de clientes
- product_performance: Productos que generan más interés o dudas
- sales_pattern: Patrones en el proceso de venta
- objection_trend: Objeciones frecuentes
- faq_frequency: Preguntas que se repiten
- delivery_question: Preguntas sobre entregas
- payment_question: Preguntas sobre pagos
- warranty_question: Preguntas sobre garantías
- pricing_question: Preguntas sobre precios
- competition_question: Preguntas sobre competencia

Para cada patrón detectado, responde con:
{
  "patterns": [
    {
      "memory_type": "pattern|experience|insight|trend",
      "category": "una de las categorías anteriores",
      "content": "Descripción del patrón en español",
      "evidence": { "count": número de ocurrencias, "examples": ["ejemplo1", "ejemplo2"] },
      "confidence": 0-100
    }
  ]
}

REGLAS:
- Solo detecta patrones que aparezcan 2+ veces
- Si no hay patrones claros, devuelve patterns: []
- Nunca inventes información
- La confianza refleja cuán seguro estás del patrón`
      },
      {
        role: 'user',
        content: `Analiza estas ${messages.length} mensajes de clientes de la última semana:

${messages.slice(0, 100).map((m, i) => `[${i + 1}] ${m.content}`).join('\n')}`
      }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  })

  const content = completion.choices[0]?.message?.content ?? '{"patterns":[]}'
  const parsed = JSON.parse(content) as {
    patterns: Array<{
      memory_type: string
      category: string
      content: string
      evidence: Record<string, unknown>
      confidence: number
    }>
  }

  return parsed.patterns
}

export async function upsertBusinessMemory(
  businessId: string,
  patterns: Array<{
    memory_type: string
    category: string
    content: string
    evidence: Record<string, unknown>
    confidence: number
  }>
) {
  const supabase = createAdminClient()
  const inserted: BusinessMemoryItem[] = []

  for (const pattern of patterns) {
    const { data: existing } = await supabase
      .from('business_memory')
      .select('id, observation_count')
      .eq('business_id', businessId)
      .eq('category', pattern.category)
      .eq('content', pattern.content)
      .eq('is_active', true)
      .single()

    if (existing) {
      const { data: updated } = await supabase
        .from('business_memory')
        .update({
          observation_count: existing.observation_count + 1,
          last_observed_at: new Date().toISOString(),
          confidence: Math.min(100, pattern.confidence + 5),
          evidence: pattern.evidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updated) inserted.push(updated as BusinessMemoryItem)
    } else {
      const { data: created } = await supabase
        .from('business_memory')
        .insert({
          business_id: businessId,
          memory_type: pattern.memory_type,
          category: pattern.category,
          content: pattern.content,
          evidence: pattern.evidence,
          confidence: pattern.confidence,
        })
        .select()
        .single()

      if (created) inserted.push(created as BusinessMemoryItem)
    }
  }

  return inserted
}

export async function calculateSkillLevels(businessId: string): Promise<SkillLevel[]> {
  const supabase = createAdminClient()

  const [productsResult, knowledgeResult, rulesResult, correctionsResult, conversationsResult, memoriesResult] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, name, description, benefits, faq')
        .eq('business_id', businessId)
        .eq('is_active', true),
      supabase
        .from('knowledge_items')
        .select('id, category, content')
        .eq('business_id', businessId)
        .eq('is_active', true),
      supabase
        .from('sales_rules')
        .select('id, category, content')
        .eq('business_id', businessId)
        .eq('is_active', true),
      supabase
        .from('learning_events')
        .select('id, correction_type, status')
        .eq('business_id', businessId)
        .in('status', ['approved', 'modified']),
      supabase
        .from('conversations')
        .select('id')
        .eq('business_id', businessId)
        .eq('type', 'live'),
      supabase
        .from('business_memory')
        .select('id, category')
        .eq('business_id', businessId)
        .eq('is_active', true),
    ])

  const products = productsResult.data ?? []
  const knowledge = knowledgeResult.data ?? []
  const rules = rulesResult.data ?? []
  const corrections = correctionsResult.data ?? []
  const conversations = conversationsResult.data ?? []
  const memories = memoriesResult.data ?? []

  const skillScores: Record<string, { level: number; evidence: number }> = {}

  for (const def of SKILL_DEFINITIONS) {
    skillScores[def.key] = { level: 0, evidence: 0 }
  }

  if (products.length > 0) {
    const withDesc = products.filter((p) => p.description)
    const withBenefits = products.filter((p) => p.benefits)
    const withFaq = products.filter((p) => p.faq && Array.isArray(p.faq) && p.faq.length > 0)

    const productScore =
      (withDesc.length / products.length) * 30 +
      (withBenefits.length / products.length) * 30 +
      (withFaq.length / products.length) * 40

    skillScores.product_knowledge.level = Math.round(productScore)
    skillScores.product_knowledge.evidence = products.length
  }

  skillScores.business_rules.level = Math.min(100, rules.length * 15)
  skillScores.business_rules.evidence = rules.length

  const knowledgeCategories = new Set(knowledge.map((k) => k.category))
  if (knowledgeCategories.has('faq')) {
    skillScores.objection_handling.level = Math.min(80, knowledge.filter((k) => k.category === 'faq').length * 10)
    skillScores.objection_handling.evidence = knowledge.filter((k) => k.category === 'faq').length
  }

  if (conversations.length > 0) {
    skillScores.sales_conversations.level = Math.min(100, conversations.length * 8)
    skillScores.sales_conversations.evidence = conversations.length
  }

  const ruleCategories = new Set(rules.map((r) => r.category))
  if (ruleCategories.has('payment')) {
    skillScores.payment_methods.level = 70
    skillScores.payment_methods.evidence = rules.filter((r) => r.category === 'payment').length
  }
  if (ruleCategories.has('zones')) {
    skillScores.delivery_logistics.level = 70
    skillScores.delivery_logistics.evidence = rules.filter((r) => r.category === 'zones').length
  }

  const warrantyMemory = memories.filter((m) => m.category === 'warranty_question')
  const returnMemory = memories.filter((m) => m.category === 'objection_trend')

  if (warrantyMemory.length > 0) {
    skillScores.guarantees.level = Math.min(80, warrantyMemory.length * 20)
    skillScores.guarantees.evidence = warrantyMemory.length
  }
  if (returnMemory.length > 0) {
    skillScores.returns.level = Math.min(60, returnMemory.length * 15)
    skillScores.returns.evidence = returnMemory.length
  }

  const upsellRules = rules.filter((r) => r.content.toLowerCase().includes('_venta adicional') || r.content.toLowerCase().includes('upselling'))
  const crossRules = rules.filter((r) => r.content.toLowerCase().includes('venta cruzada') || r.content.toLowerCase().includes('cross-selling'))

  skillScores.upselling.level = Math.min(70, upsellRules.length * 35 + (corrections.length > 5 ? 20 : 0))
  skillScores.upselling.evidence = upsellRules.length
  skillScores.cross_selling.level = Math.min(60, crossRules.length * 30 + (corrections.length > 5 ? 15 : 0))
  skillScores.cross_selling.evidence = crossRules.length

  const supabase2 = createAdminClient()
  const upserts: SkillLevel[] = []

  for (const def of SKILL_DEFINITIONS) {
    const score = skillScores[def.key]
    const status = getStatus(score.level)

    const { data, error } = await supabase2
      .from('mia_skills')
      .upsert(
        {
          business_id: businessId,
          skill_key: def.key,
          skill_name: def.name,
          level: score.level,
          status,
          evidence_count: score.evidence,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id,skill_key' }
      )
      .select()
      .single()

    if (!error && data) upserts.push(data as SkillLevel)
  }

  return upserts
}

export async function calculateLearningVelocity(
  businessId: string
): Promise<Omit<LearningVelocitySnapshot, 'id' | 'business_id'>> {
  const supabase = createAdminClient()

  const weekEnd = new Date()
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)

  const monthStart = new Date()
  monthStart.setMonth(monthStart.getMonth() - 1)

  const [factsResult, productsResult, rulesResult, knowledgeResult, conversationsResult] =
    await Promise.all([
      supabase
        .from('learning_events')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .in('status', ['approved', 'modified'])
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('sales_rules')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('knowledge_items')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)
        .eq('category', 'faq')
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('type', 'live')
        .gte('created_at', weekStart.toISOString()),
    ])

  const memoriesResult = await supabase
    .from('business_memory')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)
    .gte('created_at', weekStart.toISOString())

  const snapshot = {
    period: 'weekly' as const,
    period_start: weekStart.toISOString().split('T')[0],
    period_end: weekEnd.toISOString().split('T')[0],
    new_facts: factsResult.count ?? 0,
    new_products: productsResult.count ?? 0,
    new_rules: rulesResult.count ?? 0,
    new_faqs: knowledgeResult.count ?? 0,
    preparation_delta: 0,
    confidence_delta: 0,
    conversations_analyzed: conversationsResult.count ?? 0,
    opportunities_found: memoriesResult.count ?? 0,
  }

  const { data: existingSnapshot } = await supabase
    .from('learning_velocity_snapshots')
    .select('id')
    .eq('business_id', businessId)
    .eq('period', 'weekly')
    .eq('period_start', snapshot.period_start)
    .single()

  if (existingSnapshot) {
    await supabase
      .from('learning_velocity_snapshots')
      .update(snapshot)
      .eq('id', existingSnapshot.id)
  } else {
    await supabase
      .from('learning_velocity_snapshots')
      .insert({ business_id: businessId, ...snapshot })
  }

  return snapshot
}
