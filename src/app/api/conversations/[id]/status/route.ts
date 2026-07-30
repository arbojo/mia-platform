import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
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

    const body = await request.json()
    const { status } = body

    const validStatuses = ['active', 'waiting', 'completed', 'abandoned', 'archived']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('conversations')
      .update({ status })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}
