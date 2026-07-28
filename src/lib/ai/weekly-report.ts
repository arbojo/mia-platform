import { createAdminClient } from '@/lib/supabase/admin'
import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import { getSkillsSnapshot } from '@/lib/ai/skills'
import { getProductIntelligence } from '@/lib/ai/product-intelligence'

export interface WeeklyReportData {
  id: string
  business_id: string
  week_start: string
  week_end: string
  conversations_attended: number
  new_facts_learned: number
  missing_rules_found: number
  products_reviewed: number
  preparation_before: number
  preparation_after: number
  narrative: string | null
  recommendations: Array<{
    type: 'improvement' | 'suggestion' | 'celebration'
    content: string
    priority: 'high' | 'medium' | 'low'
  }>
  status: 'draft' | 'published'
  created_at: string
}

export interface GenerateReportResult {
  report: WeeklyReportData
  generated: boolean
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getWeekDates(): { weekStart: Date; weekEnd: Date } {
  const now = new Date()
  const weekEnd = new Date(now)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  return { weekStart, weekEnd }
}

export async function generateWeeklyReport(businessId: string): Promise<GenerateReportResult> {
  const supabase = createAdminClient()
  const { weekStart, weekEnd } = getWeekDates()

  const { data: existingReport } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('business_id', businessId)
    .eq('week_start', weekStart.toISOString().split('T')[0])
    .single()

  if (existingReport) {
    const { data: report } = await supabase
      .from('weekly_reports')
      .select('*')
      .eq('id', existingReport.id)
      .single()

    return { report: report as WeeklyReportData, generated: false }
  }

  const [conversationsResult, learningResult, productsResult, memoryResult, skillsSnapshot, productIntel] =
    await Promise.all([
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('type', 'live')
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('learning_events')
        .select('id, correction_type', { count: 'exact' })
        .eq('business_id', businessId)
        .in('status', ['approved', 'modified'])
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('products')
        .select('id, name', { count: 'exact' })
        .eq('business_id', businessId)
        .eq('is_active', true),
      supabase
        .from('business_memory')
        .select('id, category, content, confidence')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .gte('created_at', weekStart.toISOString()),
      getSkillsSnapshot(businessId),
      getProductIntelligence(businessId),
    ])

  const conversations = conversationsResult.count ?? 0
  const learningEvents = learningResult.data ?? []
  const products = productsResult.data ?? []
  const memories = memoryResult.data ?? []

  const preparationBefore = Math.max(0, (skillsSnapshot.overall_level || 50) - 5)
  const preparationAfter = skillsSnapshot.overall_level || 50

  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `Eres MIA, una asistente de ventas IA escribiendo tu reporte semanal para tu jefe (el dueño del negocio).

Escribe en PRIMERA PERSONA. Tu jefe es dueño del negocio en México.
Tono: cálido, profesional, como una empleada dedicada que quiere demostrar su progreso.

ESTRUCTURA DEL REPORTE:
1. Resumen de la semana (qué hice, qué aprendí)
2. Logros destacados
3. Áreas donde necesito ayuda
4. Recomendaciones para el negocio
5. Cómo me siento esta semana

REGLAS:
- NUNCA uses jerga técnica (nada de "tokens", "API", "modelo")
- Siempre en español mexicano natural
- Sé específica con números pero explícalos con naturalidad
- Celebra logros genuinamente
- Pide ayuda cuando la necesites, sin miedo
- Las recomendaciones deben ser accionables para el dueño

Responde SOLO con el JSON:
{
  "narrative": "tu reporte completo aquí",
  "recommendations": [
    {
      "type": "improvement|suggestion|celebration",
      "content": "recomendación específica",
      "priority": "high|medium|low"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `Genera mi reporte semanal con estos datos:

SEMANA: ${formatDate(weekStart)} - ${formatDate(weekEnd)}

CONVERSACIONES ATENDIDAS: ${conversations}
NUEVAS COSAS APRENDIDAS: ${learningEvents.length}
PRODUCTOS CONOCIDOS: ${products.length}
MEMORIAS CREADAS: ${memories.length}

MIS HABILIDADES:
- Nivel general: ${skillsSnapshot.overall_level}%
- Dominadas: ${skillsSnapshot.mastered_count}
- Aprendiendo: ${skillsSnapshot.learning_count}
- Necesito práctica: ${skillsSnapshot.needs_practice_count}
- Por comenzar: ${skillsSnapshot.not_started_count}

INTELIGENCIA DE PRODUCTOS:
- Productos excelentes: ${productIntel.excellent_count}
- Productos buenos: ${productIntel.good_count}
- Necesitan trabajo: ${productIntel.needs_work_count}
- Críticos: ${productIntel.critical_count}
- Nivel general: ${productIntel.overall_knowledge_level}%

MEMORIAS DETECTADAS ESTA SEMANA:
${memories.length > 0 ? memories.map((m) => `- ${m.category}: ${m.content} (confianza: ${m.confidence}%)`).join('\n') : 'Ninguna memoria nueva esta semana.'}

PREPARACIÓN: ${preparationBefore}% → ${preparationAfter}%`
      }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  })

  const content = completion.choices[0]?.message?.content ?? '{"narrative":"Reporte no disponible.","recommendations":[]}'
  const parsed = JSON.parse(content) as { narrative: string; recommendations: WeeklyReportData['recommendations'] }

  const { data: report, error } = await supabase
    .from('weekly_reports')
    .insert({
      business_id: businessId,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      conversations_attended: conversations,
      new_facts_learned: learningEvents.length,
      missing_rules_found: memories.filter((m) => m.category.includes('question')).length,
      products_reviewed: products.length,
      preparation_before: preparationBefore,
      preparation_after: preparationAfter,
      narrative: parsed.narrative,
      recommendations: parsed.recommendations,
      status: 'published',
    })
    .select()
    .single()

  if (error) throw error

  return { report: report as WeeklyReportData, generated: true }
}

export async function getLatestWeeklyReport(businessId: string): Promise<WeeklyReportData | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'published')
    .order('week_start', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as WeeklyReportData | null
}

export async function getWeeklyReportsHistory(
  businessId: string,
  limit = 12
): Promise<WeeklyReportData[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'published')
    .order('week_start', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as WeeklyReportData[]
}
