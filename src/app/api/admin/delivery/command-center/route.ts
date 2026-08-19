import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { getBusinessDate } from '@/lib/delivery/closure'
import { getDriverSettings } from '@/lib/delivery/auth'

export const runtime = 'nodejs'

interface VisitWithOrder {
  route_id: string
  order_id: string
  status: string
  sequence: number
  orders: {
    order_number: string
    customer_name: string
    address: string | null
    amount: number | null
    product_id: string | null
  } | null
}

interface DeliveredOrder {
  id: string
  amount: number | null
  product_id: string | null
  products: {
    name: string
    price: number | null
    cost: number | null
  } | null
}

function buildDayBounds(businessDate: string): { start: string; end: string } {
  const start = new Date(`${businessDate}T00:00:00Z`).toISOString()
  const end = new Date(`${businessDate}T23:59:59.999Z`).toISOString()
  return { start, end }
}

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const supabase = createDeliveryAdmin()
    const settings = await getDriverSettings(businessId!)
    const businessDate = getBusinessDate(settings.timezone)
    const dayBounds = buildDayBounds(businessDate)

    const [
      { data: activeDrivers },
      { data: activeRoutes },
      { data: todayDeliveredOrders },
      { data: todayClosures },
    ] = await Promise.all([
      supabase
        .from('drivers')
        .select('id, name, vehicle, status, last_lat, last_lng, last_gps_at')
        .eq('business_id', businessId!)
        .in('status', ['active', 'busy'])
        .order('sequential_number', { ascending: true }),

      supabase
        .from('routes')
        .select('id, driver_id, status')
        .eq('business_id', businessId!)
        .eq('status', 'active'),

      supabase
        .from('orders')
        .select('id, amount, product_id, products(name, price, cost)')
        .eq('business_id', businessId!)
        .eq('status', 'delivered')
        .gte('delivered_at', dayBounds.start)
        .lte('delivered_at', dayBounds.end),

      supabase
        .from('daily_closures')
        .select('total_collected, delivered_count, incidence_count')
        .eq('business_id', businessId!)
        .eq('closure_date', businessDate),
    ])

    const activeRouteIds = new Set((activeRoutes ?? []).map((r) => r.id))
    const driverRouteMap = new Map((activeRoutes ?? []).map((r) => [r.driver_id, r]))

    const activeRouteDrivers = (activeDrivers ?? []).filter((d) =>
      driverRouteMap.has(d.id)
    )

    let visitsForRoutes: VisitWithOrder[] = []
    if (activeRouteIds.size > 0) {
      const { data: visits } = await supabase
        .from('visits')
        .select('route_id, order_id, status, sequence, orders(order_number, customer_name, address, amount, product_id)')
        .in('route_id', Array.from(activeRouteIds))
        .order('sequence', { ascending: true })

      visitsForRoutes = (visits ?? []) as unknown as VisitWithOrder[]
    }

    const visitsByRoute = new Map<string, VisitWithOrder[]>()
    for (const visit of visitsForRoutes) {
      const list = visitsByRoute.get(visit.route_id) ?? []
      list.push(visit)
      visitsByRoute.set(visit.route_id, list)
    }

    const driversWithRoute = activeRouteDrivers.map((driver) => {
      const route = driverRouteMap.get(driver.id)
      const routeVisits = visitsByRoute.get(route?.id ?? '') ?? []
      const currentVisit =
        routeVisits.find(
          (v) => v.status === 'en_camino' || v.status === 'en_ubicacion'
        ) ?? null

      const delivered = routeVisits.filter((v) => v.status === 'entregado').length
      const incidents = routeVisits.filter((v) => v.status === 'incidencia').length
      const collected = routeVisits
        .filter((v) => v.status === 'entregado')
        .reduce((sum, v) => sum + (v.orders?.amount ?? 0), 0)

      return {
        id: driver.id,
        name: driver.name,
        vehicle: driver.vehicle,
        status: driver.status,
        last_lat: driver.last_lat,
        last_lng: driver.last_lng,
        last_gps_at: driver.last_gps_at,
        route_id: route?.id ?? null,
        route_status: route?.status ?? null,
        current_visit: currentVisit
          ? {
              order_number: currentVisit.orders?.order_number ?? '—',
              customer_name: currentVisit.orders?.customer_name ?? '—',
              address: currentVisit.orders?.address ?? null,
              status: currentVisit.status,
            }
          : null,
        today_stats: {
          delivered,
          incidents,
          total_orders: routeVisits.length,
          collected: Math.round(collected * 100) / 100,
        },
        route_visits: routeVisits.map((v) => ({
          order_number: v.orders?.order_number ?? '—',
          customer_name: v.orders?.customer_name ?? '—',
          address: v.orders?.address ?? null,
          status: v.status,
          amount: v.orders?.amount ?? null,
          sequence: v.sequence,
        })),
      }
    })

    const allDrivers = (activeDrivers ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      vehicle: d.vehicle,
      status: d.status,
      last_lat: d.last_lat,
      last_lng: d.last_lng,
      last_gps_at: d.last_gps_at,
    }))

    const deliveredOrders = (todayDeliveredOrders ?? []) as unknown as DeliveredOrder[]
    const totalCollected = deliveredOrders.reduce(
      (sum, o) => sum + (o.amount ?? 0),
      0
    )

    const productsWithoutCost: Array<{
      order_id: string
      product_name: string
      amount: number
    }> = []
    let totalMargin = 0

    for (const order of deliveredOrders) {
      const amount = order.amount ?? 0
      const cost = order.products?.cost

      if (cost != null) {
        const commission = amount * settings.driver_share_percent / 100
        totalMargin += amount - cost - commission
      } else {
        productsWithoutCost.push({
          order_id: order.id,
          product_name: order.products?.name ?? 'Sin nombre',
          amount,
        })
      }
    }

    totalMargin = Math.round(totalMargin * 100) / 100
    const marginPercent =
      totalCollected > 0
        ? Math.round((totalMargin / totalCollected) * 1000) / 10
        : 0

    const closureStats = (todayClosures ?? []).reduce(
      (acc, c) => ({
        collected: acc.collected + (c.total_collected ?? 0),
        delivered: acc.delivered + (c.delivered_count ?? 0),
        incidents: acc.incidents + (c.incidence_count ?? 0),
      }),
      { collected: 0, delivered: 0, incidents: 0 }
    )

    const ordersInActiveRoutes = visitsForRoutes.filter(
      (v) =>
        activeRouteIds.has(v.route_id) &&
        v.status !== 'entregado' &&
        v.status !== 'incidencia'
    )
    const circulationUnits = ordersInActiveRoutes.length
    const circulationValue = ordersInActiveRoutes.reduce(
      (sum, v) => sum + (v.orders?.amount ?? 0),
      0
    )

    const dailyGoal = settings.daily_goal_amount
    const goalProgress =
      dailyGoal > 0 ? Math.round((totalCollected / dailyGoal) * 1000) / 1000 : 0

    return NextResponse.json({
      drivers: allDrivers,
      drivers_with_route: driversWithRoute,
      financials: {
        daily_goal: dailyGoal,
        total_collected: Math.round(totalCollected * 100) / 100,
        goal_progress: goalProgress,
        total_margin: totalMargin,
        margin_percent: marginPercent,
        products_without_cost_count: productsWithoutCost.length,
        products_without_cost: productsWithoutCost,
      },
      circulation: {
        total_units: circulationUnits,
        orders_in_active_routes: circulationUnits,
        total_value: Math.round(circulationValue * 100) / 100,
      },
      today_summary: {
        delivered: closureStats.delivered,
        incidents: closureStats.incidents,
        closures: (todayClosures ?? []).length,
      },
      business_date: businessDate,
      timezone: settings.timezone,
    })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }
    console.error('Delivery command-center error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
