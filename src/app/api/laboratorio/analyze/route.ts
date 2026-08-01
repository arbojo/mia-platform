import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { messageId, assistantId, conversationId } = body

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })
  }

  let message: { metadata: Record<string, unknown> } | null = null

  if (messageId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single()
    message = data as { metadata: Record<string, unknown> } | null
  } else if (conversationId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    message = data as { metadata: Record<string, unknown> } | null
  }

  if (!message) {
    return NextResponse.json({
      reasoning: [],
      confidence: 0,
      sources: [],
      feedback: { tips: [] },
      score: null,
    })
  }

  const metadata = message.metadata as Record<string, unknown>
  const usedContext = (metadata as { used_context?: Array<Record<string, string>> })?.used_context ?? []

  const resolvedContext: Array<{
    type: string
    label: string
    content: string
  }> = []

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
      resolvedContext.push({ type: ctx.type, label, content })
    }
  }

  const confidence = resolvedContext.length > 0 ? 95 : 50

  return NextResponse.json({
    reasoning: resolvedContext,
    confidence,
    sources: usedContext.map((c) => c.type),
    feedback: {
      tips: resolvedContext.map((c) => `${c.label}: ${c.content}`),
    },
    score: confidence,
  })
}
