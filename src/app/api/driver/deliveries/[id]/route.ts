import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth } from '@/lib/delivery/auth'
import { applySessionSlide } from '@/lib/delivery/http'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { getSignedEvidenceUrl } from '@/lib/delivery/evidence'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { driver, slideTo } = await requireDriverAuth(req)
    const { id } = await params
    const supabase = createDeliveryAdmin()

    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .select('*')
      .eq('id', id)
      .eq('business_id', driver.business_id)
      .eq('driver_id', driver.id)
      .maybeSingle()

    if (visitError) {
      throw visitError
    }

    if (!visit) {
      throw new DeliveryError('NOT_FOUND', 'Visita no encontrada', 404)
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, phone, address, city, amount, paid_at_sale, items')
      .eq('id', visit.order_id)
      .eq('business_id', driver.business_id)
      .maybeSingle()

    let evidence_url: string | null = null
    if (visit.photo_url) {
      evidence_url = await getSignedEvidenceUrl(visit.photo_url)
    }

    const response = NextResponse.json({
      visit: {
        id: visit.id,
        status: visit.status,
        incident_type: visit.incident_type,
        incident_notes: visit.incident_notes,
        received_by_kinship: visit.received_by_kinship,
        amount_collected: visit.amount_collected,
        payment_method: visit.payment_method,
        revisit_of: visit.revisit_of,
        delivered_at: visit.delivered_at,
      },
      order,
      evidence_url,
    })

    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
