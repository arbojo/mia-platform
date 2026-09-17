import { NextResponse } from 'next/server'
import { getAdapter } from '@/lib/channels/gateway'
import { processIncomingMessage, RuntimeError } from '@/lib/runtime/runtime'
import { resolveMessengerConnection } from '@/lib/conversation/resolver'
import type { ChannelType } from '@/lib/channels/types'

const validChannels: ChannelType[] = ['web', 'whatsapp', 'messenger', 'instagram']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await params

    if (!validChannels.includes(channel as ChannelType)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
    }

    const channelType = channel as ChannelType
    const adapter = getAdapter(channelType)

    // Validate the HMAC over the RAW body (JSON re-serialization would break it).
    const rawBody = await request.text()
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (channelType !== 'web') {
      const signature = request.headers.get('x-hub-signature-256') ?? ''
      if (!adapter.validateWebhook(signature, rawBody)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const wireMessage = await adapter.receiveMessage(body)

    const result = await processIncomingMessage(channelType, wireMessage, adapter)

    // Messenger replies must be pushed through the Graph Send API; there is no
    // bridge/caller that can deliver them from the returned JSON.
    if (
      channelType === 'messenger' &&
      result.deliver &&
      result.response &&
      wireMessage.customerExternalId
    ) {
      const connection = await resolveMessengerConnection(wireMessage)

      if (connection) {
        const sendResult = await adapter
          .sendMessage(connection, {
            content: result.response,
            contentType: 'text',
            metadata: {
              psid: wireMessage.customerExternalId,
              ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
            },
          })
          .catch((error: unknown) => ({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }))

        if (!sendResult.success) {
          console.error(
            `Messenger send failed for ${wireMessage.customerExternalId}: ${sendResult.error ?? 'unknown'}`
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      response: result.response,
      customerId: result.customerId,
      conversationId: result.conversationId,
    })
  } catch (error) {
    console.error('Webhook error:', error)

    if (error instanceof RuntimeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await params

    if (channel === 'whatsapp' || channel === 'messenger') {
      const url = new URL(request.url)
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      const expectedToken =
        channel === 'messenger'
          ? (process.env.MESSENGER_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN)
          : process.env.WHATSAPP_VERIFY_TOKEN

      if (mode === 'subscribe' && token === expectedToken) {
        return new Response(challenge, { status: 200 })
      }

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ status: 'ok', channel })
  } catch (error) {
    console.error('Webhook GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}