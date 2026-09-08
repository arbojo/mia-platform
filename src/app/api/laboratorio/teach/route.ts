import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

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
  const { business_id, assistant_id, items } = body as {
    business_id?: string
    assistant_id?: string
    items?: TeachItem[]
  }

  if (!business_id || !assistant_id) {
    return NextResponse.json({ error: 'Missing business_id or assistant_id' }, { status: 400 })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: business } = await admin
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

  const pending: Array<{ id: string; type: string }> = []

  for (const item of items) {
    const { data: event, error } = await admin
      .from('learning_events')
      .insert({
        business_id,
        assistant_id,
        correction_type: item.type,
        original_response: item.type === 'knowledge' && item.question ? item.question.trim() : '',
        corrected_response: item.answer,
        category: item.category ?? null,
        severity: 'medium',
        status: 'pending',
        authorized_by: user.id,
        knowledge_change: {
          type: item.type,
          question: item.question?.trim() ?? null,
          answer: item.answer,
          category: item.category ?? null,
        },
      })
      .select('id')
      .single()

    if (!error && event) {
      pending.push({ id: event.id, type: item.type })
    }
  }

  return NextResponse.json({ pending, count: pending.length })
}