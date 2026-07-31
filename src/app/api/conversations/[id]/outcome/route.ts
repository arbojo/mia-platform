import { requireAuth } from '@/lib/auth'
import { updateConversationOutcome } from '@/lib/dashboard/sales-intelligence'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await requireAuth()
    const { id } = await params

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .limit(1)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.outcome || !['pending', 'interested', 'not_interested', 'sold', 'needs_follow_up'].includes(body.outcome)) {
      return NextResponse.json({ error: 'outcome inválido' }, { status: 400 })
    }

    const result = await updateConversationOutcome(
      supabase,
      business.id,
      id,
      {
        outcome: body.outcome,
        deal_value: body.deal_value ?? null,
        potential_value: body.potential_value ?? null,
      }
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Error al actualizar' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
