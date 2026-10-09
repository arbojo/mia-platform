import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryEditionAvailable } from '@/lib/delivery/licensing'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  city: z.string().trim().min(1),
  delivery_days: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .describe('Días de la semana (0=domingo ... 6=sábado)'),
  delivery_window_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('09:00'),
  delivery_window_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('19:00'),
})

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryEditionAvailable(businessId!)

    const supabase = createAdminClient()
    const [schedules, overrides] = await Promise.all([
      supabase
        .from('delivery_schedules')
        .select('*')
        .eq('business_id', businessId)
        .order('city', { ascending: true }),
      supabase
        .from('delivery_schedule_overrides')
        .select('*')
        .eq('business_id', businessId)
        .gte('end_date', new Date().toISOString().slice(0, 10))
        .order('start_date', { ascending: true }),
    ])

    if (schedules.error) throw schedules.error
    if (overrides.error) throw overrides.error

    return NextResponse.json({ schedules: schedules.data, overrides: overrides.data })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery schedules GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryEditionAvailable(businessId!)

    const body = await req.json()
    const parsed = scheduleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const value = {
      business_id: businessId,
      city: parsed.data.city,
      delivery_days: parsed.data.delivery_days,
      delivery_window_start: parsed.data.delivery_window_start,
      delivery_window_end: parsed.data.delivery_window_end,
    }

    const { data, error } = await supabase
      .from('delivery_schedules')
      .upsert(value, { onConflict: 'business_id,city' })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ schedule: data })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery schedules PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    const id = new URL(req.url).searchParams.get('id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryEditionAvailable(businessId!)

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('delivery_schedules')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery schedules DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}