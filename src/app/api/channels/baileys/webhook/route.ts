import { NextResponse } from 'next/server'
import { BaileysAdapter } from '@/lib/channels/adapters/baileys'
import { handleCancellationWebhook } from '@/lib/sales/process'
import { processIncomingMessage, RuntimeError } from '@/lib/runtime/runtime'
import { getBridgeSecret } from '@/lib/baileys/config'
import { isBridgeJwtConfigured, verifyBridgeToken } from '@/lib/platform/jwt'
import type { WireMessage } from '@/lib/runtime/types'

async function verifyWebhookAuth(request: Request): Promise<boolean> {
  const jwtHeader = request.headers.get('x-mia-token')
  if (jwtHeader && isBridgeJwtConfigured()) {
    try {
      await verifyBridgeToken(jwtHeader, 'bridge-webhook')
      return true
    } catch {
      return false
    }
  }

  const secret = request.headers.get('x-mia-webhook-secret')
  return secret === getBridgeSecret()
}

/**
 * Internal webhook called by the WhatsApp Bridge (services/whatsapp-bridge)
 * when a new inbound message arrives. Authenticated with JWT (preferred) or
 * shared WHATSAPP_BRIDGE_SECRET during transition.
 */
export async function POST(request: Request) {
  try {
    if (!(await verifyWebhookAuth(request))) {
      return NextResponse.json({ error: 'Invalid bridge secret' }, { status: 401 })
    }

    const body = await request.json()

    const adapter = new BaileysAdapter()
    const wireMessage = (await adapter.receiveMessage(body)) as WireMessage

    const cancellationResult = await handleCancellationWebhook(wireMessage)
    if (cancellationResult) {
      return NextResponse.json({
        success: true,
        response: cancellationResult.response,
        customerId: cancellationResult.customerId,
        conversationId: cancellationResult.conversationId,
        imageUrl: null,
        mediaType: null,
        interactive: null,
        deliver: cancellationResult.deliver,
      })
    }

    const result = await processIncomingMessage('whatsapp', wireMessage, adapter)

    return NextResponse.json({
      success: true,
      response: result.response,
      customerId: result.customerId,
      conversationId: result.conversationId,
      imageUrl: result.imageUrl,
      mediaType: result.mediaType,
      interactive: result.interactive ?? null,
      deliver: result.deliver,
    })
  } catch (error) {
    console.error('Baileys webhook error:', error)

    if (error instanceof RuntimeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
