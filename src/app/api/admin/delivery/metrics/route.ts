import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { getBusinessDate } from '@/lib/delivery/closure'
import { getDriverSettings } from '@/lib/delivery/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const supabase = createDeliveryAdmin()
    const settings = await getDriverSettings(businessId!)
    const businessDate = getBusinessDate(settings.timezone)
    const dayStart = `${businessDate}T00:00:00Z`
    const dayEnd = `${businessDate}T23:59:59.999Z`

    const [
      { data: allOrders },
      { data: todayDeliveredOrders },
      { data: drivers },
      { data: allRoutes },
      { data: todayClosures },
      { data: activeRoutes },
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status', { count: 'exact' })
        .eq('business_id', businessId),
      supabase
        .from('orders')
        .select('amount')
        .eq('business_id', businessId)
        .eq('status', 'delivered')
        .gte('delivered_at', dayStart)
        .lte('delivered_at', dayEnd),
      supabase
        .from('drivers')
        .select('id, status')
        .eq('business_id', businessId),
      supabase
        .from('routes')
        .select('id, status')
        .eq('business_id', businessId),
      supabase
        .from('daily_closures')
        .select('id, total_collected')
        .eq('business_id', businessId)
        .eq('closure_date', businessDate),
      supabase
        .from('routes')
        .select('id, driver_id')
        .eq('business_id', businessId)
        .eq('status', 'active'),
    ])

    const activeDriverIds = new Set((activeRoutes ?? []).map((r) => r.driver_id))
    const totalCollected = (todayDeliveredOrders ?? []).reduce(
      (acc, order) => acc + (order.amount ?? 0),
      0
    )

    return NextResponse.json({
      metrics: {
        total_orders: allOrders?.length ?? 0,
        active_drivers: drivers?.length ?? 0,
        total_routes: allRoutes?.length ?? 0,
        total_closures: (todayClosures ?? []).length,
        total_collected: Math.round(totalCollected * 100) / 100,
        today_orders: (todayDeliveredOrders ?? []).length,
        today_delivered: (todayDeliveredOrders ?? []).length,
        today_collected: Math.round(totalCollected * 100) / 100,
        active_route_drivers: activeDriverIds.size,
      },
    })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }
    console.error('Delivery metrics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
