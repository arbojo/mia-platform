import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { messageId, assistantId } = body

  const { data: message } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single()

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const metadata = message.metadata as Record<string, unknown>
  const usedContext = (metadata as { used_context?: Array<Record<string, string>> })?.used_context ?? []

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })
  }

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
        .single()
      if (rule) {
        label = `Regla de ${rule.category}`
        content = rule.content
      }
    } else if (ctx.type === 'ai_instruction') {
      const { data: instruction } = await supabase
        .from('ai_instructions')
        .select('instruction')
        .eq('id', ctx.id)
        .single()
      if (instruction) {
        label = 'Instrucción de comportamiento'
        content = instruction.instruction
      }
    } else if (ctx.type === 'product') {
      const { data: product } = await supabase
        .from('products')
        .select('name, price')
        .eq('id', ctx.id)
        .single()
      if (product) {
        label = 'Producto'
        content = `${product.name} — $${product.price ?? 'sin precio'}`
      }
    } else if (ctx.type === 'knowledge_item') {
      const { data: knowledge } = await supabase
        .from('knowledge_items')
        .select('question, answer')
        .eq('id', ctx.id)
        .single()
      if (knowledge) {
        label = 'Conocimiento'
        content = `${knowledge.question} → ${knowledge.answer}`
      }
    }

    if (label) {
      resolvedContext.push({ type: ctx.type, label, content })
    }
  }

  return NextResponse.json({
    reasoning: resolvedContext,
    confidence: resolvedContext.length > 0 ? 95 : 50,
    sources: usedContext.map((c) => c.type),
  })
}
