import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryEditionAvailable } from '@/lib/delivery/licensing'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const overrideSchema = z.object({
  id: z.string().uuid().optional(),
  city: z.string().trim().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivery_days: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .describe('Días de la semana (0=domingo ... 6=sábado)'),
  delivery_window_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  delivery_window_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
}).refine((v) => v.end_date >= v.start_date, {
  message: 'end_date debe ser >= start_date',
  path: ['end_date'],
})

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryEditionAvailable(businessId!)

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('delivery_schedule_overrides')
      .select('*')
      .eq('business_id', businessId)
      .gte('end_date', new Date().toISOString().slice(0, 10))
      .order('start_date', { ascending: true })

    if (error) throw error

    return NextResponse.json({ overrides: data })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery overrides GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryEditionAvailable(businessId!)

    const body = await req.json()
    const parsed = overrideSchema.safeParse(body)

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
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      delivery_days: parsed.data.delivery_days,
      delivery_window_start: parsed.data.delivery_window_start ?? null,
      delivery_window_end: parsed.data.delivery_window_end ?? null,
      note: parsed.data.note ?? null,
    }

    const { data, error } = await supabase
      .from('delivery_schedule_overrides')
      .insert(value)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ override: data }, { status: 201 })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery overrides POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryEditionAvailable(businessId!)

    const body = await req.json()
    if (!body || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'Solicitud inválida: id es requerido' }, { status: 400 })
    }

    const parsed = overrideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('delivery_schedule_overrides')
      .update({
        city: parsed.data.city,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        delivery_days: parsed.data.delivery_days,
        delivery_window_start: parsed.data.delivery_window_start ?? null,
        delivery_window_end: parsed.data.delivery_window_end ?? null,
        note: parsed.data.note ?? null,
      })
      .eq('id', parsed.data.id)
      .eq('business_id', businessId)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ override: data })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery overrides PATCH error:', error)
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
      .from('delivery_schedule_overrides')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery overrides DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}