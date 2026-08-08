import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDriverAuth } from '@/lib/delivery/auth'
import { applySessionSlide } from '@/lib/delivery/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { slideTo } = await requireDriverAuth(req)

    const response = NextResponse.json({ ok: true })
    return applySessionSlide(response, slideTo)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Driver refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
