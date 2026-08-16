import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const assistantId = searchParams.get('assistantId')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let query = supabase
    .from('lab_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (businessId) {
    query = query.eq('business_id', businessId)
  }
  if (assistantId) {
    query = query.eq('assistant_id', assistantId)
  }

  const { data: sessions } = await query

  return NextResponse.json({ sessions: sessions ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { business_id, assistant_id, mode, title, conversation_id } = body

  const admin = createAdminClient()

  const { data: assistant } = await admin
    .from('assistants')
    .select('id, business_id, businesses!inner(id, owner_id)')
    .eq('id', assistant_id)
    .single()

  if (!assistant) {
    return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })
  }

  const business = Array.isArray(assistant.businesses)
    ? assistant.businesses[0]
    : assistant.businesses

  if (!business || business.owner_id !== user.id || business.id !== business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let conversationId = conversation_id

  if (!conversationId) {
    const { data: conversation, error: conversationError } = await admin
      .from('conversations')
      .insert({
        assistant_id,
        type: 'simulation',
        status: 'active',
      })
      .select('id')
      .single()

    if (conversationError || !conversation) {
      return NextResponse.json({ error: conversationError?.message ?? 'Failed to create conversation' }, { status: 500 })
    }

    conversationId = conversation.id
  }

  const { data: session, error } = await admin
    .from('lab_sessions')
    .insert({
      business_id,
      assistant_id,
      mode,
      title: title ?? `${mode} test`,
      conversation_id: conversationId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session, conversationId })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: business } = await admin
    .from('businesses')
    .select('owner_id')
    .eq('id', businessId)
    .maybeSingle()

  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('lab_sessions').delete().eq('business_id', businessId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
