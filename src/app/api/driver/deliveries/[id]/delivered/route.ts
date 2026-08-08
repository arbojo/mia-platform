import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth, getDriverSettings } from '@/lib/delivery/auth'
import { applySessionSlide } from '@/lib/delivery/http'
import { applyDelivered } from '@/lib/delivery/actions'
import type { GpsSample } from '@/lib/delivery/gps'
import { toIso } from '@/lib/delivery/request'

export const runtime = 'nodejs'

const KINSHIPS = ['titular', 'familiar', 'vecino', 'recibe_tercero'] as const

type KinshipValue = (typeof KINSHIPS)[number]

function readOptionalFloat(formData: FormData, key: string): number | undefined {
  const value = formData.get(key)
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new DeliveryError('INVALID_INPUT', `${key} inválido`, 400)
  }
  return parsed
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { driver, slideTo } = await requireDriverAuth(req)
    const { id } = await params
    const formData = await req.formData()

    const kinship = formData.get('kinship')
    if (typeof kinship !== 'string' || !KINSHIPS.includes(kinship as KinshipValue)) {
      throw new DeliveryError('INVALID_INPUT', 'Parentesco inválido', 400)
    }

    const amountCollected = readOptionalFloat(formData, 'amount_collected')
    const paymentMethodRaw = formData.get('payment_method')
    const paymentMethod = typeof paymentMethodRaw === 'string' && paymentMethodRaw.trim() !== '' ? paymentMethodRaw : undefined

    const rawSamples = [1, 2].map((i) => {
      const lat = Number(formData.get(`samples_lat${i}`))
      const lng = Number(formData.get(`samples_lng${i}`))
      const capturedAtRaw = formData.get(`samples_captured_at${i}`)
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        typeof capturedAtRaw !== 'string'
      ) {
        throw new DeliveryError('INVALID_INPUT', 'Muestras GPS inválidas', 400)
      }
      return { lat, lng, capturedAt: toIso(capturedAtRaw) }
    }) as [GpsSample, GpsSample]

    const photo = formData.get('photo')
    if (!(photo instanceof File)) {
      throw new DeliveryError('INVALID_INPUT', 'La foto de evidencia es obligatoria', 400)
    }

    const photoBuffer = Buffer.from(await photo.arrayBuffer())

    const settings = await getDriverSettings(driver.business_id)

    const result = await applyDelivered(
      { businessId: driver.business_id, driverId: driver.id, visitId: id },
      {
        samples: rawSamples,
        radiusMeters: settings.gps_radius_meters,
        kinship: kinship as KinshipValue,
        amountCollected,
        paymentMethod,
        photo: photoBuffer,
        capturedAt: rawSamples[1].capturedAt,
      }
    )

    const response = NextResponse.json({
      ok: true,
      delivered: {
        visit_id: result.visit.id,
        order_number: result.order?.order_number,
        photo_url: result.photoUrl,
      },
    })

    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivered error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
