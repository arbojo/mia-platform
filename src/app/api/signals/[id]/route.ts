import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase } = await requireAuth()

    const { data: signal } = await supabase
      .from('mia_signals')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!signal) {
      return NextResponse.json({ error: 'Señal no encontrada' }, { status: 404 })
    }

    const { error } = await supabase
      .from('mia_signals')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err)
  }
}
