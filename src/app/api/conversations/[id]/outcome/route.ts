import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { applyConversationOutcome } from '@/lib/sales/events'

const validOutcomes = ['pending', 'interested', 'not_interested', 'sold', 'needs_follow_up'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase } = await requireAuth()

    const { data: businessIds, error: rpcError } = await supabase.rpc('get_user_business_ids')
    if (rpcError || !businessIds || businessIds.length === 0) {
      return NextResponse.json({ error: 'No se encontró ningún negocio para el usuario' }, { status: 404 })
    }

    const admin = createAdminClient()
    // conversations no tiene business_id: el tenant se alcanza por assistants.
    const { data: conv } = await admin
      .from('conversations')
      .select('id, assistants!inner(business_id)')
      .eq('id', id)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    // Sin el tipo generado, supabase-js infiere el embed como arreglo. La forma
    // real se verificó contra PostgREST: { id, assistants: { business_id } }.
    // Un alias (`business_id:assistants!inner(...)`) NO aplana: anida el objeto
    // y rompería la comparación de tenant en silencio.
    const { assistants } = conv as unknown as { assistants: { business_id: string } }

    if (!businessIds.includes(assistants.business_id)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { outcome } = body

    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json({ error: 'Outcome no válido' }, { status: 400 })
    }

    await applyConversationOutcome({
      conversationId: id,
      outcome,
      eventType: outcome === 'sold' ? 'SALE_WON' : outcome === 'not_interested' ? 'SALE_LOST' : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err)
  }
}
