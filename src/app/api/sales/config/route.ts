import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { getSalesConfig, upsertSalesConfig } from '@/lib/ai/knowledge'
import { invalidateSystemContext } from '@/lib/cache/invalidator'

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
      'retention_discount_percent',
      'retention_discount_message',
      'recovery_sending_start_hour',
      'recovery_sending_end_hour',
      'recovery_max_per_day',
    ] as const

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (!(field in body)) continue

      if (field === 'recovery_sending_start_hour') {
        const hour = Number(body[field])
        if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
          return NextResponse.json(
            { error: 'recovery_sending_start_hour debe ser un entero entre 0 y 23' },
            { status: 400 },
          )
        }
        updates[field] = hour
        continue
      }

      if (field === 'recovery_sending_end_hour') {
        const hour = Number(body[field])
        if (!Number.isInteger(hour) || hour < 1 || hour > 24) {
          return NextResponse.json(
            { error: 'recovery_sending_end_hour debe ser un entero entre 1 y 24' },
            { status: 400 },
          )
        }
        updates[field] = hour
        continue
      }

      if (field === 'recovery_max_per_day') {
        const max = Number(body[field])
        if (!Number.isInteger(max) || max < 1) {
          return NextResponse.json(
            { error: 'recovery_max_per_day debe ser un entero mayor a 0' },
            { status: 400 },
          )
        }
        updates[field] = max
        continue
      }

      if (field === 'retention_discount_percent') {
        const percent = Number(body[field])
        if (!Number.isInteger(percent) || percent < 5 || percent > 20) {
          return NextResponse.json(
            { error: 'retention_discount_percent debe ser un entero entre 5 y 20' },
            { status: 400 },
          )
        }
        updates[field] = percent
        continue
      }

      if (field === 'retention_discount_message') {
        if (typeof body[field] !== 'string' || body[field].length > 500) {
          return NextResponse.json(
            { error: 'retention_discount_message debe ser un texto de hasta 500 caracteres' },
            { status: 400 },
          )
        }
        updates[field] = body[field] as string
        continue
      }

      updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
    }

    const config = await upsertSalesConfig(businessIds[0], updates)
    invalidateSystemContext(businessIds[0])
    return NextResponse.json({ config })
  } catch (err) {
    return handleApiError(err)
  }
}
