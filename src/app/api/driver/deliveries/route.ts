import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth, getDriverSettings } from '@/lib/delivery/auth'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { applySessionSlide } from '@/lib/delivery/http'
import { getBusinessDate } from '@/lib/delivery/closure'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { driver, slideTo } = await requireDriverAuth(req)
    const supabase = createDeliveryAdmin()

    const settings = await getDriverSettings(driver.business_id)
    const today = getBusinessDate(settings.timezone)

    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('id')
      .eq('business_id', driver.business_id)
      .eq('driver_id', driver.id)
      .eq('route_date', today)
      .maybeSingle()

    if (routeError) {
      throw routeError
    }

    let deliveries: unknown[] = []

    if (route) {
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .eq('route_id', route.id)
        .order('sequence', { ascending: true })

      if (visitsError) {
        throw visitsError
      }

      const visitsArr = visits ?? []
      const orderIds = visitsArr.map((v: { order_id: string }) => v.order_id)

      let ordersById = new Map<string, unknown>()
      if (orderIds.length > 0) {
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, order_number, customer_name, phone, address, city, amount, paid_at_sale, items, status')
          .in('id', orderIds)

        if (ordersError) {
          throw ordersError
        }

        ordersById = new Map((orders ?? []).map((o: { id: string }) => [o.id, o]))
      }

      deliveries = visitsArr.map(
        (visit: { id: string; order_id: string; sequence: number; status: string }) => {
        const order = ordersById.get(visit.order_id) as {
          order_number?: string
          customer_name?: string
          phone?: string
          address?: string
          city?: string
          amount?: number
          paid_at_sale?: boolean
          items?: unknown
        } | null

        return {
          visit_id: visit.id,
          order_id: visit.order_id,
          status: visit.status,
          sequence: visit.sequence,
          order: order
            ? {
                order_number: order.order_number,
                customer_name: order.customer_name,
                phone: order.phone,
                address: order.address,
                city: order.city,
                amount: order.amount,
                paid_at_sale: order.paid_at_sale,
                items: order.items,
              }
            : null,
        }
      })
    }

    const response = NextResponse.json({ route_date: today, deliveries })

    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Driver deliveries error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
