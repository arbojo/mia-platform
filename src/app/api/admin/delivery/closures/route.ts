import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { closeRoute } from '@/lib/delivery/closure'

export const runtime = 'nodejs'

const closeSchema = z.object({
  routeId: z.string().uuid(),
  cashCounted: z.number().min(0),
  expenses: z.record(z.string(), z.number().min(0)).optional().default({}),
  notes: z.string().max(2000).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const supabase = createDeliveryAdmin()
    const { data, error } = await supabase
      .from('daily_closures')
      .select('*, drivers(name, sequential_number), routes(route_date)')
      .eq('business_id', businessId)
      .order('closure_date', { ascending: false })
      .limit(100)

    if (error) {
      throw error
    }

    return NextResponse.json({ closures: data ?? [] })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery closures GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    const { userId, businessId: confirmedBusinessId } = await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(confirmedBusinessId)

    const body = await req.json()
    const parsed = closeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createDeliveryAdmin()

    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('id, driver_id, route_date, status')
      .eq('id', parsed.data.routeId)
      .eq('business_id', confirmedBusinessId)
      .maybeSingle()

    if (routeError) {
      throw routeError
    }

    if (!route) {
      throw new DeliveryError('NOT_FOUND', 'Ruta no encontrada', 404)
    }

    if (route.status === 'closed') {
      throw new DeliveryError('WRONG_STATUS', 'La ruta ya está cerrada', 409)
    }

    await closeRoute({
      routeId: route.id,
      businessId: confirmedBusinessId,
      driverId: route.driver_id,
      closureDate: route.route_date,
      cashCounted: parsed.data.cashCounted,
      expenses: parsed.data.expenses,
      notes: parsed.data.notes,
      closedBy: userId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery closures POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
