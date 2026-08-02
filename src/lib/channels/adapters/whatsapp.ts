import crypto from 'crypto'
import type {
  ChannelAdapter,
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '../types'

const WHATSAPP_API_VERSION = 'v21.0'
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'whatsapp'

  async receiveMessage(
    webhookBody: unknown,
    _headers?: Record<string, string>
  ): Promise<NormalizedMessage> {
    const body = webhookBody as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              id?: string
              from?: string
              text?: { body?: string }
              type?: string
              image?: { id?: string }
              audio?: { id?: string }
              document?: { id?: string; filename?: string }
            }>
            contacts?: Array<{
              wa_id?: string
              profile?: { name?: string }
            }>
            metadata?: {
              phone_number_id?: string
              display_phone_number?: string
            }
          }
        }>
      }>
    }

    const change = body.entry?.[0]?.changes?.[0]
    const message = change?.value?.messages?.[0]
    const contact = change?.value?.contacts?.[0]
    const metadata = change?.value?.metadata

    if (!message) {
      throw new Error('Invalid WhatsApp message format')
    }

    let content = ''
    let contentType: NormalizedMessage['contentType'] = 'text'

    if (message.text?.body) {
      content = message.text.body
      contentType = 'text'
    } else if (message.image) {
      contentType = 'image'
      content = '[Imagen recibida]'
    } else if (message.audio) {
      contentType = 'audio'
      content = '[Audio recibido]'
    } else if (message.document) {
      contentType = 'document'
      content = `[Documento: ${message.document.filename ?? 'archivo'}]`
    }

    return {
      channel: 'whatsapp',
      externalId: message.id ?? '',
      customerExternalId: message.from ?? '',
      customerName: contact?.profile?.name,
      customerPhone: message.from,
      content,
      contentType,
      metadata: {
        waId: message.from,
        phoneNumberId: metadata?.phone_number_id,
        displayPhoneNumber: metadata?.display_phone_number,
        messageType: message.type,
      },
      receivedAt: new Date(),
    }
  }

  async sendMessage(
    connection: ChannelConnection,
    message: OutgoingMessage
  ): Promise<SendResult> {
    const credentials = connection.credentials as {
      phone_number_id?: string
      access_token?: string
    }

    if (!credentials.phone_number_id || !credentials.access_token) {
      return {
        success: false,
        error: 'WhatsApp credentials not configured (phone_number_id, access_token)',
      }
    }

    const phoneNumberId = credentials.phone_number_id
    const accessToken = credentials.access_token

    const configuration = connection.configuration as {
      to?: string
    }

    if (!configuration.to) {
      return {
        success: false,
        error: 'No destination phone number configured',
      }
    }

    try {
      const payload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        to: configuration.to,
        type: 'text',
        text: { body: message.content },
      }

      const response = await fetch(
        `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        console.error('WhatsApp API error:', errorData)
        return {
          success: false,
          error: errorData.error?.message ?? `HTTP ${response.status}`,
        }
      }

      const result = await response.json()
      const externalId = result.messages?.[0]?.id

      return {
        success: true,
        externalId,
      }
    } catch (error) {
      console.error('WhatsApp send error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  validateWebhook(signature: string, body: string): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (!appSecret) {
      console.warn('WHATSAPP_APP_SECRET not configured, skipping validation')
      return true
    }

    if (!signature) return false

    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(body)
      .digest('hex')

    return signature === `sha256=${expectedSignature}`
  }

  async getStatus(connection: ChannelConnection): Promise<ChannelStatus> {
    const credentials = connection.credentials as {
      phone_number_id?: string
      access_token?: string
    }

    if (!credentials.phone_number_id || !credentials.access_token) {
      return 'disconnected'
    }

    try {
      const response = await fetch(
        `${WHATSAPP_API_BASE}/${credentials.phone_number_id}`,
        {
          headers: {
            Authorization: `Bearer ${credentials.access_token}`,
          },
        }
      )

      if (!response.ok) return 'error'

      const data = await response.json()
      return data.verified_name ? 'connected' : 'connecting'
    } catch {
      return 'error'
    }
  }

  async sendMessageToPhone(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    content: string
  ): Promise<SendResult> {
    try {
      const response = await fetch(
        `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: content },
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData.error?.message ?? `HTTP ${response.status}`,
        }
      }

      const result = await response.json()
      return {
        success: true,
        externalId: result.messages?.[0]?.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
