import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconnectBridgeSession, isWhatsAppBridgeEnabled, BridgeClientError } from '@/lib/baileys/bridge'

async function assertOwnership(userId: string, businessId: string) {
  const supabase = createAdminClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', userId)
    .maybeSingle()

  return business !== null
}

export async function POST(request: Request) {
  try {
    if (!isWhatsAppBridgeEnabled()) {
      return NextResponse.json(
        { error: 'WhatsApp bridge is not configured. Set WHATSAPP_BRIDGE_URL and WHATSAPP_BRIDGE_SECRET.' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { businessId?: string }
    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const owns = await assertOwnership(user.id, body.businessId)
    if (!owns) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const status = await reconnectBridgeSession(body.businessId)

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('channel_connections')
      .select('id')
      .eq('business_id', body.businessId)
      .eq('channel', 'whatsapp')
      .maybeSingle()

    if (existing) {
      await admin
        .from('channel_connections')
        .update({ status: status.status, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      const { data: assistant } = await admin
        .from('assistants')
        .select('id')
        .eq('business_id', body.businessId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (assistant) {
        await admin.from('channel_connections').insert({
          business_id: body.businessId,
          assistant_id: assistant.id,
          channel: 'whatsapp',
          status: status.status,
          credentials: { transport: 'baileys' },
          configuration: {},
        })
      }
    }

    return NextResponse.json({ success: true, status: status.status, phone: status.phone })
  } catch (error) {
    if (error instanceof BridgeClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Baileys reconnect POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
