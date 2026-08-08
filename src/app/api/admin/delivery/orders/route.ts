import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'

export const runtime = 'nodejs'

const orderColumns =
  'id, order_number, customer_name, phone, address, city, amount, paid_at_sale, items, status, assigned_driver_id, route_id, created_at'

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const status = new URL(req.url).searchParams.get('status') ?? 'pending_assignment'

    const supabase = createDeliveryAdmin()
    const { data, error } = await supabase
      .from('orders')
      .select(orderColumns)
      .eq('business_id', businessId)
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(500)

    if (error) {
      throw error
    }

    return NextResponse.json({ orders: data ?? [] })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery orders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
