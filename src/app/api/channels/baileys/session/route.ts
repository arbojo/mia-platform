import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canBusinessUseWhatsApp } from '@/lib/system/edition'
import {
  startBridgeSession,
  getBridgeSessionStatus,
  logoutBridgeSession,
  isWhatsAppBridgeEnabled,
  BridgeClientError,
} from '@/lib/baileys/bridge'
import { getBridgeUrl } from '@/lib/baileys/config'
import type { ChannelMode } from '@/lib/channels/types'

async function assertOwnership(userId: string, businessId: string) {
  const supabase = createAdminClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (!business) {
    return false
  }
  return true
}

/**
 * WhatsApp connections are created in `shadow` by default.
 *
 * A freshly linked number must never start replying to real customers without
 * an explicit human decision. Promoting to `active` is a deliberate action.
 */
const DEFAULT_WHATSAPP_MODE: ChannelMode = 'shadow'

function asChannelMode(value: unknown): ChannelMode {
  return value === 'active' || value === 'paused' || value === 'shadow' ? value : DEFAULT_WHATSAPP_MODE
}

async function findOrCreateConnection(
  businessId: string,
  assistantId: string,
  mode: ChannelMode
): Promise<{ id: string; status: string } | null> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('channel_connections')
    .select('id, status')
    .eq('business_id', businessId)
    .eq('channel', 'whatsapp')
    .maybeSingle()

  if (existing) {
    return existing
  }

  const { data, error } = await supabase
    .from('channel_connections')
    .insert({
      business_id: businessId,
      assistant_id: assistantId,
      channel: 'whatsapp',
      status: 'disconnected',
      mode,
      credentials: { transport: 'baileys' },
      configuration: {},
    })
    .select('id, status')
    .single()

  if (error) {
    console.error('Failed to create channel_connection:', error)
    return null
  }

  return data
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

    const body = (await request.json()) as { businessId?: string; assistantId?: string }
    if (!body.businessId || !body.assistantId) {
      return NextResponse.json({ error: 'businessId and assistantId are required' }, { status: 400 })
    }

    const owns = await assertOwnership(user.id, body.businessId)
    if (!owns) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!(await canBusinessUseWhatsApp(body.businessId))) {
      return NextResponse.json(
        { error: 'WhatsApp is not available for this business edition' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    const { data: existingConnection } = await admin
      .from('channel_connections')
      .select('id, mode')
      .eq('business_id', body.businessId)
      .eq('channel', 'whatsapp')
      .maybeSingle()

    // Reconnecting deletes the session and the connection row, then recreates
    // them below. The mode must survive that round trip: a `shadow` channel
    // that silently came back as `active` would start answering real customers
    // the moment the socket stabilised.
    const previousMode = asChannelMode(existingConnection?.mode)

    if (existingConnection) {
      await logoutBridgeSession(body.businessId).catch(() => {})
      await admin.from('whatsapp_sessions').delete().eq('business_id', body.businessId)
      await admin.from('channel_connections').delete().eq('id', existingConnection.id)
    }

    const connection = await findOrCreateConnection(body.businessId, body.assistantId, previousMode)
    if (!connection) {
      return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
    }

    const status = await startBridgeSession(body.businessId)

    if (connection.status !== status.status) {
      await supabase
        .from('channel_connections')
        .update({ status: status.status, updated_at: new Date().toISOString() })
        .eq('id', connection.id)
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      status: status.status,
      bridgeUrl: getBridgeUrl(),
    })
  } catch (error) {
    if (error instanceof BridgeClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Baileys session POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

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

    const owns = await assertOwnership(user.id, businessId)
    if (!owns) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!isWhatsAppBridgeEnabled()) {
      return NextResponse.json({
        success: true,
        status: 'disconnected',
        phone: null,
        bridgeEnabled: false,
      })
    }

    const status = await getBridgeSessionStatus(businessId)

    const admin = createAdminClient()
    const { data: connection } = await admin
      .from('channel_connections')
      .select('id, status')
      .eq('business_id', businessId)
      .eq('channel', 'whatsapp')
      .maybeSingle()

    if (connection) {
      if (connection.status !== status.status) {
        await admin
          .from('channel_connections')
          .update({ status: status.status, updated_at: new Date().toISOString() })
          .eq('id', connection.id)
      }
    } else if (status.status === 'connected' || status.status === 'connecting') {
      const { data: assistant } = await admin
        .from('assistants')
        .select('id')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (assistant) {
        await admin.from('channel_connections').insert({
          business_id: businessId,
          assistant_id: assistant.id,
          channel: 'whatsapp',
          status: status.status,
          mode: DEFAULT_WHATSAPP_MODE,
          credentials: { transport: 'baileys' },
          configuration: {},
        })
      }
    }

    return NextResponse.json({ success: true, ...status, bridgeEnabled: true })
  } catch (error) {
    if (error instanceof BridgeClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Baileys session GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const body = (await request.json()) as { businessId?: string }
    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const owns = await assertOwnership(user.id, body.businessId)
    if (!owns) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let bridgeError: string | null = null
    if (isWhatsAppBridgeEnabled()) {
      try {
        await logoutBridgeSession(body.businessId)
      } catch (error) {
        bridgeError = error instanceof Error ? error.message : 'Bridge unreachable'
      }
    }

    const admin = createAdminClient()
    const { error: deleteError } = await admin
      .from('whatsapp_sessions')
      .delete()
      .eq('business_id', body.businessId)

    const { error: deleteConnError } = await admin
      .from('channel_connections')
      .delete()
      .eq('business_id', body.businessId)
      .eq('channel', 'whatsapp')

    if (deleteError || deleteConnError) {
      console.error('Baileys session cleanup error:', { deleteError, deleteConnError })
      return NextResponse.json({ error: 'Failed to clean up session' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: 'disconnected',
      ...(bridgeError ? { bridgeError } : {}),
    })
  } catch (error) {
    if (error instanceof BridgeClientError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Baileys session DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
