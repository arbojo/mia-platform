import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth } from '@/lib/delivery/auth'
import { applySessionSlide } from '@/lib/delivery/http'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { closeRoute, getBusinessDate } from '@/lib/delivery/closure'

export const runtime = 'nodejs'

const schema = z.object({
  routeId: z.string().uuid(),
  cashCounted: z.number().min(0),
  expenses: z.record(z.string(), z.number().min(0)).optional().default({}),
  notes: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { driver, slideTo } = await requireDriverAuth(req)
    const supabase = createDeliveryAdmin()
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('id, route_date, status')
      .eq('id', parsed.data.routeId)
      .eq('business_id', driver.business_id)
      .eq('driver_id', driver.id)
      .maybeSingle()

    if (routeError) {
      throw routeError
    }

    if (!route) {
      throw new DeliveryError('FORBIDDEN', 'La ruta no pertenece a este repartidor', 403)
    }

    const { data: settings, error: settingsError } = await supabase
      .from('business_settings')
      .select('driver_self_checkout, timezone')
      .eq('business_id', driver.business_id)
      .maybeSingle()

    if (settingsError) {
      throw settingsError
    }

    if (!settings?.driver_self_checkout) {
      throw new DeliveryError('FORBIDDEN', 'El cierre diario debe realizarlo el administrador', 403)
    }

    if (route.route_date !== getBusinessDate(settings.timezone ?? 'UTC')) {
      throw new DeliveryError('WRONG_STATUS', 'Solo se puede cerrar la ruta de hoy', 409)
    }

    await closeRoute({
      routeId: route.id,
      businessId: driver.business_id,
      driverId: driver.id,
      closureDate: route.route_date,
      cashCounted: parsed.data.cashCounted,
      expenses: parsed.data.expenses,
      notes: parsed.data.notes,
      closedBy: null,
    })

    const response = NextResponse.json({ ok: true })

    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Driver checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
