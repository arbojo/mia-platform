import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'

export const runtime = 'nodejs'

const orderColumns =
  'id, order_number, customer_name, phone, address, city, amount, paid_at_sale, items, status, assigned_driver_id, route_id, created_at, source'

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

    const orders = (data ?? []).map((row) => {
      const source = (row as { source?: { product_name?: string | null } }).source
      return {
        id: row.id,
        order_number: row.order_number,
        customer_name: row.customer_name,
        phone: row.phone,
        address: row.address,
        city: row.city,
        amount: row.amount,
        paid_at_sale: row.paid_at_sale,
        items: row.items,
        status: row.status,
        assigned_driver_id: row.assigned_driver_id,
        route_id: row.route_id,
        created_at: row.created_at,
        product_name: source?.product_name ?? null,
      }
    })

    return NextResponse.json({ orders })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery orders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
