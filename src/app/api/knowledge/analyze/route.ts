import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const analysisSchema = z.object({
  overall_score: z.number().min(0).max(100),
  completeness_score: z.number().min(0).max(100),
  consistency_score: z.number().min(0).max(100),
  readiness_score: z.number().min(0).max(100),
  gaps: z.array(z.object({
    field: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  conflicts: z.array(z.object({
    description: z.string(),
    items: z.array(z.string()),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  readiness_issues: z.array(z.object({
    question: z.string(),
    reason: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  suggestions: z.array(z.object({
    type: z.enum(['missing_knowledge', 'missing_product', 'missing_rule', 'contradiction', 'improvement']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    title: z.string(),
    description: z.string(),
    suggested_category: z.string().nullable(),
    suggested_question: z.string().nullable(),
    suggested_answer: z.string().nullable(),
    suggested_rule_content: z.string().nullable(),
  })),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { business_id } = body as { business_id: string }

  if (!business_id) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: existingReport } = await admin
    .from('knowledge_analysis_reports')
    .select('id, status, created_at')
    .eq('business_id', business_id)
    .eq('status', 'analyzing')
    .maybeSingle()

  const STALE_ANALYZING_MINUTES = 10
  if (existingReport) {
    const createdAt = existingReport.created_at
      ? new Date(existingReport.created_at).getTime()
      : Date.now()
    const isStale =
      Date.now() - createdAt > STALE_ANALYZING_MINUTES * 60 * 1000

    if (!isStale) {
      return NextResponse.json({ error: 'Analysis already in progress' }, { status: 409 })
    }

    await admin
      .from('knowledge_analysis_reports')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', existingReport.id)
  }

  const { data: report, error: reportError } = await admin
    .from('knowledge_analysis_reports')
    .insert({ business_id, status: 'pending' })
    .select('id')
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }

  await admin
    .from('knowledge_analysis_reports')
    .update({ status: 'analyzing' })
    .eq('id', report.id)

  const [knowledgeResult, productsResult, rulesResult, instructionsResult, brandResult] =
    await Promise.all([
      admin.from('knowledge_items').select('*').eq('business_id', business_id).eq('is_active', true),
      admin.from('products').select('*').eq('business_id', business_id).eq('is_active', true),
      admin.from('sales_rules').select('*').eq('business_id', business_id).eq('is_active', true),
      admin.from('ai_instructions').select('*').eq('business_id', business_id).eq('is_active', true),
      admin.from('brand_identities').select('*').eq('business_id', business_id).maybeSingle(),
    ])

  const knowledge = knowledgeResult.data ?? []
  const products = productsResult.data ?? []
  const rules = rulesResult.data ?? []
  const instructions = instructionsResult.data ?? []
  const brand = brandResult.data

  const knowledgeContext = knowledge.length > 0
    ? knowledge.map((k) => `- [${k.category}] P: ${k.question} → R: ${k.answer}`).join('\n')
    : '(Sin conocimiento registrado)'

  const productsContext = products.length > 0
    ? products.map((p) => `- ${p.name}: $${p.price ?? 'sin precio'} — ${p.description ?? 'sin descripción'}`).join('\n')
    : '(Sin productos registrados)'

  const rulesContext = rules.length > 0
    ? rules.map((r) => `- [${r.category}] ${r.content}`).join('\n')
    : '(Sin reglas de venta)'

  const instructionsContext = instructions.length > 0
    ? instructions.map((i) => `- ${i.instruction}`).join('\n')
    : '(Sin instrucciones IA)'

  const brandContext = brand
    ? `Negocio: ${brand.business_name}, Pitch: ${brand.elevator_pitch ?? 'N/A'}, Clientes: ${brand.target_customers ?? 'N/A'}`
    : '(Sin identidad de marca)'

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: analysisSchema,
      prompt: `Eres un experto en preparación de asistentes de ventas con IA. Analiza la siguiente información de un negocio y evalúa qué tan preparado está su asistente para vender.

CONTEXTO DEL NEGOCIO:
${brandContext}

CONOCIMIENTO REGISTRADO (${knowledge.length} items):
${knowledgeContext}

PRODUCTOS (${products.length}):
${productsContext}

REGLAS DE VENTA (${rules.length}):
${rulesContext}

INSTRUCCIONES IA (${instructions.length}):
${instructionsContext}

INSTRUCCIONES DE ANÁLISIS:
1. Evalúa COMPLETITUD: ¿Qué información falta? (precios, descripciones, políticas, garantías, etc.)
2. Evalúa CONSISTENCIA: ¿Hay contradicciones o información conflictiva?
3. Evalúa PREPARACIÓN PARA VENTAS: ¿Qué preguntas harán los clientes que el asistente no puede responder?
4. Genera sugerencias específicas para mejorar cada problema encontrado.

Para cada sugerencia:
- Si es información faltante: sugiere una categoría (faq, business_info, objection, process, tip), pregunta y respuesta
- Si es una regla faltante: sugiere el contenido de la regla
- Si es una mejora: sugiere qué knowledge_item mejorar

Sé específico y práctico. Cada sugerencia debe ser accionable.`,
    })

    const analysisResult = result.object

    const { error: completeError } = await admin
      .from('knowledge_analysis_reports')
      .update({
        status: 'completed',
        overall_score: analysisResult.overall_score,
        completeness_score: analysisResult.completeness_score,
        consistency_score: analysisResult.consistency_score,
        readiness_score: analysisResult.readiness_score,
        gaps: analysisResult.gaps,
        conflicts: analysisResult.conflicts,
        readiness_issues: analysisResult.readiness_issues,
        analysis_model: 'gpt-4o-mini',
        tokens_used: 0,
        cost: 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', report.id)

    if (completeError) {
      throw new Error(`Failed to complete report: ${completeError.message}`)
    }

    if (analysisResult.suggestions.length > 0) {
      const suggestions = analysisResult.suggestions.map((s) => ({
        report_id: report.id,
        business_id,
        type: s.type,
        severity: s.severity,
        title: s.title,
        description: s.description,
        suggested_category: s.suggested_category,
        suggested_question: s.suggested_question,
        suggested_answer: s.suggested_answer,
        suggested_rule_content: s.suggested_rule_content,
      }))

      await admin.from('knowledge_suggestions').insert(suggestions)
    }

    return NextResponse.json({
      report_id: report.id,
      status: 'completed',
      scores: {
        overall: analysisResult.overall_score,
        completeness: analysisResult.completeness_score,
        consistency: analysisResult.consistency_score,
        readiness: analysisResult.readiness_score,
      },
      problems: {
        gaps: analysisResult.gaps.length,
        conflicts: analysisResult.conflicts.length,
        readiness_issues: analysisResult.readiness_issues.length,
      },
      suggestions_count: analysisResult.suggestions.length,
    })
  } catch (error) {
    console.error('[knowledge/analyze] Analysis failed:', error)
    await admin
      .from('knowledge_analysis_reports')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', report.id)

    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('business_id')

  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('knowledge_analysis_reports')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ report: null })
  }

  return NextResponse.json({ report: data })
}
