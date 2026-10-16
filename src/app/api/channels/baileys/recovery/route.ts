import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBridgeSecret } from '@/lib/baileys/config'
import { verifyBridgeWebhookAuth } from '@/lib/baileys/webhook-auth'
import { scanRecoveryCandidates, type RecoveryConnection } from '@/lib/sales/recovery-scan'

interface RecoveryConnectionConfig {
  recovery_enabled?: boolean
}

/**
 * Returns the commercial-recovery messages that are due for a WhatsApp
 * connection. Called by the WhatsApp Bridge worker, which owns the schedule and
 * the actual send; this route only decides WHAT (if anything) is due and is
 * safe to call repeatedly — it never mutates state and dedups on the attempt
 * markers persisted by the bridge.
 *
 * Anti-spam kill switch: set `RECOVERY_ENABLED=0` to disable recovery for every
 * connection without a deploy (per-connection opt-in still lives in
 * `channel_connections.configuration.recovery_enabled`).
 */
export async function POST(request: Request) {
  try {
    if (process.env.RECOVERY_ENABLED === '0') {
      return NextResponse.json({ success: true, due: [] })
    }

    const token = request.headers.get('x-mia-webhook-secret')
    if (!token) {
      return NextResponse.json({ error: 'Missing bridge token' }, { status: 401 })
    }

    const { businessId, connectionId } = await request.json()

    if (!businessId || !connectionId) {
      return NextResponse.json(
        { error: 'Missing businessId or connectionId' },
        { status: 400 }
      )
    }

    const auth = await verifyBridgeWebhookAuth(
      token,
      getBridgeSecret(),
      businessId,
      process.env.BRIDGE_JWT_PUBLIC_KEY ?? null
    )

    if (!auth) {
      return NextResponse.json({ error: 'Invalid bridge token' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: connection } = await supabase
      .from('channel_connections')
      .select('id, assistant_id, business_id, configuration')
      .eq('id', connectionId)
      .eq('business_id', businessId)
      .eq('channel', 'whatsapp')
      .eq('status', 'connected')
      .eq('mode', 'active')
      .maybeSingle()

    if (!connection) {
      return NextResponse.json({ success: true, due: [] })
    }

    const config = (connection.configuration ?? {}) as RecoveryConnectionConfig
    if (config.recovery_enabled !== true) {
      return NextResponse.json({ success: true, due: [] })
    }

    const due = await scanRecoveryCandidates({
      connection: connection as RecoveryConnection,
    })

    return NextResponse.json({ success: true, due })
  } catch (error) {
    console.error('Recovery scan error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
