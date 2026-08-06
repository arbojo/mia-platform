import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase } = await requireAuth()

    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages })
  } catch (err) {
    return handleApiError(err)
  }
}
