import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { revokeSession, SESSION_COOKIE } from '@/lib/delivery/token'
import { clearSessionCookie } from '@/lib/delivery/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const cookieValue = req.cookies.get(SESSION_COOKIE)?.value
    if (cookieValue) {
      await revokeSession(cookieValue)
    }

    const response = NextResponse.json({ ok: true })
    return clearSessionCookie(response)
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Driver logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
