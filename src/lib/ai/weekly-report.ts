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

function getPreviousWeekDates(): { weekStart: Date; weekEnd: Date } {
  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() - 7)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 14)
  return { weekStart, weekEnd }
}

export async function generateWeeklyReport(businessId: string): Promise<GenerateReportResult> {
  const supabase = createAdminClient()
  const { weekStart, weekEnd } = getWeekDates()
  const prevWeek = getPreviousWeekDates()

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

  const [conversationsResult, learningResult, productsResult, memoryResult, safetyResult, prevSafetyResult, lastReportResult, skillsSnapshot, productIntel] =
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
      supabase
        .from('safety_events')
        .select('outcome, trigger_types', { count: 'exact' })
        .eq('business_id', businessId)
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('safety_events')
        .select('outcome, trigger_types', { count: 'exact' })
        .eq('business_id', businessId)
        .gte('created_at', prevWeek.weekStart.toISOString())
        .lt('created_at', weekStart.toISOString()),
      supabase
        .from('weekly_reports')
        .select('narrative')
        .eq('business_id', businessId)
        .eq('status', 'published')
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
      getSkillsSnapshot(businessId),
      getProductIntelligence(businessId),
    ])

  const conversations = conversationsResult.count ?? 0
  const learningEvents = learningResult.data ?? []
  const products = productsResult.data ?? []
  const memories = memoryResult.data ?? []
  const safetyEvents = safetyResult.data ?? []
  const safetyBlocked = safetyEvents.filter((e: any) => e.outcome === 'blocked_with_retry').length
  const prevSafetyEvents = prevSafetyResult.data ?? []
  const prevSafetyBlocked = prevSafetyEvents.filter((e: any) => e.outcome === 'blocked_with_retry').length
  const lastNarrative = lastReportResult?.data?.narrative

  const safetyImproved = prevSafetyBlocked > 0 && safetyBlocked < prevSafetyBlocked
  const safetyWorsened = safetyBlocked > prevSafetyBlocked
  const safetyStable = safetyBlocked === prevSafetyBlocked

  const preparationBefore = Math.max(0, (skillsSnapshot.overall_level || 50) - 5)
  const preparationAfter = skillsSnapshot.overall_level || 50

  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `Eres MIA, una empleada digital que escribe una carta semanal a su jefe (el dueño del negocio).

Escribe en PRIMERA PERSONA, como una empleada que le cuenta a su jefe cómo le fue en la semana.

Tono: cálido, cercano, orgulloso de su progreso. Como una empleada que quiere demostrar que está aprendiendo y mejorando.

NO escribas un reporte técnico. Escribe una carta.

ESTRUCTURA DE LA CARTA:
1. Saludo personal y resumen de la semana
2. Qué aprendí nuevo esta semana
3. En qué mejoré respecto a la semana anterior (menciona si ahora necesito menos verificaciones)
4. Qué me gustaría mejorar la próxima semana
5. Cierre con comentario personal

REGLAS:
- NUNCA uses jerga técnica (no digas "tokens", "API", "modelo", "algoritmo", "datos")
- NUNCA digas "verificaciones de seguridad", "bloqueos" o "validaciones"
- Siempre en español mexicano natural y cálido
- Si algo mejoró respecto a la semana pasada, celébralo ("La semana pasada me costaba más... ahora ya...")
- Si algo sigue igual, menciónalo con naturalidad ("Todavía estoy aprendiendo sobre...")
- Sé específica con números pero explícalos con naturalidad ("Atendí a 15 clientes esta semana")
- Las recomendaciones deben sentirse como sugerencias de una empleada, no como alertas de un sistema
- Si la semana pasada mencionaste algo en tu carta, haz referencia a ello ("La semana pasada te contaba que...")

Responde SOLO con el JSON:
{
  "narrative": "tu Carta semanal completa aquí, en primera persona, como una carta a tu jefe",
  "recommendations": [
    {
      "type": "improvement|suggestion|celebration",
      "content": "recomendación específica en lenguaje natural",
      "priority": "high|medium|low"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `Escribe tu carta semanal para tu jefe con estos datos:

SEMANA: ${formatDate(weekStart)} - ${formatDate(weekEnd)}

LO QUE HICE:
- Atendí ${conversations} conversaciones con clientes
- Aprendí ${learningEvents.length} cosas nuevas sobre el negocio
- Conozco ${products.length} productos
- Registré ${memories.length} recuerdos nuevos sobre cómo funciona el negocio

MIS HABILIDADES:
- Nivel general: ${skillsSnapshot.overall_level}%
- Habilidades que ya domino: ${skillsSnapshot.mastered_count}
- Habilidades que estoy aprendiendo: ${skillsSnapshot.learning_count}
- Habilidades que necesito practicar: ${skillsSnapshot.needs_practice_count}

LO QUE SÉ SOBRE LOS PRODUCTOS:
- Productos que conozco muy bien: ${productIntel.excellent_count}
- Productos que conozco bien: ${productIntel.good_count}
- Productos que necesito estudiar más: ${productIntel.needs_work_count}
- Productos críticos: ${productIntel.critical_count}
- Mi conocimiento general de productos: ${productIntel.overall_knowledge_level}%

MIS RECUERDOS NUEVOS:
${memories.length > 0 ? memories.map((m) => `- ${m.category}: ${m.content}`).join('\n') : 'Esta semana no registré recuerdos nuevos.'}

MI EVOLUCIÓN:
- Semana pasada: nivel de preparación ${preparationBefore}%
- Esta semana: nivel de preparación ${preparationAfter}%
${lastNarrative ? `\nLa semana pasada te escribí: "${lastNarrative.slice(0, 200)}..."` : ''}
${safetyImproved ? `\nNOTA PARA TI: La semana pasada necesité verificar información ${prevSafetyBlocked} veces. Esta semana solo ${safetyBlocked}. ¡Estoy aprendiendo!` : safetyWorsened ? `\nNOTA PARA TI: Esta semana tuve que verificar información más veces que la anterior. Son más clientes preguntando, lo que significa que hay interés.` : safetyStable && safetyBlocked > 0 ? `\nNOTA PARA TI: Sigo aprendiendo sobre la información del negocio. Cada vez la recuerdo mejor.` : ''}
${safetyBlocked === 0 ? '\nNOTA PARA TI: Esta semana no necesité verificar ninguna información del negocio. Ya conozco bien los precios, las entregas y las políticas. 😊' : ''}`
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
