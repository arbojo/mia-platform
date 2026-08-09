import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth, getDriverSettings } from '@/lib/delivery/auth'
import { applySessionSlide } from '@/lib/delivery/http'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { applyEnRoute, applyArrived, applyIncident } from '@/lib/delivery/actions'
import { requireGpsSamples } from '@/lib/delivery/request'

export const runtime = 'nodejs'

const INCIDENT_TYPES = [
  'domicilio_incorrecto',
  'no_se_encuentra',
  'rechazado',
  'zona_inaccesible',
  'cliente_ausente',
  'otro',
] as const

const syncItemSchema = z.object({
  idempotencyKey: z.string().min(8),
  eventType: z.enum([
    'voy_en_camino',
    'ya_estoy_aqui',
    'incidencia_reportada',
    'check_in',
    'sync_batch',
  ]),
  visitId: z.string().uuid(),
  orderId: z.string().uuid().nullable().optional(),
  samples: z.unknown().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

const schema = z.object({
  items: z.array(syncItemSchema).max(50),
})

type SyncResult =
  | { status: 'ok' }
  | { status: 'deduplicated' }
  | { status: 'error'; error: string; code: string }

export async function POST(req: NextRequest) {
  try {
    const { driver, slideTo } = await requireDriverAuth(req)
    const supabase = createDeliveryAdmin()
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const settings = await getDriverSettings(driver.business_id)
    const results: Array<{ idempotencyKey: string } & SyncResult> = []

    for (const item of parsed.data.items) {
      const { data: existing } = await supabase
        .from('driver_events')
        .select('id')
        .eq('idempotency_key', item.idempotencyKey)
        .maybeSingle()

      if (existing) {
        results.push({ idempotencyKey: item.idempotencyKey, status: 'deduplicated' })
        continue
      }

      try {
        const samples = item.samples ? requireGpsSamples(item.samples) : undefined
        const ctx = {
          businessId: driver.business_id,
          driverId: driver.id,
          visitId: item.visitId,
        }

        if (item.eventType === 'voy_en_camino' && samples) {
          await applyEnRoute(ctx, { samples, driverName: driver.name, radiusMeters: settings.gps_radius_meters })
        } else if (item.eventType === 'ya_estoy_aqui' && samples) {
          await applyArrived(ctx, { samples, driverName: driver.name, radiusMeters: settings.gps_radius_meters })
        } else if (item.eventType === 'incidencia_reportada') {
          const incidentType = item.payload?.incident_type
          if (typeof incidentType !== 'string' || !INCIDENT_TYPES.includes(incidentType as (typeof INCIDENT_TYPES)[number])) {
            throw new DeliveryError('INVALID_INPUT', 'Tipo de incidencia inválido', 400)
          }
          await applyIncident(ctx, {
            incidentType: incidentType as (typeof INCIDENT_TYPES)[number],
            notes: typeof item.payload?.notes === 'string' ? item.payload.notes : undefined,
            scheduleRevisit: item.payload?.schedule_revisit === true,
            samples,
          })
        } else {
          const latest = samples?.[1]
          await supabase.from('driver_events').insert({
            business_id: driver.business_id,
            driver_id: driver.id,
            visit_id: item.visitId,
            order_id: item.orderId ?? null,
            event_type: item.eventType,
            lat: latest?.lat ?? null,
            lng: latest?.lng ?? null,
            captured_at: latest?.capturedAt ?? new Date().toISOString(),
            payload: item.payload ?? {},
            idempotency_key: item.idempotencyKey,
          })
        }

        results.push({ idempotencyKey: item.idempotencyKey, status: 'ok' })
      } catch (error) {
        const deliveryError = error instanceof DeliveryError ? error : null
        results.push({
          idempotencyKey: item.idempotencyKey,
          status: 'error',
          code: deliveryError?.code ?? 'UNKNOWN',
          error: deliveryError?.message ?? 'Error desconocido',
        })
      }
    }

    const response = NextResponse.json({ results })
    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Driver sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
