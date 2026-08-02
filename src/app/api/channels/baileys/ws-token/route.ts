import { NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBridgeSecret, getBridgeUrl } from '@/lib/baileys/config'

function signSessionToken(secret: string, businessId: string): string {
  return createHmac('sha256', secret).update(businessId).digest('base64url')
}

/**
 * Issues a short-lived signed token so the dashboard can open a WebSocket
 * to the WhatsApp bridge for live QR/status events.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const url = new URL(request.url)
    const businessId = url.searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: business } = await admin
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const token = signSessionToken(getBridgeSecret(), businessId)

    return NextResponse.json({
      success: true,
      token,
      wsUrl: `${getBridgeUrl().replace(/^http/, 'ws')}/v1/ws`,
      businessId,
    })
  } catch (error) {
    console.error('Baileys ws-token error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
