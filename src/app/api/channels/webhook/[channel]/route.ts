import { NextResponse } from 'next/server'
import { receive, validateWebhook, verifySubscription } from '@/lib/channels/router'
import {
  processIncomingMessage,
  resolveChannelConnection,
  RuntimeError,
} from '@/lib/runtime/runtime'
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

    const raw = await request.text()

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const wireMessage = await receive(channelType, body)

    if (!wireMessage) {
      return NextResponse.json({ success: true })
    }

    let resolved
    try {
      resolved = await resolveChannelConnection(channelType, wireMessage)
    } catch (error) {
      if (error instanceof RuntimeError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        )
      }
      throw error
    }

    if (channelType !== 'web') {
      const signature = request.headers.get('x-hub-signature-256') ?? ''
      if (!validateWebhook(channelType, resolved.connection, signature, raw)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const result = await processIncomingMessage(channelType, wireMessage, resolved)

    return NextResponse.json({
      success: true,
      response: result.response,
      customerId: result.customerId,
      conversationId: result.conversationId,
      duplicate: result.duplicate ?? false,
      outboundStatus: result.outboundStatus,
      outboundExternalId: result.outboundExternalId,
    })
  } catch (error) {
    console.error('Webhook error:', error)

    if (error instanceof RuntimeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await params

    const channelType = channel as ChannelType

    if (!validChannels.includes(channelType)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
    }

    const searchParams = new URL(request.url).searchParams

    const subscription = await verifySubscription(channelType, searchParams)

    if (subscription.valid) {
      return new Response(subscription.challenge, { status: 200 })
    }

    if (searchParams.get('hub.mode')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ status: 'ok', channel })
  } catch (error) {
    console.error('Webhook GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
