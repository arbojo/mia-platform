import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'

export const runtime = 'nodejs'

const schema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(200),
  customerCoords: z
    .record(
      z.string().uuid(),
      z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    )
    .optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createDeliveryAdmin()

    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('id, driver_id, status')
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle()

    if (routeError) {
      throw routeError
    }

    if (!route) {
      throw new DeliveryError('NOT_FOUND', 'Ruta no encontrada', 404)
    }

    if (route.status === 'closed') {
      throw new DeliveryError('WRONG_STATUS', 'No se puede asignar a una ruta cerrada', 409)
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'pending_assignment')
      .in('id', parsed.data.orderIds)

    if (!orders || orders.length !== parsed.data.orderIds.length) {
      throw new DeliveryError('CONFLICT', 'Algunos pedidos ya fueron asignados', 409)
    }

    const { data: maxVisit } = await supabase
      .from('visits')
      .select('sequence')
      .eq('route_id', id)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date().toISOString()
    let sequence = maxVisit?.sequence ?? 0

    for (const orderId of parsed.data.orderIds) {
      sequence += 1

      await supabase
        .from('orders')
        .update({
          assigned_driver_id: route.driver_id,
          route_id: id,
          status: 'assigned',
          assigned_at: now,
        })
        .eq('id', orderId)
        .eq('business_id', businessId)

      const coords = parsed.data.customerCoords?.[orderId]

      await supabase.from('visits').insert({
        business_id: businessId,
        route_id: id,
        order_id: orderId,
        driver_id: route.driver_id,
        sequence,
        status: 'pendiente',
        customer_lat: coords?.lat ?? null,
        customer_lng: coords?.lng ?? null,
      })
    }

    return NextResponse.json({ assigned: parsed.data.orderIds.length })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery routes assign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
