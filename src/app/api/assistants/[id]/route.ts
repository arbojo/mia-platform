import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase: authSupabase, user } = await requireAuth()
    const admin = createAdminClient()

    const { data: assistant } = await authSupabase
      .from('assistants')
      .select('*, businesses(owner_id)')
      .eq('id', id)
      .single()

    if (!assistant) {
      return NextResponse.json({ error: 'Asistente no encontrado' }, { status: 404 })
    }

    const business = assistant.businesses as { owner_id: string } | null
    if (!business || business.owner_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (name.length < 1 || name.length > 100) {
        return NextResponse.json({ error: 'El nombre debe tener entre 1 y 100 caracteres' }, { status: 400 })
      }
      updates.name = name
    }

    if (body.communication_style !== undefined) {
      if (!['formal', 'casual', 'warm', 'direct'].includes(body.communication_style)) {
        return NextResponse.json({ error: 'Estilo de comunicación no válido' }, { status: 400 })
      }
      updates.communication_style = body.communication_style
    }

    if (body.personality !== undefined) {
      const p = body.personality
      if (
        typeof p.warmth !== 'number' || p.warmth < 0 || p.warmth > 100 ||
        typeof p.formality !== 'number' || p.formality < 0 || p.formality > 100 ||
        typeof p.humor !== 'number' || p.humor < 0 || p.humor > 100 ||
        typeof p.sales_aggressiveness !== 'number' || p.sales_aggressiveness < 0 || p.sales_aggressiveness > 100
      ) {
        return NextResponse.json({ error: 'Personalidad no válida (valores 0-100)' }, { status: 400 })
      }
      updates.personality = p
    }

    if (body.status !== undefined) {
      if (!['draft', 'training', 'ready', 'active', 'inactive'].includes(body.status)) {
        return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
      }
      updates.status = body.status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const { error } = await admin
      .from('assistants')
      .update(updates)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err)
  }
}
