import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const supabase = createDeliveryAdmin()

    const [{ data: orders }, { data: drivers }, { data: routes }, { data: closures }] =
      await Promise.all([
        supabase
          .from('orders')
          .select('status', { count: 'exact', head: true })
          .eq('business_id', businessId),
        supabase
          .from('drivers')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId),
        supabase
          .from('routes')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId),
        supabase
          .from('daily_closures')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId),
      ])

    const totalOrders = orders?.length ?? 0
    const totalCollected = await sumDeliveredAmount(supabase, businessId!)

    return NextResponse.json({
      metrics: {
        total_orders: totalOrders,
        active_drivers: drivers?.length ?? 0,
        total_routes: routes?.length ?? 0,
        total_closures: closures?.length ?? 0,
        total_collected: totalCollected,
      },
    })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery metrics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function sumDeliveredAmount(
  supabase: ReturnType<typeof createDeliveryAdmin>,
  businessId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('orders')
    .select('amount')
    .eq('business_id', businessId)
    .eq('status', 'delivered')

  if (error) {
    throw error
  }

  return (data ?? []).reduce((acc, order) => acc + (order.amount ?? 0), 0)
}
