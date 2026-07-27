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
  const { data: session, error } = await admin
    .from('lab_sessions')
    .insert({
      business_id,
      assistant_id,
      mode,
      title: title ?? `${mode} test`,
      conversation_id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session })
}
