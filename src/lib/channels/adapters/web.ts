import type {
  ChannelAdapter,
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '../types'

export class WebChatAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'web'

  async receiveMessage(
    webhookBody: unknown
  ): Promise<NormalizedMessage> {
    const body = webhookBody as {
      message?: string
      customerId?: string
      conversationId?: string
      businessId?: string
    }

    return {
      channel: 'web',
      externalId: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerExternalId: body.customerId ?? 'anonymous',
      content: body.message ?? '',
      contentType: 'text',
      metadata: {
        conversationId: body.conversationId,
        businessId: body.businessId,
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
      externalId: `web-out-${Date.now()}`,
    }
  }

  validateWebhook(_signature: string, _body: string): boolean {
    return true
  }

  async getStatus(_connection: ChannelConnection): Promise<ChannelStatus> {
    return 'connected'
  }
}
