import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const { id } = await params
    const supabase = createDeliveryAdmin()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle()

    if (orderError) {
      throw orderError
    }

    if (!order) {
      throw new DeliveryError('NOT_FOUND', 'Pedido no encontrado', 404)
    }

    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw new DeliveryError('WRONG_STATUS', 'El pedido ya fue entregado o cancelado', 409)
    }

    const now = new Date().toISOString()

    await supabase
      .from('orders')
      .update({ status: 'cancelled', cancelled_at: now })
      .eq('id', id)
      .eq('business_id', businessId)

    await supabase
      .from('visits')
      .update({ status: 'incidencia', incident_type: 'otro', incident_notes: 'Pedido cancelado por administrador', updated_at: now })
      .eq('order_id', id)
      .eq('business_id', businessId)
      .in('status', ['pendiente', 'en_camino'])

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery order cancel error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
