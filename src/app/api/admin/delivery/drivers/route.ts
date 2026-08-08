import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'

export const runtime = 'nodejs'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(40).nullable().optional(),
  vehicle: z.string().max(100).nullable().optional(),
})

const driverSafeColumns = 'id, business_id, sequential_number, name, phone, vehicle, status, last_lat, last_lng, created_at, updated_at'

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const supabase = createDeliveryAdmin()
    const { data, error } = await supabase
      .from('drivers')
      .select(driverSafeColumns)
      .eq('business_id', businessId)
      .order('sequential_number', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ drivers: data ?? [] })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery drivers GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const body = await req.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createDeliveryAdmin()

    const { data: maxRow } = await supabase
      .from('drivers')
      .select('sequential_number')
      .eq('business_id', businessId)
      .order('sequential_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('drivers')
      .insert({
        business_id: businessId,
        sequential_number: (maxRow?.sequential_number ?? 0) + 1,
        name: parsed.data.name.trim(),
        phone: parsed.data.phone?.trim() || null,
        vehicle: parsed.data.vehicle?.trim() || null,
        status: 'active',
      })
      .select(driverSafeColumns)
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ driver: data }, { status: 201 })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery drivers POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
