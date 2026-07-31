import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { message_id, conversation_id, assistant_id, user_question, original_response, corrected_response, action, correction_type } = body as {
    message_id: string
    conversation_id?: string
    assistant_id: string
    user_question?: string
    original_response: string
    corrected_response?: string
    action: 'approve' | 'correct'
    correction_type?: 'knowledge' | 'rule' | 'instruction'
  }

  if (!message_id || !assistant_id || !original_response) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  if (action === 'correct' && !corrected_response) {
    return NextResponse.json({ error: 'Se requiere respuesta correcta para la acción correct' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: assistant, error: assistantError } = await admin
    .from('assistants')
    .select('business_id')
    .eq('id', assistant_id)
    .single()

  if (assistantError || !assistant) {
    return NextResponse.json({ error: 'Asistente no encontrado' }, { status: 404 })
  }

  const resolvedMessageId = await resolveMessageId(admin, {
    clientMessageId: message_id,
    conversationId: conversation_id,
    assistantId: assistant_id,
    originalResponse: original_response,
  })

  const status = action === 'approve' ? 'approved' : 'modified'
  const type = correction_type ?? 'knowledge'

  const { data: learningEvent, error: eventError } = await admin
    .from('learning_events')
    .insert({
      message_id: resolvedMessageId,
      conversation_id: conversation_id ?? null,
      assistant_id,
      original_response,
      corrected_response: action === 'correct' ? corrected_response : null,
      status,
      correction_type: type,
      authorized_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 })
  }

  let entity_id = null
  let entity_type = null

  if (action === 'correct' && corrected_response) {
    if (type === 'knowledge') {
      const { data: knowledgeItem } = await admin
        .from('knowledge_items')
        .insert({
          business_id: assistant.business_id,
          category: 'faq',
          question: user_question ?? original_response,
          answer: corrected_response,
          source: 'correction',
          confidence: 'high',
        })
        .select('id')
        .single()

      entity_id = knowledgeItem?.id
      entity_type = 'knowledge_item'
    } else if (type === 'rule') {
      const { data: rule } = await admin
        .from('sales_rules')
        .insert({
          business_id: assistant.business_id,
          category: 'payment',
          content: corrected_response,
          priority: 0,
        })
        .select('id')
        .single()

      entity_id = rule?.id
      entity_type = 'sales_rule'
    } else if (type === 'instruction') {
      const { data: instruction } = await admin
        .from('ai_instructions')
        .insert({
          business_id: assistant.business_id,
          instruction: corrected_response,
          source: 'correction',
          priority: 0,
        })
        .select('id')
        .single()

      entity_id = instruction?.id
      entity_type = 'ai_instruction'
    }

    if (entity_id) {
      await admin.from('learning_events').update({ knowledge_item_id: entity_id }).eq('id', learningEvent.id)
    }
  }

  return NextResponse.json({
    success: true,
    learning_event_id: learningEvent.id,
    entity_id,
    entity_type,
  })
}

async function resolveMessageId(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  params: {
    clientMessageId: string
    conversationId?: string
    assistantId: string
    originalResponse: string
  }
): Promise<string | null> {
  const { clientMessageId, conversationId, assistantId, originalResponse } = params

  const { data: direct } = await admin
    .from('messages')
    .select('id')
    .eq('id', clientMessageId)
    .maybeSingle()

  if (direct) {
    return direct.id
  }

  if (conversationId) {
    const { data: byConversation } = await admin
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .eq('content', originalResponse)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (byConversation) {
      return byConversation.id
    }
  }

  const { data: byAssistant } = await admin
    .from('messages')
    .select('id, conversations!inner(assistant_id)')
    .eq('conversations.assistant_id', assistantId)
    .eq('role', 'assistant')
    .eq('content', originalResponse)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return byAssistant?.id ?? null
}
