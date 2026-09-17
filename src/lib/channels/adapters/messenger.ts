import crypto from 'crypto'
import type {
  ChannelAdapter,
  ChannelConnection,
  ChannelStatus,
  MessageContentType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
} from '../types'

const MESSENGER_API_VERSION = 'v21.0'
const MESSENGER_API_BASE = `https://graph.facebook.com/${MESSENGER_API_VERSION}`

function getAppSecret(): string | undefined {
  return process.env.MESSENGER_APP_SECRET ?? process.env.WHATSAPP_APP_SECRET
}

/**
 * Facebook Messenger channel adapter (Meta Graph / Pages API).
 *
 * Inbound events arrive through the page webhook (`/api/channels/webhook/messenger`)
 * and are normalized into `NormalizedMessage`. Outbound replies are delivered
 * through the Graph Send API (`/me/messages`). The page access token and page id
 * live in the channel connection credentials.
 */
export class MessengerAdapter implements ChannelAdapter {
  readonly channel = 'messenger' as const

  async receiveMessage(
    webhookBody: unknown,
    _headers?: Record<string, string>
  ): Promise<NormalizedMessage> {
    const body = webhookBody as {
      object?: string
      entry?: Array<{
        id?: string
        messaging?: Array<{
          sender?: { id?: string }
          recipient?: { id?: string }
          timestamp?: number
          message?: {
            mid?: string
            text?: string
            quick_reply?: { payload?: string }
            attachments?: Array<{ type?: string }>
          }
          postback?: { mid?: string; title?: string; payload?: string }
        }>
      }>
    }

    if (body.object !== 'page' || !body.entry?.length) {
      throw new Error('Invalid Messenger message format')
    }

    const entry = body.entry[0]
    const events = entry.messaging ?? []
    const event = events.find((e) => e.message || e.postback)

    if (!event || !event.sender?.id) {
      throw new Error('Invalid Messenger message format')
    }

    const senderPsid = event.sender.id
    const mid = event.message?.mid ?? event.postback?.mid

    let content = ''
    let contentType: MessageContentType = 'text'
    let payload: NormalizedMessage['payload']

    if (event.postback) {
      content = event.postback.title ?? event.postback.payload ?? ''
      payload = {
        type: 'quick_reply',
        id: event.postback.payload ?? event.postback.title ?? '',
        title: event.postback.title ?? '',
      }
    } else if (event.message?.text) {
      content = event.message.text
      if (event.message.quick_reply?.payload) {
        payload = {
          type: 'quick_reply',
          id: event.message.quick_reply.payload,
          title: event.message.text,
        }
      }
    } else if (event.message?.attachments?.length) {
      const attachment = event.message.attachments[0]
      if (attachment.type === 'image') {
        contentType = 'image'
        content = '[Imagen recibida]'
      } else if (attachment.type === 'audio') {
        contentType = 'audio'
        content = '[Audio recibido]'
      } else if (attachment.type === 'file') {
        contentType = 'document'
        content = '[Documento recibido]'
      } else {
        content = `[Adjunto: ${attachment.type}]`
      }
    }

    return {
      channel: 'messenger',
      externalId:
        mid ?? `messenger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerExternalId: senderPsid,
      customerName: undefined,
      content,
      contentType,
      payload,
      metadata: {
        pageId: entry.id,
        recipientId: event.recipient?.id,
        psid: senderPsid,
        timestamp: event.timestamp,
      },
      receivedAt: event.timestamp ? new Date(event.timestamp) : new Date(),
    }
  }

  async sendMessage(
    connection: ChannelConnection,
    message: OutgoingMessage
  ): Promise<SendResult> {
    const credentials = connection.credentials as {
      page_id?: string
      access_token?: string
    }

    const accessToken = credentials.access_token
    if (!accessToken) {
      return {
        success: false,
        error: 'Messenger credentials not configured (page_id, access_token)',
      }
    }

    const psid = (message.metadata?.psid ??
      message.metadata?.recipientId ??
      (connection.configuration as { psid?: string } | undefined)?.psid) as
      | string
      | undefined

    if (!psid) {
      return { success: false, error: 'No recipient PSID configured' }
    }

    try {
      const outgoing: Record<string, unknown> = {
        recipient: { id: psid },
        messaging_type: 'RESPONSE',
      }

      const imageUrl = message.metadata?.imageUrl as string | undefined
      if (imageUrl) {
        outgoing.message = {
          attachment: { type: 'image', payload: { url: imageUrl } },
        }
      } else {
        outgoing.message = { text: message.content }
      }

      const res = await fetch(
        `${MESSENGER_API_BASE}/me/messages?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(outgoing),
        }
      )

      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        return {
          success: false,
          error: errorData?.error?.message ?? `HTTP ${res.status}`,
        }
      }

      const result = (await res.json()) as { message_id?: string }
      return { success: true, externalId: result.message_id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  validateWebhook(signature: string, body: string): boolean {
    const appSecret = getAppSecret()
    if (!appSecret) {
      console.warn('MESSENGER_APP_SECRET not configured, skipping validation')
      return true
    }

    if (!signature) return false

    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(body)
      .digest('hex')

    const expected = Buffer.from(`sha256=${expectedSignature}`, 'utf8')
    const received = Buffer.from(signature, 'utf8')

    if (expected.length !== received.length) return false
    return crypto.timingSafeEqual(expected, received)
  }

  async getStatus(connection: ChannelConnection): Promise<ChannelStatus> {
    const credentials = connection.credentials as { access_token?: string }
    const accessToken = credentials.access_token

    if (!accessToken) return 'disconnected'

    try {
      const res = await fetch(
        `${MESSENGER_API_BASE}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
      )
      if (!res.ok) return 'error'
      return 'connected'
    } catch {
      return 'error'
    }
  }
}