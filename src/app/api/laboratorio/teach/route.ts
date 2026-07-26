import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { business_id, items } = body as {
    business_id: string
    items: Array<{
      type: 'knowledge' | 'rule' | 'instruction'
      question?: string
      answer: string
      category?: string
    }>
  }

  const created: Array<{ id: string; type: string }> = []

  for (const item of items) {
    if (item.type === 'knowledge' && item.question) {
      const { data, error } = await supabase
        .from('knowledge_items')
        .insert({
          business_id,
          category: 'faq',
          question: item.question,
          answer: item.answer,
          source: 'correction',
          confidence: 'high',
        })
        .select('id')
        .single()

      if (!error && data) {
        created.push({ id: data.id, type: 'knowledge' })

        await supabase.from('knowledge_versions').insert({
          business_id,
          entity_type: 'knowledge_item',
          entity_id: data.id,
          new_value: { question: item.question, answer: item.answer },
          change_source: 'correction',
          changed_by: user.id,
        })
      }
    } else if (item.type === 'rule') {
      const { data, error } = await supabase
        .from('sales_rules')
        .insert({
          business_id,
          category: (item.category as 'zones' | 'payment' | 'schedule' | 'promotions' | 'restrictions' | 'escalation') ?? 'restrictions',
          content: item.answer,
        })
        .select('id')
        .single()

      if (!error && data) {
        created.push({ id: data.id, type: 'rule' })

        await supabase.from('knowledge_versions').insert({
          business_id,
          entity_type: 'sales_rule',
          entity_id: data.id,
          new_value: { content: item.answer },
          change_source: 'correction',
          changed_by: user.id,
        })
      }
    } else if (item.type === 'instruction') {
      const { data, error } = await supabase
        .from('ai_instructions')
        .insert({
          business_id,
          instruction: item.answer,
          source: 'correction',
        })
        .select('id')
        .single()

      if (!error && data) {
        created.push({ id: data.id, type: 'instruction' })

        await supabase.from('knowledge_versions').insert({
          business_id,
          entity_type: 'ai_instruction',
          entity_id: data.id,
          new_value: { instruction: item.answer },
          change_source: 'correction',
          changed_by: user.id,
        })
      }
    }
  }

  return NextResponse.json({ created, count: created.length })
}
