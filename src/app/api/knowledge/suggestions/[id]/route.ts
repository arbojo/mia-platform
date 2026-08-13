import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  buildApprovalPayload,
  type SuggestionEdits,
} from '@/lib/knowledge/suggestions'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('knowledge_suggestions')
    .select('business_id, type, suggested_category, suggested_question, suggested_answer, suggested_rule_content')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', existing.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { status, edits } = body as {
    status: 'approved' | 'rejected'
    edits?: SuggestionEdits
  }

  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const admin = createAdminClient()
  let knowledge_item_id = null

  if (status === 'approved') {
    if (edits !== undefined) {
      const resolution = buildApprovalPayload(existing, edits)
      if (!resolution.ok) {
        return NextResponse.json({ error: resolution.error }, { status: 400 })
      }

      if (resolution.payload.kind === 'knowledge') {
        const { data: knowledgeItem, error: insertError } = await admin
          .from('knowledge_items')
          .insert({
            business_id: existing.business_id,
            category: resolution.payload.category,
            question: resolution.payload.question,
            answer: resolution.payload.answer,
            image_url: resolution.payload.image_url,
            trigger_condition: resolution.payload.trigger_condition,
            media_type: resolution.payload.media_type,
            product_id: resolution.payload.product_id,
            source: 'correction',
            confidence: 'medium',
          })
          .select('id')
          .single()
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
        knowledge_item_id = knowledgeItem?.id
      } else {
        const { data: ruleItem, error: insertError } = await admin
          .from('sales_rules')
          .insert({
            business_id: existing.business_id,
            category: resolution.payload.category,
            content: resolution.payload.content,
          })
          .select('id')
          .single()
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
        knowledge_item_id = ruleItem?.id
      }
    } else if (existing.suggested_question && existing.suggested_answer) {
      const { data: knowledgeItem, error: insertError } = await admin
        .from('knowledge_items')
        .insert({
          business_id: existing.business_id,
          category: existing.suggested_category ?? 'faq',
          question: existing.suggested_question,
          answer: existing.suggested_answer,
          source: 'correction',
          confidence: 'medium',
        })
        .select('id')
        .single()
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      knowledge_item_id = knowledgeItem?.id
    } else if (existing.suggested_rule_content) {
      const { data: ruleItem, error: insertError } = await admin
        .from('sales_rules')
        .insert({
          business_id: existing.business_id,
          category: 'restrictions',
          content: existing.suggested_rule_content,
        })
        .select('id')
        .single()
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      knowledge_item_id = ruleItem?.id
    }
  }

  const { error } = await admin
    .from('knowledge_suggestions')
    .update({
      status,
      knowledge_item_id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, knowledge_item_id })
}
