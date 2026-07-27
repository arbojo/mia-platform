import { NextResponse } from 'next/server'
import { processIncomingMessage } from '@/lib/channels/gateway'
import { getAdapter } from '@/lib/channels/gateway'
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

    const body = await request.json()

    if (channelType !== 'web') {
      const signature = request.headers.get('x-hub-signature-256') ?? ''
      if (!adapter.validateWebhook(signature, JSON.stringify(body))) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const result = await processIncomingMessage(channelType, body)

    return NextResponse.json({
      success: true,
      response: result.response,
      customerId: result.customerId,
      conversationId: result.conversationId,
    })
  } catch (error) {
    console.error('Webhook error:', error)
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

    if (channel === 'whatsapp') {
      const url = new URL(request.url)
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
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
