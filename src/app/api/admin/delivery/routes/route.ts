import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { assertNoPendingClosure } from '@/lib/delivery/closure'

export const runtime = 'nodejs'

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

interface RouteRow {
  id: string
  route_date: string
  status: string
  driver_id: string | null
  drivers: { name: string; sequential_number: number } | null
  visits_count?: number
  delivered_count?: number
  collected_total?: number
}

const schema = z.object({
  driverId: z.string().uuid(),
  routeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  orderIds: z.array(z.string().uuid()).min(1).max(200),
  customerCoords: z.record(z.string().uuid(), coordsSchema).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const includeStats = new URL(req.url).searchParams.get('include_stats') === 'true'

    const supabase = createDeliveryAdmin()
    const { data, error } = await supabase
      .from('routes')
      .select('id, route_date, status, driver_id, drivers(name, sequential_number)')
      .eq('business_id', businessId)
      .order('route_date', { ascending: false })
      .limit(100)

    if (error) {
      throw error
    }

    let routes = (data ?? []) as unknown as RouteRow[]

    if (includeStats) {
      const routeIds = routes.map((r) => r.id)
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select('route_id, status, amount_collected')
        .in('route_id', routeIds.length > 0 ? routeIds : ['00000000-0000-0000-0000-000000000000'])

      if (visitsError) {
        throw visitsError
      }

      const stats = new Map<string, { visits: number; delivered: number; collected: number }>()
      for (const visit of visits ?? []) {
        const entry = stats.get(visit.route_id) ?? { visits: 0, delivered: 0, collected: 0 }
        entry.visits += 1
        if (visit.status === 'entregado') {
          entry.delivered += 1
          entry.collected += visit.amount_collected ?? 0
        }
        stats.set(visit.route_id, entry)
      }

      routes = routes.map((route) => {
        const s = stats.get(route.id)
        return {
          ...route,
          visits_count: s?.visits ?? 0,
          delivered_count: s?.delivered ?? 0,
          collected_total: s?.collected ?? 0,
        }
      })
    }

    return NextResponse.json({ routes })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery routes GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createDeliveryAdmin()

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('id', parsed.data.driverId)
      .eq('business_id', businessId)
      .maybeSingle()

    if (!driver) {
      throw new DeliveryError('NOT_FOUND', 'Repartidor no encontrado', 404)
    }

    await assertNoPendingClosure({
      driverId: parsed.data.driverId,
      routeDate: parsed.data.routeDate,
    })

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'pending_assignment')
      .in('id', parsed.data.orderIds)

    if (ordersError) {
      throw ordersError
    }

    if (!orders || orders.length !== parsed.data.orderIds.length) {
      throw new DeliveryError('CONFLICT', 'Algunos pedidos ya fueron asignados', 409)
    }

    const { data: route, error: routeError } = await supabase
      .from('routes')
      .insert({
        business_id: businessId,
        driver_id: parsed.data.driverId,
        route_date: parsed.data.routeDate,
        status: 'active',
      })
      .select('id')
      .single()

    if (routeError) {
      if (routeError.message.includes('cierre_diario_pendiente')) {
        throw new DeliveryError('CLOSURE_PENDING', 'El repartidor tiene un cierre diario pendiente', 409)
      }
      throw routeError
    }

    const now = new Date().toISOString()

    for (const [index, orderId] of parsed.data.orderIds.entries()) {
      await supabase
        .from('orders')
        .update({
          assigned_driver_id: parsed.data.driverId,
          route_id: route.id,
          status: 'assigned',
          assigned_at: now,
        })
        .eq('id', orderId)
        .eq('business_id', businessId)

      const coords = parsed.data.customerCoords?.[orderId]

      await supabase.from('visits').insert({
        business_id: businessId,
        route_id: route.id,
        order_id: orderId,
        driver_id: parsed.data.driverId,
        sequence: index + 1,
        status: 'pendiente',
        customer_lat: coords?.lat ?? null,
        customer_lng: coords?.lng ?? null,
      })
    }

    return NextResponse.json({ route_id: route.id }, { status: 201 })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery routes POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
