import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth, getDriverSettings } from '@/lib/delivery/auth'
import { applySessionSlide } from '@/lib/delivery/http'
import { requireGpsSamples } from '@/lib/delivery/request'
import { applyEnRoute } from '@/lib/delivery/actions'

export const runtime = 'nodejs'

const schema = z.object({
  samples: z.unknown(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { driver, slideTo } = await requireDriverAuth(req)
    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const samples = requireGpsSamples(parsed.data.samples)
    const settings = await getDriverSettings(driver.business_id)

    await applyEnRoute(
      { businessId: driver.business_id, driverId: driver.id, visitId: id },
      { samples, driverName: driver.name, radiusMeters: settings.gps_radius_meters }
    )

    const response = NextResponse.json({ ok: true })
    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('En route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
