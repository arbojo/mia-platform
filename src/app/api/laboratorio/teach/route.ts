import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { invalidateSystemContext } from '@/lib/cache/invalidator'

const KNOWLEDGE_CATEGORIES = ['business_info', 'faq', 'objection', 'process', 'tip'] as const
const RULE_CATEGORIES = ['zones', 'payment', 'schedule', 'promotions', 'restrictions', 'escalation'] as const

type TeachItem = {
  type: 'knowledge' | 'rule' | 'instruction'
  question?: string
  answer: string
  category?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { business_id, items } = body as {
    business_id: string
    items: TeachItem[]
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  const invalid: string[] = []
  for (const item of items) {
    if (item.type === 'knowledge') {
      if (!item.question || !item.question.trim()) {
        invalid.push('Conocimiento sin pregunta')
        continue
      }
      if (item.category && !(KNOWLEDGE_CATEGORIES as readonly string[]).includes(item.category)) {
        invalid.push(`Categoría de conocimiento inválida: ${item.category}`)
      }
    } else if (item.type === 'rule') {
      if (item.category && !(RULE_CATEGORIES as readonly string[]).includes(item.category)) {
        invalid.push(`Categoría de regla inválida: ${item.category}`)
      }
    } else if (item.type !== 'instruction') {
      invalid.push(`Tipo inválido: ${item.type}`)
    }
    if (!item.answer || !item.answer.trim()) {
      invalid.push('Respuesta vacía')
    }
  }

  if (invalid.length > 0) {
    return NextResponse.json({ error: `Items inválidos: ${invalid.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()
  const created: Array<{ id: string; type: string }> = []

  for (const item of items) {
    if (item.type === 'knowledge') {
      const { data, error } = await admin
        .from('knowledge_items')
        .insert({
          business_id,
          category: (item.category as (typeof KNOWLEDGE_CATEGORIES)[number]) ?? 'faq',
          question: item.question?.trim(),
          answer: item.answer,
          source: 'correction',
          confidence: 'high',
        })
        .select('id')
        .single()

      if (!error && data) {
        created.push({ id: data.id, type: 'knowledge' })

        await admin.from('knowledge_versions').insert({
          business_id,
          entity_type: 'knowledge_item',
          entity_id: data.id,
          new_value: { question: item.question, answer: item.answer },
          change_source: 'correction',
          changed_by: user.id,
        })
      }
    } else if (item.type === 'rule') {
      const { data, error } = await admin
        .from('sales_rules')
        .insert({
          business_id,
          category: (item.category as (typeof RULE_CATEGORIES)[number]) ?? 'restrictions',
          content: item.answer,
        })
        .select('id')
        .single()

      if (!error && data) {
        created.push({ id: data.id, type: 'rule' })

        await admin.from('knowledge_versions').insert({
          business_id,
          entity_type: 'sales_rule',
          entity_id: data.id,
          new_value: { content: item.answer },
          change_source: 'correction',
          changed_by: user.id,
        })
      }
    } else if (item.type === 'instruction') {
      const { data, error } = await admin
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

        await admin.from('knowledge_versions').insert({
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

  if (created.length > 0) {
    invalidateSystemContext(business_id)
  }

  return NextResponse.json({ created, count: created.length })
}
