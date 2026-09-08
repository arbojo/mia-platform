import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assistantId = searchParams.get('assistantId')

  if (!assistantId) {
    return NextResponse.json({ error: 'Missing assistantId' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('learning_events')
    .select('id, correction_type, category, original_response, corrected_response, created_at')
    .eq('assistant_id', assistantId)
    .eq('status', 'pending')
    .in('correction_type', ['knowledge', 'rule', 'instruction'])
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [] })
}