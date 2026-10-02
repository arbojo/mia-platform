import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBridgeSecret } from '@/lib/baileys/config'
import { isBridgeJwtConfigured, verifyBridgeToken } from '@/lib/platform/jwt'

/**
 * Delivery receipts from the WhatsApp Bridge.
 *
 * MIA writes the outgoing row BEFORE the bridge sends, so the only writer that
 * knows whether the message actually reached WhatsApp is the bridge. Without this
 * endpoint `status:'sent'` is a claim nobody verifies: `sendMessage` can throw and
 * the row keeps claiming success.
 *
 * Contract: the bridge reports the outcome of one send attempt against the row id
 * MIA returned as `outgoingMessageId`. Reported ids are matched against the
 * bridge's business so a receipt cannot move another tenant's row.
 */
export async function POST(request: Request) {
  try {
    const token = request.headers.get('x-mia-token')
    const secretHeader = request.headers.get('x-mia-webhook-secret')

    let authenticatedBusinessId: string | null = null

    if (token && isBridgeJwtConfigured()) {
      try {
        // The business comes from the token subject, never from a header the
        // caller chooses: a valid token for tenant A must not be able to write
        // tenant B's rows by claiming a different businessId.
        const verified = await verifyBridgeToken(token, 'bridge-webhook')
        authenticatedBusinessId = verified.businessId
      } catch {
        return NextResponse.json({ error: 'Invalid bridge token' }, { status: 401 })
      }
    } else if (secretHeader === getBridgeSecret()) {
      // Legacy shared-secret mode: the secret does not carry a business, so the
      // id must come from the header. Migration path only.
      authenticatedBusinessId = request.headers.get('x-mia-business-id')
    } else {
      return NextResponse.json({ error: 'Invalid bridge secret' }, { status: 401 })
    }

    if (!authenticatedBusinessId) {
      return NextResponse.json({ error: 'Missing business id' }, { status: 400 })
    }

    const body = (await request.json()) as {
      outgoingMessageId?: string
      status?: 'sent' | 'failed'
      externalId?: string | null
      error?: string
    }

    if (!body.outgoingMessageId) {
      return NextResponse.json({ error: 'Missing outgoingMessageId' }, { status: 400 })
    }
    if (body.status !== 'sent' && body.status !== 'failed') {
      return NextResponse.json({ error: 'status must be sent or failed' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Scoped to the reporting business so a compromised or buggy bridge cannot
    // update a row belonging to another tenant.
    const patch: Record<string, unknown> = {
      status: body.status,
      sent_at: body.status === 'sent' ? new Date().toISOString() : null,
      external_id: body.externalId ?? null,
      metadata: {
        delivery_reported: true,
        delivery_reported_at: new Date().toISOString(),
        ...(body.error ? { delivery_error: body.error.slice(0, 500) } : {}),
      },
    }

    const { data, error } = await supabase
      .from('channel_messages')
      .update(patch)
      .eq('id', body.outgoingMessageId)
      .eq('business_id', authenticatedBusinessId)
      .eq('direction', 'outgoing')
      .select('id, status')
      .maybeSingle()

    if (error) {
      console.error('Delivery receipt update failed:', error.message)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    if (!data) {
      // The row does not exist for this business: either a stale receipt after a
      // rollback, or a cross-tenant id. Nothing to do, and not an error the
      // bridge should retry forever.
      console.warn(
        `Delivery receipt ignored: no outgoing row ${body.outgoingMessageId} for business ${authenticatedBusinessId}`
      )
      return NextResponse.json({ success: true, matched: false })
    }

    return NextResponse.json({ success: true, matched: true, status: data.status })
  } catch (error) {
    console.error('Delivery receipt error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}