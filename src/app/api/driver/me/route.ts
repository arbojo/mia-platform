import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth, getDriverSettings } from '@/lib/delivery/auth'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { applySessionSlide } from '@/lib/delivery/http'
import { getBusinessDate, getRouteVisits, computeClosureStats } from '@/lib/delivery/closure'
import { computeIncentives } from '@/lib/delivery/incentives'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { driver, slideTo } = await requireDriverAuth(req)
    const supabase = createDeliveryAdmin()

    const settings = await getDriverSettings(driver.business_id)
    const today = getBusinessDate(settings.timezone ?? 'UTC')

    const { data: todayRoute, error: routeError } = await supabase
      .from('routes')
      .select('*')
      .eq('business_id', driver.business_id)
      .eq('driver_id', driver.id)
      .eq('route_date', today)
      .maybeSingle()

    if (routeError) {
      throw routeError
    }

    const { data: openClosure, error: closureError } = await supabase
      .from('routes')
      .select('id, route_date')
      .eq('business_id', driver.business_id)
      .eq('driver_id', driver.id)
      .lt('route_date', today)
      .neq('status', 'closed')
      .limit(1)
      .maybeSingle()

    if (closureError) {
      throw closureError
    }

    let todayStats = null
    let incentives = null
    let route = null

    if (todayRoute) {
      route = todayRoute
      const visits = await getRouteVisits(todayRoute.id)
      todayStats = computeClosureStats(visits)
      incentives = computeIncentives(settings, todayStats)
    }

    const response = NextResponse.json({
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicle: driver.vehicle,
      },
      settings: {
        daily_goal_amount: settings.daily_goal_amount,
        driver_share_percent: settings.driver_share_percent,
      },
      route: route
        ? {
            id: route.id,
            route_date: route.route_date,
            status: route.status,
          }
        : null,
      today: todayStats,
      incentives,
      closure_pending: Boolean(openClosure),
    })

    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Driver me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
