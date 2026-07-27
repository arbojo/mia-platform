import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { message_id, assistant_id, original_response, corrected_response, action } = body as {
    message_id: string
    assistant_id: string
    original_response: string
    corrected_response?: string
    action: 'approve' | 'correct'
  }

  if (!message_id || !assistant_id || !original_response) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (action === 'correct' && !corrected_response) {
    return NextResponse.json({ error: 'corrected_response required for correct action' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: assistant, error: assistantError } = await admin
    .from('assistants')
    .select('business_id')
    .eq('id', assistant_id)
    .single()

  if (assistantError || !assistant) {
    return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })
  }

  const status = action === 'approve' ? 'approved' : 'modified'

  const { data: learningEvent, error: eventError } = await admin
    .from('learning_events')
    .insert({
      message_id,
      assistant_id,
      original_response,
      corrected_response: action === 'correct' ? corrected_response : null,
      status,
      authorized_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 })
  }

  let knowledge_item_id = null

  if (action === 'correct' && corrected_response) {
    const { data: knowledgeItem } = await admin
      .from('knowledge_items')
      .insert({
        business_id: assistant.business_id,
        category: 'faq',
        question: original_response,
        answer: corrected_response,
        source: 'correction',
        confidence: 'high',
      })
      .select('id')
      .single()

    knowledge_item_id = knowledgeItem?.id

    if (knowledge_item_id) {
      await admin.from('learning_events').update({ knowledge_item_id }).eq('id', learningEvent.id)
    }
  }

  return NextResponse.json({
    success: true,
    learning_event_id: learningEvent.id,
    knowledge_item_id,
  })
}
