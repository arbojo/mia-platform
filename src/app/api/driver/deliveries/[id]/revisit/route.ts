import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth } from '@/lib/delivery/auth'
import { applySessionSlide } from '@/lib/delivery/http'
import { scheduleRevisit } from '@/lib/delivery/actions'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { driver, slideTo } = await requireDriverAuth(req)
    const { id } = await params

    const revisit = await scheduleRevisit({
      ctx: { businessId: driver.business_id, driverId: driver.id, visitId: id },
      originalVisitId: id,
    })

    const response = NextResponse.json({ ok: true, revisit_id: revisit.id })

    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Revisit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
