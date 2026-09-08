import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { invalidateSystemContext } from '@/lib/cache/invalidator'

type TeachEvent = {
  id: string
  business_id: string
  assistant_id: string
  correction_type: 'knowledge' | 'rule' | 'instruction'
  category: string | null
  original_response: string
  corrected_response: string | null
  status: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, action } = body as { id?: string; action?: 'approve' | 'reject' }

  if (!id || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: event, error: fetchError } = await admin
    .from('learning_events')
    .select('id, business_id, assistant_id, correction_type, category, original_response, corrected_response, status')
    .eq('id', id)
    .single()

  if (fetchError || !event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const typedEvent = event as unknown as TeachEvent

  if (typedEvent.status !== 'pending') {
    return NextResponse.json({ error: 'Event is not pending' }, { status: 400 })
  }

  const { data: business } = await admin
    .from('businesses')
    .select('id')
    .eq('id', typedEvent.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let knowledge_item_id: string | null = null

  if (action === 'approve') {
    const content = typedEvent.corrected_response?.trim()
    if (!content) {
      return NextResponse.json({ error: 'No content to approve' }, { status: 400 })
    }

    if (typedEvent.correction_type === 'knowledge') {
      const question = typedEvent.original_response.trim()
      if (!question) {
        return NextResponse.json({ error: 'Missing question for knowledge item' }, { status: 400 })
      }

      const { data: knowledgeItem, error: insertError } = await admin
        .from('knowledge_items')
        .insert({
          business_id: typedEvent.business_id,
          category: typedEvent.category ?? 'faq',
          question,
          answer: content,
          source: 'correction',
          confidence: 'high',
        })
        .select('id')
        .single()

      if (insertError || !knowledgeItem) {
        return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
      }
      knowledge_item_id = knowledgeItem.id

      await admin.from('knowledge_versions').insert({
        business_id: typedEvent.business_id,
        entity_type: 'knowledge_item',
        entity_id: knowledgeItem.id,
        new_value: { question, answer: content },
        change_source: 'correction',
        changed_by: user.id,
      })
    } else if (typedEvent.correction_type === 'rule') {
      const { data: ruleItem, error: insertError } = await admin
        .from('sales_rules')
        .insert({
          business_id: typedEvent.business_id,
          category: typedEvent.category ?? 'restrictions',
          content,
        })
        .select('id')
        .single()

      if (insertError || !ruleItem) {
        return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
      }
      knowledge_item_id = ruleItem.id

      await admin.from('knowledge_versions').insert({
        business_id: typedEvent.business_id,
        entity_type: 'sales_rule',
        entity_id: ruleItem.id,
        new_value: { content },
        change_source: 'correction',
        changed_by: user.id,
      })
    } else if (typedEvent.correction_type === 'instruction') {
      const { data: instructionItem, error: insertError } = await admin
        .from('ai_instructions')
        .insert({
          business_id: typedEvent.business_id,
          instruction: content,
          source: 'correction',
        })
        .select('id')
        .single()

      if (insertError || !instructionItem) {
        return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
      }
      knowledge_item_id = instructionItem.id

      await admin.from('knowledge_versions').insert({
        business_id: typedEvent.business_id,
        entity_type: 'ai_instruction',
        entity_id: instructionItem.id,
        new_value: { instruction: content },
        change_source: 'correction',
        changed_by: user.id,
      })
    } else {
      return NextResponse.json({ error: 'Unsupported correction type' }, { status: 400 })
    }
  }

  const { error: updateError } = await admin
    .from('learning_events')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      knowledge_item_id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', typedEvent.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (action === 'approve') {
    invalidateSystemContext(typedEvent.business_id)
  }

  return NextResponse.json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' })
}