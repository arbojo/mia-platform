import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryEditionAvailable } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'

export const runtime = 'nodejs'

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  driver_self_checkout: z.boolean().optional(),
  whatsapp_notify: z.boolean().optional(),
  wa_business_id: z.string().nullable().optional(),
  timezone: z.string().min(1).optional(),
  daily_goal_amount: z.number().min(0).optional(),
  driver_share_percent: z.number().min(0).max(100).optional(),
  gps_radius_meters: z.number().int().min(1).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryEditionAvailable(businessId!)

    const supabase = createDeliveryAdmin()
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({ settings: data ?? null })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryEditionAvailable(businessId!)

    const body = await req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createDeliveryAdmin()
    const patch: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }

    const { data, error } = await supabase
      .from('business_settings')
      .upsert({ business_id: businessId, ...patch })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ settings: data })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery settings PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
