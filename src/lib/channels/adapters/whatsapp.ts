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
          }
        }>
      }>
    }

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    const contact = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]

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
      },
      receivedAt: new Date(),
    }
  }

  async sendMessage(
    _connection: ChannelConnection,
    message: OutgoingMessage
  ): Promise<SendResult> {
    console.log('WhatsApp send stub:', message.content)
    return {
      success: true,
      externalId: `whatsapp-stub-${Date.now()}`,
    }
  }

  validateWebhook(signature: string, body: string): boolean {
    // TODO: Implement HMAC signature validation
    // For now, accept all webhooks
    console.log('WhatsApp webhook validation stub:', signature, body.length)
    return true
  }

  async getStatus(_connection: ChannelConnection): Promise<ChannelStatus> {
    // TODO: Check WhatsApp Business API status
    return 'disconnected'
  }
}
