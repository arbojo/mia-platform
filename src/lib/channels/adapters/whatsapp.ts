import type {
  ChannelAdapter,
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '../types'

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'whatsapp'

  async receiveMessage(
    webhookBody: unknown
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

    return {
      channel: 'whatsapp',
      externalId: message.id ?? '',
      customerExternalId: message.from ?? '',
      customerName: contact?.profile?.name,
      customerPhone: message.from,
      content: message.text?.body ?? '',
      contentType: message.type === 'text' ? 'text' : 'text',
      metadata: {
        waId: message.from,
        phoneNumberId: metadata?.phone_number_id,
        displayPhoneNumber: metadata?.display_phone_number,
      },
      receivedAt: new Date(),
    }
  }

  async sendMessage(
    _connection: ChannelConnection,
    _message: OutgoingMessage
  ): Promise<SendResult> {
    return {
      success: true,
      externalId: `whatsapp-stub-${Date.now()}`,
    }
  }

  validateWebhook(signature: string, body: string): boolean {
    // TODO: Implement HMAC signature validation with app secret
    console.log('WhatsApp webhook validation stub:', signature, body.length)
    return true
  }

  async getStatus(_connection: ChannelConnection): Promise<ChannelStatus> {
    return 'disconnected'
  }
}
