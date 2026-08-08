import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { createMagicLinkRecord, storeMagicLink, MAGIC_TOKEN_TTL_MS } from '@/lib/delivery/token'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const { id } = await params
    const supabase = createDeliveryAdmin()

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle()

    if (driverError) {
      throw driverError
    }

    if (!driver) {
      throw new DeliveryError('NOT_FOUND', 'Repartidor no encontrado', 404)
    }

    const record = createMagicLinkRecord()
    await storeMagicLink(driver.id, record)

    const origin = req.nextUrl.origin
    const link = `${origin}/driver/login?t=${encodeURIComponent(record.token)}&d=${encodeURIComponent(driver.id)}`

    return NextResponse.json({
      link,
      expires_at: record.expiresAt,
      ttl_ms: MAGIC_TOKEN_TTL_MS,
    })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery driver token error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
