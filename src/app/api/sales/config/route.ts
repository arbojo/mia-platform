import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { getSalesConfig, upsertSalesConfig } from '@/lib/ai/knowledge'

export async function GET() {
  try {
    const { supabase } = await requireAuth()

    const { data: businessIds, error: rpcError } = await supabase.rpc('get_user_business_ids')
    if (rpcError || !businessIds || businessIds.length === 0) {
      return NextResponse.json(
        { error: 'No se encontró ningún negocio para el usuario' },
        { status: 404 },
      )
    }

    const config = await getSalesConfig(businessIds[0])
    return NextResponse.json({ config })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAuth()

    const { data: businessIds, error: rpcError } = await supabase.rpc('get_user_business_ids')
    if (rpcError || !businessIds || businessIds.length === 0) {
      return NextResponse.json(
        { error: 'No se encontró ningún negocio para el usuario' },
        { status: 404 },
      )
    }

    const body = await request.json()

    const allowedFields = [
      'confirmation_message',
      'cancellation_message',
      'ask_address',
      'ask_phone',
      'allow_cancellation',
      'cancellation_window_hours',
    ] as const

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
    }

    const config = await upsertSalesConfig(businessIds[0], updates)
    return NextResponse.json({ config })
  } catch (err) {
    return handleApiError(err)
  }
}
