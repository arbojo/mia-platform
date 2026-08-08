import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import {
  buildSessionCookie,
  consumeMagicLink,
  createSession,
  verifyMagicLink,
} from '@/lib/delivery/token'
import { setSessionCookie } from '@/lib/delivery/http'

export const runtime = 'nodejs'

const loginSchema = z.object({
  driverId: z.string().uuid(),
  token: z.string().min(20),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const driver = await verifyMagicLink(parsed.data.driverId, parsed.data.token)

    await consumeMagicLink(driver.id)

    const { sessionToken } = await createSession(driver.id, driver.business_id)
    const cookieValue = buildSessionCookie(driver.id, driver.business_id, sessionToken)

    const response = NextResponse.json({
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicle: driver.vehicle,
      },
    })

    return setSessionCookie(response, cookieValue)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Driver auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
