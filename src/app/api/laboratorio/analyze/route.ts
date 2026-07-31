import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface ContextSource {
  type: string
  label: string
  content: string
}

async function resolveContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usedContext: Array<Record<string, string>>
): Promise<ContextSource[]> {
  const resolved: ContextSource[] = []

  for (const ctx of usedContext) {
    let label = ''
    let content = ''

    if (ctx.type === 'sales_rule') {
      const { data: rule } = await supabase
        .from('sales_rules')
        .select('category, content')
        .eq('id', ctx.id)
        .maybeSingle()
      if (rule) {
        label = `Regla de ${rule.category}`
        content = rule.content
      }
    } else if (ctx.type === 'ai_instruction') {
      const { data: instruction } = await supabase
        .from('ai_instructions')
        .select('instruction')
        .eq('id', ctx.id)
        .maybeSingle()
      if (instruction) {
        label = 'Instrucción de comportamiento'
        content = instruction.instruction
      }
    } else if (ctx.type === 'product') {
      const { data: product } = await supabase
        .from('products')
        .select('name, price')
        .eq('id', ctx.id)
        .maybeSingle()
      if (product) {
        label = 'Producto'
        content = `${product.name} — $${product.price ?? 'sin precio'}`
      }
    } else if (ctx.type === 'knowledge_item') {
      const { data: knowledge } = await supabase
        .from('knowledge_items')
        .select('question, answer')
        .eq('id', ctx.id)
        .maybeSingle()
      if (knowledge) {
        label = 'Conocimiento'
        content = `${knowledge.question} → ${knowledge.answer}`
      }
    }

    if (label) {
      resolved.push({ type: ctx.type, label, content })
    }
  }

  return resolved
}

function buildFeedback(resolved: ContextSource[]) {
  if (resolved.length === 0) {
    return {
      confidence: 50,
      tips: [
        'No usó contexto del negocio en esta respuesta.',
        'Verifica que el conocimiento, las reglas y los productos estén cargados en el asistente.',
      ],
      score: 40,
    }
  }

  const types = new Set(resolved.map((r) => r.type))
  const tips: string[] = []

  if (types.has('product')) {
    tips.push('Mencionó los productos correctos.')
  }
  if (types.has('sales_rule')) {
    tips.push('Aplicó las reglas del negocio.')
  }
  if (types.has('knowledge_item')) {
    tips.push('Respaldó la respuesta con el conocimiento del negocio.')
  }
  if (types.has('ai_instruction')) {
    tips.push('Siguió las instrucciones de comportamiento.')
  }

  if (tips.length === 0) {
    tips.push('La respuesta se generó usando el contexto cargado.')
  }

  return {
    confidence: 95,
    tips,
    score: 90,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { messageId, conversationId } = body

  let message: { metadata?: unknown } | null = null

  if (conversationId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    message = data
  } else if (messageId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle()
    message = data
  }

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const metadata = message.metadata as Record<string, unknown>
  const usedContext = (metadata as { used_context?: Array<Record<string, string>> })?.used_context ?? []

  const resolvedContext = await resolveContext(supabase, usedContext)
  const feedback = buildFeedback(resolvedContext)

  return NextResponse.json({
    reasoning: resolvedContext,
    confidence: feedback.confidence,
    sources: usedContext.map((c) => c.type),
    tips: feedback.tips,
    score: feedback.score,
  })
}
