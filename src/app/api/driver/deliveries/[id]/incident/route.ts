import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth } from '@/lib/delivery/auth'
import { applySessionSlide } from '@/lib/delivery/http'
import { requireGpsSamples } from '@/lib/delivery/request'
import { applyIncident } from '@/lib/delivery/actions'

export const runtime = 'nodejs'

const incidentTypes = [
  'domicilio_incorrecto',
  'no_se_encuentra',
  'rechazado',
  'zona_inaccesible',
  'cliente_ausente',
  'otro',
] as const

const schema = z.object({
  incidentType: z.enum(incidentTypes),
  notes: z.string().max(1000).optional(),
  scheduleRevisit: z.boolean().optional().default(false),
  samples: z.unknown().optional(),
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

    const samples = parsed.data.samples
      ? requireGpsSamples(parsed.data.samples)
      : undefined

    await applyIncident(
      { businessId: driver.business_id, driverId: driver.id, visitId: id },
      {
        incidentType: parsed.data.incidentType,
        notes: parsed.data.notes,
        scheduleRevisit: parsed.data.scheduleRevisit,
        samples,
      }
    )

    const response = NextResponse.json({ ok: true })
    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Incident error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
